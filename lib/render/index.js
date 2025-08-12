import { setTimeout } from 'node:timers/promises';
import { extname } from 'node:path';

import puppeteer from 'puppeteer';

import { getCssDoodleLib, getBrowserPath, defaultAppArgs } from '../static.js';
import { screenshot } from './screenshot.js';
import { screencast } from './screencast.js';
import { msgTip } from '../message.js';

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
        case 'css': case 'cssd': case 'stdin': {
            await page.setContent(buildHTML(code, await getCssDoodleLib()));
            break;
        }
        case 'codepen': {
            if (!options.quiet) {
                console.log(msgTip('Fetching from CodePen'));
            }
            await page.goto(code);
            const iframe = await page.$('iframe#result');
            if (iframe) {
                const code = await page.evaluate(el => el.getAttribute('srcdoc'), iframe);
                await page.setContent(code, { waitUntil: 'networkidle0' });
            } else {
                throw new Error('read CodePen failed');
            }
            break;
        }
        case 'webpage': case 'html': {
            if (!options.quiet) {
                console.log(msgTip(`opening ${code}`));
            }
            await page.goto(code, {
                waitUntil: 'networkidle2'
            });
            break;
        }
        default: {
            throw new Error(`invalid type '${options.type}'`);
        }
    }

    const outputInfo = getOutputInfo(options);
    options.format = outputInfo.format;

    if (!options.output) {
        let tag = Date.now();
        if (/^(css|cssd|stdin)$/.test(options.type)) {
            tag = await page.$eval('css-doodle', el => el.seed);
        }
        options.output = `${options.title}-${tag}.${options.format}`;
    }

    if (outputInfo.type === 'video' && !options.time) {
        options.time = 5 * 1000;
    }

    if (options.delay) {
        await setTimeout(options.delay);
    }

    const output = options.time
        ? await screencast(page, options)
        : await screenshot(page, options);

    await browser.close();
    return output;
}

function getOutputInfo(options = {}) {
    let { format, output, time } = options;
    const allFormats = Object.values(supportedOutputFormat).flat();

    // Determine format based on output file extension
    if (output) {
        const ext = extname(output).slice(1).toLowerCase();
        if (ext) {
            if (allFormats.includes(ext)) {
                format = ext;
            }
        }
    } else {
        if (format && !allFormats.includes(format.toLowerCase())) {
            throw new Error(`unrecognized format '${format}', supported formats are: ${allFormats.join(', ')}`);
        }
        format = format ? format.toLowerCase() : null;
    }

    if (time) {
        if (format && !supportedOutputFormat.video.includes(format)) {
            throw new Error(`time option is only supported for video formats: ${supportedOutputFormat.video.join(', ')}`);
        }
        if (!format) {
            format = 'mp4'; // default to mp4 if no output specified
        }
    } else {
        if (!format) {
            format = 'png'; // default to png if no output specified
        }
    }
    return {
        type: supportedOutputFormat.image.includes(format) ? 'image' : 'video',
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
