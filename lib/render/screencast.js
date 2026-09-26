import fs from 'node:fs/promises';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { clearLine, style } from '../utils.js';

const defaultWindowWidth = 1200;
const defaultWindowHeight = 800;
const defaultScale = 1;

// Delay after viewport resize to ensure rendering is complete
const viewportSettleDelay = 200;

// Delay when element has no size, waiting for content to render
const elementRenderDelay = 1000;

export async function screencast(page, options) {
    const { scale, output, selector, windowWidth, windowHeight, format } = options;
    const WIDTH = windowWidth || defaultWindowWidth;
    const HEIGHT = windowHeight || defaultWindowHeight;
    const SCALE = scale || defaultScale;

    await page.setViewport({
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: SCALE,
    });

    await setTimeout(viewportSettleDelay);

    const castOption = {
        scale: SCALE,
        format: format || 'mp4',
        path: output,
    };

    const crop = await page.evaluate(
        async (selector, delay) => {
            const element = document.querySelector(selector);
            if (element) {
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
                const { width, height, x, y } = element.getBoundingClientRect();
                return {
                    x,
                    y,
                    width,
                    height: height || width,
                };
            }
        },
        selector,
        elementRenderDelay,
    );

    if (crop) {
        crop.x = Math.max(crop.x, 0) || 0;
        crop.y = Math.max(crop.y, 0) || 0;
        crop.width = Math.min(crop.width, WIDTH) || WIDTH;
        crop.height = Math.min(crop.height, HEIGHT) || HEIGHT;
        castOption.crop = crop;
        await page.setViewport({
            width: Math.max(WIDTH, parseInt(crop.x + crop.width)),
            height: Math.max(HEIGHT, parseInt(crop.y + crop.height)),
            deviceScaleFactor: SCALE,
        });
    }

    // Chrome only emits screencast frames when something repaints,
    // so static content would produce an empty video without this invisible ticker.
    await page.evaluate(() => {
        const ticker = document.createElement('div');
        ticker.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none';
        document.body.append(ticker);
        (function tick(t) {
            ticker.style.background = `rgba(0,0,0,${t % 2 ? 0.001 : 0.002})`;
            requestAnimationFrame(() => tick(t + 1));
        })(0);
    });

    const totalSeconds = Math.ceil(options.time / 1000);

    const updateStatus = (remaining) => {
        if (!options.quiet) {
            clearLine();
            process.stdout.write(style.green('●') + style.dim(` recording... (${remaining}s)`));
        }
    };

    let recorder;
    try {
        recorder = await page.screencast(castOption);
    } catch (e) {
        if (e.code === 'ENOENT') {
            throw new Error('ffmpeg is required for video output, please install it and make sure it is in your PATH');
        }
        throw e;
    }

    let remaining = totalSeconds;
    updateStatus(remaining);
    const interval = setInterval(() => {
        remaining = Math.max(remaining - 1, 0);
        updateStatus(remaining);
    }, 1000);

    try {
        await setTimeout(options.time);
    } finally {
        clearInterval(interval);
        await recorder.stop();
        if (!options.quiet) {
            clearLine();
        }
    }

    const { size } = await fs.stat(output).catch(() => ({ size: 0 }));
    if (!size) {
        throw new Error('no frames were captured, the recorded video is empty');
    }

    return output;
}
