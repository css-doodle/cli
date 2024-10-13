import { setTimeout } from 'node:timers/promises';

import puppeteer from 'puppeteer';

import { getCssDoodleLib, getBrowserPath, defaultAppArgs } from '../static.js';
import { screenshot } from './screenshot.js';
import { screencast } from './screencast.js';

export async function render(code, options = {}) {
    const args = [
        ...defaultAppArgs,
        '--start-maximized',
    ];

    if (options.type === 'codepen') {
        args.push('--ignore-certificate-errors');
    }

    const settings = {
        defaultViewport: null,
        args,
    };

    let browserPath = getBrowserPath();
    if (browserPath) {
        settings.executablePath = browserPath;
    }

    const browser = await puppeteer.launch(settings);
    const page = await browser.newPage();

    switch (options.type) {
        case 'css': case 'cssd': case 'stdin': {
            page.setContent(buildHTML(code, getCssDoodleLib()));
            break;
        }
        case 'html': {
            page.setContent(code);
            break;
        }
        case 'codepen': {
            await page.goto(code);
            const iframe = await page.$('iframe#result');
            if (iframe) {
                const code = await page.evaluate(el => el.getAttribute('srcdoc'), iframe);
                page.setContent(code, { waitUntil: 'networkidle0' });
            } else {
                throw new Error('eroor: read CodePen failed');
            }
            break;
        }
        default: {
            throw new Error('error: invalid type `${options.type}`');
        }
    }

    if (!options.output) {
        let tag = Date.now();
        if (/^(css|cssd|stdin)$/.test(options.type)) {
            tag = await page.$eval('css-doodle', el => el.seed);
        }
        options.output = `${options.title || 'screenshot'}-${tag}.png`;
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
