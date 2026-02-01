import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { config, configDownloadPath, configPath, getBrowserPath } from './static.js';
import { generateShape, generateSVG } from './generate.js';
import { parse } from './parse.js';
import { preview } from './preview/index.js';
import { render } from './render/index.js';
import { read } from './read.js';
import { clearRow, log, readTime, style } from './utils.js';

export async function handleRender(source, options) {
    const { content, type } = await read(source);

    options.type = type;
    options.delay = readTime(options.delay, { max: 30 * 1000 }) || 0;
    options.time = readTime(options.time, { max: 60 * 1000 }) || 0;
    options.selector ??= 'css-doodle';

    if (options.window) {
        const [w, h = w] = options.window.split(/[,x]/);
        const width = Number(w);
        const height = Number(h);
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
            throw new Error(`invalid window size '${options.window}', expected format: WIDTHxHEIGHT (e.g., 1600x1000)`);
        }
        if (width > 8192 || height > 8192) {
            throw new Error(`window size too large, maximum is 8192x8192`);
        }
        options.windowWidth = width;
        options.windowHeight = height;
    }
    if (options.scale) {
        const scale = Number(options.scale);
        if (!Number.isFinite(scale) || scale <= 0 || scale > 10) {
            throw new Error(`invalid scale '${options.scale}', expected a number between 0.01 and 10`);
        }
        options.scale = scale;
    }
    if (source) {
        const basename = path.basename(source);
        const extname = path.extname(basename);
        options.title = extname ? basename.split(extname)[0] : basename;
    }

    const start = Date.now();
    const output = await render(content, options);
    if (!output) {
        throw new Error('render aborted');
    }
    const time = (Date.now() - start) / 1000;
    if (!options.quiet) {
        const outputTime = `(${time}s)`;
        console.log(`${style.green('✓ saved')} to ${output} ${style.dim(outputTime)}`);
    }
}

export async function handleParse(source) {
    const { content } = await read(source);
    console.log(JSON.stringify(await parse(content), null, 2));
}

export async function handlePreview(source, options) {
    let content, type;
    try {
        const result = await read(source);
        content = result.content;
        type = result.type;
    } catch (e) {
        if (e.message === 'empty input' && !source) {
            // Allow empty input for preview from stdin
            content = '';
            type = 'css';
        } else {
            throw e;
        }
    }

    if (type === 'codepen' || type === 'html' || type === 'webpage') {
        throw new Error('only .css and .cssd files are supported for preview');
    }
    if (source === undefined) {
        options.fromStdin = true;
        preview(content, 'css-doodle', options);
    } else {
        const title = path.basename(source);
        preview(source, title, options);
    }
}

export async function handleGenerateSVG(source) {
    let { content } = await read(source);
    content = content.trim();
    if (/^svg\s*\{/i.test(content) || !content.length) {
        console.log(await generateSVG(content));
    } else {
        throw new Error('invalid SVG format');
    }
}

export async function handleGenerateShape(source) {
    const { content } = await read(source);
    console.log(await generateShape(content));
}

export async function handleSetConfig(field, value) {
    if (field === 'css-doodle') {
        try {
            await fs.access(value, fs.constants.F_OK);
            if (await isValidCssDoodleFile(value)) {
                config[field] = path.resolve(value);
            } else {
                throw new Error(`invalid css-doodle package file '${value}'`);
            }
        } catch (_e) {
            if (!isPackageVersion(value)) {
                throw new Error(`invalid package version '${value}'`);
            }
            const { result, error } = fetchCssDoodleSource(value);
            if (error) {
                throw error;
            }
            config[field] = result;
        }
    } else {
        config[field] = value;
    }

    if (value === '') {
        delete config[field];
    }

    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        log.success('done');
    } catch (_e) {
        throw new Error('failed to write config file');
    }
}

export async function handleUnsetConfig(field) {
    delete config[field];
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        log.success('done');
    } catch (_e) {
        throw new Error('failed to write config file');
    }
}

export async function handleUseAction(version) {
    await handleSetConfig('css-doodle', version);
}

export function handleDisplayConfig(field) {
    console.log(config[field]);
}

export async function handleDisplayConfigList() {
    const displayConfig = { ...config };
    const browserPath = await getBrowserPath();
    displayConfig.browserPath = browserPath || '(auto-detected)';
    console.log(JSON.stringify(displayConfig, null, 2));
}

export function handleUpdate() {
    let currentVersion, latestVersion;
    try {
        currentVersion = execSync(`css-doodle --version`, { encoding: 'utf8' }).trim();
    } catch (_e) {
        currentVersion = null;
    }

    try {
        log.info('checking for updates...');
        latestVersion = execSync(`npm view @css-doodle/cli version`, { encoding: 'utf8' }).trim();
        clearRow();
    } catch (e) {
        clearRow();
        throw new Error(`failed to check for updates: ${e.message}`);
    }

    if (currentVersion && currentVersion === latestVersion) {
        log.success(`already up to date (${currentVersion})`);
        return;
    }

    log.info(`upgrading CLI${currentVersion ? ` from ${currentVersion}` : ''} to ${latestVersion}`);
    try {
        execSync(
            `npm install --silent --no-fund -g @css-doodle/cli`,
            { stdio: 'inherit' },
        );
        clearRow();
        log.success(`CLI updated to ${latestVersion}`);
    } catch (e) {
        clearRow();
        throw new Error(`update failed: ${e.message}`);
    }
}

function fetchCssDoodleSource(version) {
    let result = '', error;

    if (/^css\-doodle@/.test(version)) {
        version = version.split('@')[1];
    }

    const messageInvalid = style.red(`invalid package version '${version}'`);
    const messageFailed = style.red(`failed to fetch css-doodle@${version}`);

    if (!(version === 'latest' || /^\d+\.\d+\.\d+$/.test(version))) {
        return {
            result,
            error: new Error(messageInvalid),
        };
    }

    try {
        log.info(`fetching css-doodle@${version} from npm registry`);
        execSync(`npm i css-doodle@${version} --prefix ${path.join(configDownloadPath, version)}`, { stdio: 'ignore' });
        result = path.join(configDownloadPath, `${version}/node_modules/css-doodle`);
    } catch (_e) {
        error = new Error(messageFailed);
    }

    return {
        result,
        error,
    };
}

function isPackageVersion(value) {
    return value === 'latest' || /^(css\-doodle@)?\d+\.\d+\.\d+$/.test(value);
}

async function isValidCssDoodleFile(file) {
    try {
        const content = await fs.readFile(file, 'utf8');
        return content.startsWith('/*! css-doodle');
    } catch (_e) {
        return false;
    }
}

export { isPackageVersion, isValidCssDoodleFile };
