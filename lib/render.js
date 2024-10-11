import { setTimeout } from 'node:timers/promises';
import puppeteer from 'puppeteer';
import { config, getCssDoodleLib, getBrowserPath, defaultAppArgs } from './static.js';

export async function render(code, options = {}) {
    if (!options.selector) {
        options.selector = 'css-doodle';
    }

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
    const waitConfig = {
        waitUntil: 'networkidle0',
        timeout: 30 * 1000
    };

    if (/^(css|cssd|stdin)$/.test(options.type)) {
        await page.setContent(buildHTML(code, getCssDoodleLib()), waitConfig);
        const data = await page.$eval(options.selector, el => {
            return {
                seed: el.seed
            }
        });
        if (!options.output && data.seed) {
            options.output = `${options.title || 'screenshot'}-${data.seed}.png`;
        }
    }
    else if (options.type == 'html') {
        await page.setContent(code, waitConfig);
        options.output = `${options.title || 'screenshot'}-${Date.now()}.png`;
    }
    else if (options.type == 'codepen') {
        await page.goto(code, waitConfig);
        const src = await page.evaluate(() => {
            let element = document.querySelector('iframe#result');
            return element ? element.getAttribute('srcdoc') : '';
        });
        await page.setContent(src, waitConfig);
        options.output = `${options.title || 'screenshot'}-${Date.now()}.png`;
    }

    if (options.delay) {
        await setTimeout(parseInt(options.delay, 10));
    }

    const output = await screenshot(page, options);
    await browser.close();
    return output;
}

function buildHTML(code, cssDoodleLib) {
    return `
    <!DOCTYPE html>
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

async function screenshot(page, options = {}) {
    const scale = parseInt(options.scale, 10) || 2;
    const output = options.output || 'output.png';
    const selector = options.selector;
    const W = 1600;
    const H = 900;

    await page.setViewport({
        width: W,
        height: H,
        deviceScaleFactor: scale
    });

    const info = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (element) {
            const { width, height } = element.getBoundingClientRect();
            return {
                width,
                height: height || width,
                node: true
            };
        } else {
            const doc = document.documentElement;
            return {
                width: doc.scrollWidth,
                height: doc.scrollHeight,
                node: false
            };
        }
    }, selector);

    await page.setViewport({
        width: Math.ceil(info.width) || W,
        height: Math.ceil(info.height) || H,
        deviceScaleFactor: scale
    });

    if (info.node) {
        const element = await page.$(selector);
        await element.screenshot({
            path: output,
            omitBackground: true
        });
    } else {
        await page.screenshot({
            path: output,
            fullPage: true
        });
    }

    return output;
}
