import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

import { config, configDownloadPath, configPath, getBrowserPath } from './static.js';
import { generateShape, generateSVG } from './generate.js';
import { parse } from './parse.js';
import { preview } from './preview/index.js';
import { render } from './render/index.js';
import { read } from './read.js';
import { clearRow, log, readTime, style } from './utils.js';

export async function handleRender(source, options) {
    const { content, error, type } = await read(source);
    if (error) {
        log.error(error.message);
        process.exit(1);
    }

    options.type = type;
    options.delay = readTime(options.delay, { max: 30 * 1000 }) || 0;
    options.time = readTime(options.time, { max: 60 * 1000 }) || 0;
    options.selector ??= 'css-doodle';

    if (options.window) {
        const [w, h = w] = options.window.split(/[,x]/);
        options.windowWidth = Number(w);
        options.windowHeight = Number(h);
    }
    if (options.scale) {
        options.scale = Number(options.scale);
    }
    if (source) {
        const basename = path.basename(source);
        const extname = path.extname(basename);
        options.title = extname ? basename.split(extname)[0] : basename;
    }
    try {
        const start = Date.now();
        const output = await render(content, options);
        if (!output) {
            return;
        }
        const time = (Date.now() - start) / 1000;
        if (!options.quiet) {
            const outputTime = `(${time}s)`;
            console.log(`${style.green('✓ saved')} to ${output} ${style.dim(outputTime)}`);
        }
    } catch (e) {
        log.error(e.message);
        process.exit(1);
    }
}

export async function handleParse(source) {
    const { content, error } = await read(source);
    if (error) {
        log.error(error.message);
        process.exit(1);
    }
    try {
        console.log(JSON.stringify(await parse(content), null, 2));
    } catch (e) {
        log.error(e.message);
        process.exit(1);
    }
}

export async function handlePreview(source, options) {
    const { content, error, type } = await read(source);
    if (error) {
        if (!(type === 'css' && /empty/.test(error.message))) {
            log.error(error.message);
            process.exit(1);
        }
    }
    if (type === 'codepen' || type === 'html' || type === 'webpage') {
        log.error('only .css and .cssd files are supported for preview');
        process.exit(1);
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
    let { content, error } = await read(source);
    if (error) {
        log.error(error.message);
        process.exit(1);
    }
    content = content.trim();
    if (/^svg\s*\{/i.test(content) || !content.length) {
        console.log(await generateSVG(content));
    } else {
        log.error('invalid SVG format');
        process.exit(1);
    }
}

export async function handleGenerateShape(source) {
    const { content, error } = await read(source);
    if (error) {
        log.error(error.message);
        process.exit(1);
    }
    console.log(await generateShape(content));
}

export async function handleSetConfig(field, value) {
    if (field === 'css-doodle') {
        try {
            await fs.access(value, fs.constants.F_OK);
            if (await isValidCssDoodleFile(value)) {
                config[field] = path.resolve(value);
            } else {
                log.error(`invalid css-doodle package file '${value}'`);
                process.exit(1);
            }
        } catch (_e) {
            if (!isPackageVersion(value)) {
                log.error(`invalid package version '${value}'`);
                process.exit(1);
            }
            const { result, error } = fetchCssDoodleSource(value);
            if (error) {
                log.error(error.message);
                process.exit(1);
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
        log.error('failed to write config file');
        process.exit(1);
    }
}

export async function handleUnsetConfig(field) {
    delete config[field];
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        log.success('done');
    } catch (_e) {
        log.error('failed to write config file');
        process.exit(1);
    }
}

export function handleUseAction(version) {
    handleSetConfig('css-doodle', version);
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
    } catch (_e) {
        clearRow();
        log.error('failed to check for updates');
        process.exit(1);
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
    } catch (_e) {
        clearRow();
        log.error('update failed');
        process.exit(1);
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
