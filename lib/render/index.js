import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { dirname, extname, join } from 'node:path';

import puppeteer from 'puppeteer-core';

import { defaultAppArgs, getCssDoodleLib } from '../static.js';
import { resolveBrowser } from '../browser.js';
import { screenshot } from './screenshot.js';
import { screencast } from './screencast.js';
import { checkExists, clearRow, log, question, style } from '../utils.js';
import process from 'node:process';

const supportedOutputFormat = {
    image: ['png', 'jpeg', 'webp'],
    video: ['mp4', 'webm', 'gif'],
};

const formatAliases = { jpg: 'jpeg' };

const unsupportedExtensions = ['avif', 'bmp', 'heic', 'ico', 'svg', 'tif', 'tiff', 'avi', 'm4v', 'mkv', 'mov'];

export async function prepareOutput(options) {
    if (options.output && await isDirectory(options.output)) {
        options.outputDir = options.output;
        options.output = undefined;
    }
    const { type, format, extension } = getOutputInfo(options);
    Object.assign(options, { outputType: type, format, extension });
    if (type === 'video' && !options.time) {
        options.time = 5 * 1000;
    }
    if (options.output) {
        return await processIfOutputExists(options.output, options.yes);
    }
    return true;
}

export async function render(code, options = {}) {
    const args = [
        ...defaultAppArgs,
        '--start-maximized',
    ];

    if (options.type === 'codepen' || options.type === 'webpage') {
        args.push('--ignore-certificate-errors');
    }

    const executablePath = await resolveBrowser(options.quiet);

    const settings = {
        defaultViewport: null,
        executablePath,
        args,
    };

    const browser = await puppeteer.launch(settings);
    const isDoodle = ['css', 'cssd', 'doodle', 'stdin'].includes(options.type) &&
        !(options.type === 'stdin' && maybeHTML(code));
    let pageErrors;

    try {
        const page = await browser.newPage();
        pageErrors = collectPageErrors(page, { console: isDoodle });
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

        switch (options.type) {
            case 'css':
            case 'cssd':
            case 'doodle':
            case 'stdin': {
                if (isDoodle) {
                    await page.setContent(buildHTML(code, await getCssDoodleLib(), options.seed));
                } else {
                    warnIgnoredSeed(options);
                    await setContentAndWait(page, code);
                }
                break;
            }
            case 'codepen': {
                warnIgnoredSeed(options);
                if (!options.quiet) {
                    log.info('fetching from CodePen...');
                }
                await page.goto(code);
                const iframe = await page.$('iframe#result');
                if (iframe) {
                    const code = await page.evaluate((el) => el.getAttribute('srcdoc'), iframe);
                    await setContentAndWait(page, code);
                } else {
                    throw new Error('read CodePen failed');
                }
                if (!options.quiet) {
                    clearRow();
                }
                break;
            }
            case 'webpage':
            case 'html': {
                warnIgnoredSeed(options);
                if (!options.quiet) {
                    log.info(`opening ${code}...`);
                }
                await page.goto(code, {
                    waitUntil: 'networkidle2',
                });
                if (!options.quiet) {
                    clearRow();
                }
                break;
            }
            default: {
                throw new Error(`invalid type '${options.type}'`);
            }
        }

        // The default filename has the seed of the doodle, so it's only known now.
        if (!options.output) {
            const title = options.title ?? (options.outputType === 'video' ? 'record' : 'image');
            let tag = Date.now();
            if (isDoodle) {
                tag = await page.$eval('css-doodle', (el) => el.seed);
            }
            const name = `${title}-${String(tag).replace(/[^\w.-]+/g, '-')}.${options.extension}`;
            options.output = options.outputDir ? join(options.outputDir, name) : name;

            // Code read from stdin has used it up, so it can't take an answer anymore.
            const proceed = await processIfOutputExists(options.output, options.yes, { prompt: options.type !== 'stdin' });
            if (!proceed) {
                return;
            }
        }

        await fs.mkdir(dirname(options.output), { recursive: true });
        if (options.delay) {
            await setTimeout(options.delay);
        }

        return options.outputType === 'video' ? await screencast(page, options) : await screenshot(page, options);
    } finally {
        await browser.close();
        if (pageErrors) {
            printPageErrors(pageErrors, options.quiet);
        }
    }
}

// setContent() no longer supports `networkidle*` in waitUntil,
// so wait for external resources separately.
async function setContentAndWait(page, html) {
    await page.setContent(html);
    await page.waitForNetworkIdle();
}

async function processIfOutputExists(output, yes, { prompt = true } = {}) {
    if (!await checkExists(output)) {
        return true;
    }
    if (yes) {
        return true;
    }
    // Can't ask in CI, or when the code is piped in through stdin.
    if (!prompt || !process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error(`"${output}" already exists. Use -y/--yes to overwrite or choose a different output name.`);
    }
    const answer = await question(style.yellow(`"${output}" already exists. Overwrite? [Y/n] `));
    clearRow();
    const normalized = answer.trim().toLowerCase();
    return normalized === '' || normalized === 'y' || normalized === 'yes';
}

function warnIgnoredSeed(options) {
    if (options.seed !== undefined && !options.quiet) {
        log.warn('--seed only applies to css-doodle source code, ignored.');
    }
}

function escapeAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function getOutputInfo(options = {}) {
    let extension = typeof options.format === 'string' ? options.format.toLowerCase() : '';
    let format = normalizeFormat(extension);
    const output = options.output;
    const time = options.time;
    const allFormats = Object.values(supportedOutputFormat).flat();

    if (format && !allFormats.includes(format)) {
        throw new Error(
            `unrecognized format '${extension}', supported formats are: ${allFormats.join(', ')}`,
        );
    }
    if (output) {
        const ext = extname(output).slice(1).toLowerCase();
        const extFormat = normalizeFormat(ext);
        if (ext && allFormats.includes(extFormat)) {
            if (format && format !== extFormat) {
                throw new Error(`conflicting format '${extension}' and output extension '${ext}'`);
            }
            format = extFormat;
            extension = ext;
        } else if (unsupportedExtensions.includes(ext)) {
            throw new Error(`unsupported output format '${ext}', supported formats are: ${allFormats.join(', ')}`);
        } else {
            extension ||= time ? 'mp4' : 'png';
            options.output += '.' + extension;
        }
    }
    if (!format) {
        format = time ? 'mp4' : 'png';
    }
    extension ||= format;
    const type = supportedOutputFormat.image.includes(format) ? 'image' : 'video';

    if (type === 'image' && time) {
        log.warn('time option is ignored for image formats.');
    }

    return {
        type,
        format,
        extension,
    };
}

function normalizeFormat(format) {
    return formatAliases[format] ?? format;
}

async function isDirectory(path) {
    if (/[\\/]$/.test(path)) {
        return true;
    }
    const stat = await fs.stat(path).catch(() => null);
    return Boolean(stat?.isDirectory());
}

function collectPageErrors(page, { console: withConsole }) {
    const messages = new Map();
    page.on('pageerror', (e) => messages.set(e.message, 'error'));
    if (withConsole) {
        page.on('console', (message) => {
            const type = message.type();
            if (type === 'error' || type === 'warn') {
                messages.set(message.text(), type);
            }
        });
    }
    return messages;
}

function printPageErrors(messages, quiet) {
    for (const [text, type] of messages) {
        if (type === 'error') {
            log.error(text);
        } else if (!quiet) {
            log.warn(text);
        }
    }
}

function buildHTML(code, cssDoodleLib, seed) {
    const seedAttr = seed === undefined ? '' : ` seed="${escapeAttribute(seed)}"`;
    return `<!doctype html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            html, body, #container { margin: 0; padding: 0; width: 100%; height: 100% }
            body, #container { display: grid; place-items: center; }
        </style>
        <script>${cssDoodleLib}</script>
    </head>
    <body>
        <div id="container">
            <css-doodle${seedAttr}><template>${code}</template></css-doodle>
        </div>
    </body>
    </html>`;
}

function maybeHTML(str) {
    return /^\s*(<([a-z][a-z0-9-]*)\s*[^>]*\/?>|<![^>]+>|<\?[^>]+\?>)/i.test(str);
}

export { buildHTML, getOutputInfo, maybeHTML, processIfOutputExists };
