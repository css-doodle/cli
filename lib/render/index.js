import { setTimeout } from 'node:timers/promises';

import puppeteer from 'puppeteer';

import { getCssDoodleLib, getBrowserPath, defaultAppArgs } from '../static.js';
import { screenshot } from './screenshot.js';
import { screencast } from './screencast.js';
import { msgTip } from '../message.js';

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

    if (!options.output) {
        let tag = Date.now();
        if (/^(css|cssd|stdin)$/.test(options.type)) {
            tag = await page.$eval('css-doodle', el => el.seed);
        }
        let ext = options.time ? 'webm' : 'png';
        if (ext === 'webm' && options.mp4) {
            ext = 'mp4';
        }
        options.output = `${options.title}-${tag}.${ext}`;
    }

    if (/\.(mp4|webm)$/.test(options.output) && !options.time) {
        options.time = 5 * 1000;
    }

    if (options.output.endsWith('.mp4')) {
        options.mp4 = true;
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
