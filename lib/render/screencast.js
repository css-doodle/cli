import { setTimeout } from 'node:timers/promises';

const defaultWidth = 1600;
const defaultHeight = 900;

export async function screencast(page, options) {
    let { scale, output, selector } = options;

    await page.setViewport({
        width: defaultWidth,
        height: defaultHeight,
        deviceScaleFactor: scale
    });

    const clip = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (element) {
            const { width, height, x, y } = element.getBoundingClientRect();
            return {
                x, y,
                width,
                height: height || width,
            }
        } else {
            const doc = document.documentElement;
            return {
                x: 0, y: 0,
                width: doc.scrollWidth,
                height: doc.scrollHeight,
            }
        }
    }, selector);

    await page.setViewport({
        width: Math.ceil(clip.width) || defaultWidth,
        height: Math.ceil(clip.height) || defaultHeight,
        deviceScaleFactor: scale
    });

    output = options.output.replace(/\.png$/, '.webm');
    const recorder = await page.screencast({
        path: output,
        scale: scale,
        clip
    });

    await setTimeout(options.time);
    await recorder.stop();
    return output;
}
