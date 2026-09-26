import { setTimeout } from 'node:timers/promises';
import { extname } from 'node:path';

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

    try {
        const page = await browser.newPage();
        let isDoodle = false;

        switch (options.type) {
            case 'css':
            case 'cssd':
            case 'stdin': {
                if (options.type === 'stdin' && maybeHTML(code)) {
                    warnIgnoredSeed(options);
                    await setContentAndWait(page, code);
                } else {
                    await page.setContent(buildHTML(code, await getCssDoodleLib(), options.seed));
                    isDoodle = true;
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

        const outputInfo = getOutputInfo(options);
        options.format = outputInfo.format;

        if (outputInfo.type === 'video' && !options.time) {
            options.time = 5 * 1000;
        }
        if (!options.title) {
            options.title = outputInfo.type === 'video' ? 'record' : 'image';
        }
        if (!options.output) {
            let tag = Date.now();
            if (isDoodle) {
                tag = await page.$eval('css-doodle', (el) => el.seed);
            }
            options.output = `${options.title}-${String(tag).replace(/[^\w.-]+/g, '-')}.${options.format}`;
        }

        const proceed = await processIfOutputExists(options.output, options.yes);
        if (!proceed) {
            return;
        }
        if (options.delay) {
            await setTimeout(options.delay);
        }

        return outputInfo.type === 'video' ? await screencast(page, options) : await screenshot(page, options);
    } finally {
        await browser.close();
    }
}

// setContent() no longer supports `networkidle*` in waitUntil,
// so wait for external resources separately.
async function setContentAndWait(page, html) {
    await page.setContent(html);
    await page.waitForNetworkIdle();
}

async function processIfOutputExists(output, yes) {
    if (!await checkExists(output)) {
        return true;
    }
    if (yes) {
        return true;
    }
    // In non-TTY environments (e.g., CI), can't prompt
    if (!process.stdout.isTTY) {
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
    let format = typeof options.format === 'string' ? options.format.toLowerCase() : '';
    const output = options.output;
    const time = options.time;
    const allFormats = Object.values(supportedOutputFormat).flat();

    if (format && !allFormats.includes(format)) {
        throw new Error(
            `unrecognized format '${format}', supported formats are: ${allFormats.join(', ')}`,
        );
    }
    if (output) {
        let ext = extname(output).slice(1).toLowerCase();
        if (ext && allFormats.includes(ext)) {
            if (format && format !== ext) {
                throw new Error(`conflicting format '${format}' and output extension '${ext}'`);
            } else {
                format = ext;
            }
        } else {
            ext = format || (time ? 'mp4' : 'png');
            options.output += '.' + ext;
        }
    }
    if (!format) {
        format = time ? 'mp4' : 'png';
    }
    const type = supportedOutputFormat.image.includes(format) ? 'image' : 'video';

    if (type === 'image' && time) {
        log.warn('time option is ignored for image formats.');
    }

    return {
        type,
        format,
    };
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
