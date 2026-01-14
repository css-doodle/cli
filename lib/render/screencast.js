import { setTimeout } from 'node:timers/promises';
import { style } from '../utils.js';

const defaultWindowWidth = 1200;
const defaultWindowHeight = 800;
const defaultScale = 1;

export async function screencast(page, options) {
    const { scale, output, selector, windowWidth, windowHeight, format } = options;
    const WIDTH = windowWidth || defaultWindowWidth;
    const HEIGHT = windowHeight || defaultWindowHeight;
    const SCALE = scale || defaultScale;

    await page.setViewport({
        width: WIDTH,
        height: HEIGHT,
        defaultScaleFactor: SCALE,
    });

    await setTimeout(200);

    const castOption = {
        scale: SCALE,
        format: format || 'mp4',
        path: output,
    };

    const crop = await page.evaluate(async (selector) => {
        const element = document.querySelector(selector);
        if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                await setTimeout(1000);
            }
            const { width, height, x, y } = element.getBoundingClientRect();
            return {
                x,
                y,
                width,
                height: height || width,
            };
        }
    }, selector);

    if (crop) {
        crop.x = Math.max(crop.x, 0) || 0;
        crop.y = Math.max(crop.y, 0) || 0;
        crop.width = Math.min(crop.width, WIDTH) || WIDTH;
        crop.height = Math.min(crop.height, HEIGHT) || HEIGHT;
        castOption.crop = crop;
        await page.setViewport({
            width: Math.max(WIDTH, parseInt(crop.x + crop.width)),
            height: Math.max(HEIGHT, parseInt(crop.y + crop.height)),
            defaultScaleFactor: SCALE,
        });
    }

    if (!options.quiet) {
        console.log(style.dim('recording...'));
    }
    const recorder = await page.screencast(castOption);

    await setTimeout(options.time);
    await recorder.stop();
    return output;
}
