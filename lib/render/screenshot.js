import { setTimeout } from 'node:timers/promises';

const defaultWindowWidth = 1600;
const defaultWindowHeight = 1000;
const defaultScale = 2;

export async function screenshot(page, options = {}) {
    const { scale, output, selector, windowWidth, windowHeight } = options;
    const WIDTH = windowWidth ?? defaultWindowWidth;
    const HEIGHT = windowHeight ?? defaultWindowHeight;
    const SCALE = scale || defaultScale;

    await page.setViewport({
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: SCALE
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
        width: Math.ceil(info.width) || WIDTH,
        height: Math.ceil(info.height) || HEIGHT,
        deviceScaleFactor: SCALE
    });

    await setTimeout(200);

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
