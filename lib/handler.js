import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { config, configPath, configDownloadPath } from './static.js'
import { generateSVG, generateShape } from './generate.js';
import { parse } from './parse.js';
import { preview } from './preview/index.js';
import { render } from './render/index.js';
import { read } from './read.js';
import { msgError, msgTip, msgSuccess } from './message.js';

export async function handleRender(source, options) {
    const { content, error, type } = await read(source);
    if (error) {
        console.error(msgError(error.message));
        process.exit(1);
    }
    options.type = type;
    options.delay = readTime(options.delay, { max: 30 * 1000 }) || 0;
    options.time = readTime(options.time, { max: 60 * 1000 }) || 0;
    options.selector ??= 'css-doodle';

    if (options.windowSize) {
        const [w, h = w] = options.windowSize.split(/[,x]/);
        options.windowWidth = Number(w);
        options.windowHeight = Number(h);
    }

    if (options.scale) {
        options.scale = Number(options.scale);
    }

    if (/\.(mp4|webm)$/.test(options.output) && !options.time) {
        options.time = 5 * 1000;
    }

    let title = options.time ? 'record' : 'image';
    if (source) {
        const basename = path.basename(source);
        const extname = path.extname(basename);
        title = extname ? basename.split(extname)[0] : basename;
    }
    options.title = title;

    try {
        const start = Date.now();
        const output = await render(content, options);
        const time = (Date.now() - start) / 1000;
        if (output && !options.quiet) {
            let outputTime = `(${time}s)`;
            console.log(`${msgSuccess('Saved')} to ${output} ${msgTip(outputTime)}`);
        }
    } catch (e) {
        console.error(msgError(e.message));
        process.exit(1);
    }
}

export async function handleParse(source) {
    let { content, error } = await read(source);
    if (error) {
        return console.error(error.message);
    }
    try {
        console.log(JSON.stringify(parse(content), null, 2));
    }  catch (e) {
        console.error(msgError(e.message));
        process.exit(1);
    }
}

export async function handlePreview(source, options) {
    let { content, error, type } = await read(source);
    if (error) {
        if (!(type === 'css' && /empty/.test(error.message))) {
            return console.error(msgError(error.message));
        }
    }
    if (type === 'codepen' || type === 'html') {
        return console.error(msgError('only .css and .cssd files are supported for preview'));
    }
    if (source === undefined) {
        options.fromStdin = true;
        preview(content, 'css-doodle', options);
    } else {
        let title = path.basename(source);
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
        console.log(generateSVG(content));
    } else {
        console.error(msgError('invalid SVG format'));
    }
}

export async function handleGenerateShape(source) {
    let { content, error } = await read(source);
    if (error) {
        return console.error(msgError(error.message));
    }
    console.log(generateShape(content));
}

export async function handleSetConfig(field, value) {
    if (field === 'css-doodle') {
        if (fs.existsSync(value)) {
            config[field] = path.resolve(value);
        } else {
            const { result, error } = await fetchCssDoodleSource(value);
            if (error) {
                return console.error(error.message);
            }
            try {
                const libPath = path.join(configDownloadPath, `css-doodle-${value}.js`);
                fs.writeFileSync(libPath, result);
                config[field] = libPath;
            } catch (e) {
                return console.error(msgError(`failed to fetch css-doodle@${value}`));
            }
        }
    } else {
        config[field] = value;
    }

    if (value === '') {
        delete config[field];
    }

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(msgSuccess('Done'));
    } catch (e) {
        console.error(msgError('failed to write config file'));
    }
}

export async function handleUnsetConfig(field) {
    delete config[field];
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(msgSuccess('Done'));
    } catch (e) {
        console.error(msgError('failed to write config file'));
    }
}

export async function handleUseAction(version) {
    handleSetConfig('css-doodle', version);
}

export function handleDisplayConfig(field) {
    console.log(config[field]);
}

export function handleDisplayConfigList() {
    console.log(JSON.stringify(config, null, 2));
}

export function handleUpgrade() {
    console.log(msgTip('Upgrading CLI'));
    execSync('npm update -g @css-doodle/cli', { stdio: 'inherit' });
}

async function fetchCssDoodleSource(version) {
    let result = '', error;

    if (/^css\-doodle@/.test(version)) {
        version = version.split('@')[1];
    }

    const messageInvalid = msgError(`invalid package version '${version}'`);
    const messageFailed = msgError(`failed to fetch css-doodle@${version}`);

    if (!(version === 'latest' || /^\d+\.\d+\.\d+$/.test(version))) {
        return {
            result, error: new Error(messageInvalid)
        }
    }

    try {
        console.log(msgTip(`Fetching css-doodle@${version} from esm.sh`));
        result = await fetchResource(`https://esm.sh/css-doodle@${version}/css-doodle.min.js?raw`);
    } catch (e) {
        try {
            console.log(msgTip(`Try jsdelivr`));
            result = await fetchResource(`https://cdn.jsdelivr.net/npm/css-doodle@${version}/css-doodle.min.js`);
        } catch (e) {
            error = new Error(messageFailed);
        }
    }

    if (/^invalid|ERR_PNPM_NO_MATCHING_VERSION/i.test(result)) {
        error = new Error(messageInvalid)
    }

    return {
        result, error
    }
}

async function fetchResource(url) {
    let res = await fetch(url, { redirect: 'follow' });
    return Buffer.from(await res.arrayBuffer()).toString();
}

function readTime(number, options = {}) {
    let result = 0;
    if (/^(\d+)(ms)?$/.test(number)) {
        result = Number(number.replace('ms', ''));
    }
    if (/^(\d+)s$/.test(number)) {
        result = Number(number.replace('s','')) * 1000;
    }
    if (/^(\d+)m$/.test(number)) {
        result = Number(number.replace('m', '')) * 60 * 1000;
    }
    return Math.min(result, options.max ?? Infinity);
}
