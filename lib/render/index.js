import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { extname } from 'node:path';
import readline from 'node:readline';
import process from 'node:process';

import puppeteer from 'puppeteer';

import { defaultAppArgs, getBrowserPath, getCssDoodleLib } from '../static.js';
import { screenshot } from './screenshot.js';
import { screencast } from './screencast.js';
import { style } from '../utils.js';

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

    const settings = {
        defaultViewport: null,
        args,
    };

    const browserPath = await getBrowserPath();
    if (browserPath) {
        settings.executablePath = browserPath;
    }

    const browser = await puppeteer.launch(settings);
    const page = await browser.newPage();

    switch (options.type) {
        case 'css':
        case 'cssd':
        case 'stdin': {
            if (options.type === 'stdin' && maybeHTML(code)) {
                await page.setContent(code, { waitUntil: 'networkidle0' });
            } else {
                await page.setContent(buildHTML(code, await getCssDoodleLib()));
            }
            break;
        }
        case 'codepen': {
            if (!options.quiet) {
                console.log(style.dim('Fetching from CodePen...'));
            }
            await page.goto(code);
            const iframe = await page.$('iframe#result');
            if (iframe) {
                const code = await page.evaluate((el) => el.getAttribute('srcdoc'), iframe);
                await page.setContent(code, { waitUntil: 'networkidle0' });
            } else {
                throw new Error('read CodePen failed');
            }
            break;
        }
        case 'webpage':
        case 'html': {
            if (!options.quiet) {
                console.log(style.dim(`Opening ${code}...`));
            }
            await page.goto(code, {
                waitUntil: 'networkidle2',
            });
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
        if (/^(css|cssd)$/.test(options.type)) {
            tag = await page.$eval('css-doodle', (el) => el.seed);
        }
        options.output = `${options.title}-${tag}.${options.format}`;
    }

    const proceed = await processIfOutputExists(options.output);
    if (!proceed) {
        await browser.close();
        console.log(style.yellow('Aborted'));
        process.exit(0);
    }
    if (options.delay) {
        await setTimeout(options.delay);
    }

    const output = outputInfo.type === 'video' ? await screencast(page, options) : await screenshot(page, options);
    await browser.close();
    return output;
}

async function processIfOutputExists(output) {
    try {
        await fs.access(output, fs.constants.F_OK);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const answer = await new Promise((resolve) =>
            rl.question(
                style.dim(`"${output}" already exists. Do you want to overwrite it? (y/n): `),
                resolve,
            )
        );
        rl.close();
        return answer.toLowerCase() === 'y';
    } catch (_e) {
        return true;
    }
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
        console.warn(
            style.yellow('Time option is ignored for image formats.'),
        );
    }

    return {
        type,
        format,
    };
}

function buildHTML(code, cssDoodleLib) {
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
            <css-doodle><template>${code}</template></css-doodle>
        </div>
    </body>
    </html>`;
}

function maybeHTML(str) {
    return /^\s*(<([a-z][a-z0-9-:]*)\s*[^>]*\/?>|<![^>]+>|<\?[^>]+\?>)/i.test(str);
}
