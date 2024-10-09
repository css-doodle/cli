import puppeteer from 'puppeteer';
import { config, getCssDoodleLib, getBrowserPath, defaultAppArgs } from './static.js';

export async function render(code, options = {}) {
    options.selector ??= 'css-doodle';

    const settings = {
        args: defaultAppArgs
    };

    let browserPath = getBrowserPath();
    if (browserPath) {
        settings.executablePath = browserPath;
    }

    const browser = await puppeteer.launch(settings);

    const page = await browser.newPage();
    await page.setContent(buildHTML(code, getCssDoodleLib(), options), {
        waitUntil: 'networkidle0',
        timeout: 10 * 1000
    });

    const data = await page.$eval(options.selector, el => {
        return {
            seed: el.seed
        }
    });

    if (!options.output && data.seed) {
        options.output = `${options.title || 'screenshot'}-${data.seed}.png`;
    }

    await screenshotDOMElement(page, options);
    await browser.close();
    return options.output;
}

function buildHTML(code, cssDoodleLib, options = {}) {
    return `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            <style>* { padding: 0; margin: 0 }</style>
            <script>${cssDoodleLib}</script>
        </head>
        <body data-selector="${options.selector}">
            <css-doodle>${code}</css-doodle>
        </body>
    </html>`;
}

async function screenshotDOMElement(page, options = {}) {
    const padding = 'padding' in options ? options.padding : 0;
    const scale = options.scale || 1;
    const output = options.output || 'output.png';
    options.output = output;
    let selector = options.selector;

    const rect = await page.evaluate(() => {
        let element = document.querySelector(document.body.dataset.selector);
        if (!element) {
            element = document.body;
        }
        const { x, y, width, height } = element.getBoundingClientRect();
        return {
            left: x, top: y,
            width, height: height || width
        };
    });

    await page.setViewport({
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        deviceScaleFactor: parseInt(scale)
    });

    return await page.screenshot({
        path: output,
        omitBackground: true,
        clip: {
            x: rect.left - padding,
            y: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2
        }
    });
}
