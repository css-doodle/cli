import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { config, configDownloadPath, configPath, getBrowserPath, pkg } from './static.js';
import { generateShape, generateSVG } from './generate.js';
import { parse } from './parse.js';
import { preview } from './preview/index.js';
import { render } from './render/index.js';
import { read } from './read.js';
import { checkExists, clearRow, log, readTime, style } from './utils.js';

export async function handleRender(source, options) {
    const { content, type } = await read(source);

    options.type = type;
    options.delay = readTimeOption('delay', options.delay, 30 * 1000, options.quiet);
    options.time = readTimeOption('time', options.time, 60 * 1000, options.quiet);
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
    if (source && source !== '-') {
        options.title = path.basename(source, path.extname(source));
    }

    const start = Date.now();
    const output = await render(content, options);
    if (!output) {
        if (!options.quiet) {
            log.warn('aborted');
        }
        return;
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
        await preview(content, 'css-doodle', options);
    } else {
        const title = path.basename(source);
        await preview(source, title, options);
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
        if (await checkExists(value)) {
            if (!await isValidCssDoodleFile(value)) {
                throw new Error(`invalid css-doodle package file '${value}'`);
            }
            config[field] = path.resolve(value);
        } else if (isPackageVersion(value)) {
            config[field] = fetchCssDoodleSource(value);
        } else {
            throw new Error(`invalid package version '${value}'`);
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
    const currentVersion = pkg.version;
    let latestVersion;

    try {
        log.info('checking for updates...');
        latestVersion = execSync(`npm view @css-doodle/cli version`, { encoding: 'utf8' }).trim();
        clearRow();
    } catch (e) {
        clearRow();
        throw new Error(`failed to check for updates: ${e.message}`);
    }

    if (currentVersion === latestVersion) {
        log.success(`already up to date (${currentVersion})`);
        return;
    }

    log.info(`upgrading CLI from ${currentVersion} to ${latestVersion}`);
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

function readTimeOption(name, value, max, quiet) {
    const time = readTime(value);
    if (time > max) {
        if (!quiet) {
            log.warn(`${name} '${value}' exceeds the maximum of ${max / 1000}s, using ${max / 1000}s instead`);
        }
        return max;
    }
    return time;
}

function fetchCssDoodleSource(value) {
    const version = value.replace(/^css-doodle@/, '');
    const prefix = path.join(configDownloadPath, version);
    try {
        log.info(`fetching css-doodle@${version} from npm registry`);
        execSync(`npm i css-doodle@${version} --prefix ${JSON.stringify(prefix)}`, { stdio: 'ignore' });
        return path.join(prefix, 'node_modules/css-doodle');
    } catch (_e) {
        throw new Error(`failed to fetch css-doodle@${version}`);
    }
}

function isPackageVersion(value) {
    return /^(css-doodle@)?(latest|\d+\.\d+\.\d+)$/.test(value);
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
