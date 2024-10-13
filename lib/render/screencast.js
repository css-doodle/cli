import { setTimeout } from 'node:timers/promises';

export async function screencast(page, options) {
    const { scale, output, selector, windowWidth, windowHeight } = options;

    await page.setViewport({
        width: windowWidth,
        height: windowHeight,
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
        width: Math.ceil(clip.width) || windowWidth,
        height: Math.ceil(clip.height) || windowHeight,
    });

    const recorder = await page.screencast({
        path: output,
        scale,
        clip,
    });

    await setTimeout(options.time);
    await recorder.stop();
    return output;
}
