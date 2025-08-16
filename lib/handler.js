import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

import { config, configDownloadPath, configPath } from './static.js';
import { generateShape, generateSVG } from './generate.js';
import { parse } from './parse.js';
import { preview } from './preview/index.js';
import { render } from './render/index.js';
import { read } from './read.js';
import { style } from './style.js';

export async function handleRender(source, options) {
    const { content, error, type } = await read(source);
    if (error) {
        console.error(style.red(error.message));
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
        const time = (Date.now() - start) / 1000;
        if (output && !options.quiet) {
            const outputTime = `(${time}s)`;
            console.log(`${style.green('Saved')} to ${output} ${style.dim(outputTime)}`);
        }
    } catch (e) {
        console.error(style.red(e.message));
        process.exit(1);
    }
}

export async function handleParse(source) {
    const { content, error } = await read(source);
    if (error) {
        return console.error(error.message);
    }
    try {
        console.log(JSON.stringify(await parse(content), null, 2));
    } catch (e) {
        console.error(style.red(e.message));
        process.exit(1);
    }
}

export async function handlePreview(source, options) {
    const { content, error, type } = await read(source);
    if (error) {
        if (!(type === 'css' && /empty/.test(error.message))) {
            return console.error(style.red(error.message));
        }
    }
    if (type === 'codepen' || type === 'html' || type === 'webpage') {
        return console.error(style.red('only .css and .cssd files are supported for preview'));
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
        return console.error(error.message);
    }
    content = content.trim();
    if (/^svg\s*\{/i.test(content) || !content.length) {
        console.log(await generateSVG(content));
    } else {
        console.error(style.red('invalid SVG format'));
    }
}

export async function handleGenerateShape(source) {
    const { content, error } = await read(source);
    if (error) {
        return console.error(style.red(error.message));
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
                return console.error(style.red(`invalid css-doodle package file '${value}'`));
            }
        } catch (_e) {
            if (!isPackageVersion(value)) {
                return console.error(style.red(`invalid package version '${value}'`));
            }
            const { result, error } = fetchCssDoodleSource(value);
            if (error) {
                return console.error(error.message);
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
        console.log(style.green('Done'));
    } catch (_e) {
        console.error(style.red('failed to write config file'));
    }
}

export async function handleUnsetConfig(field) {
    delete config[field];
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        console.log(style.green('Done'));
    } catch (_e) {
        console.error(style.red('failed to write config file'));
    }
}

export function handleUseAction(version) {
    handleSetConfig('css-doodle', version);
}

export function handleDisplayConfig(field) {
    console.log(config[field]);
}

export function handleDisplayConfigList() {
    console.log(JSON.stringify(config, null, 2));
}

export function handleUpdate() {
    console.log(style.dim('Upgrading CLI'));
    execSync('npm update -g @css-doodle/cli', { stdio: 'inherit' });
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
        console.log(style.dim(`Fetching css-doodle@${version} from npm registry`));
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

function readTime(number, options = {}) {
    let result = 0;
    if (/^(\d+)(ms)?$/.test(number)) {
        result = Number(number.replace('ms', ''));
    }
    if (/^(\d+)s$/.test(number)) {
        result = Number(number.replace('s', '')) * 1000;
    }
    if (/^(\d+)m$/.test(number)) {
        result = Number(number.replace('m', '')) * 60 * 1000;
    }
    return Math.min(result, options.max ?? Infinity);
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
