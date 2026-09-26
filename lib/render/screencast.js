import fs from 'node:fs/promises';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { clearLine, log, style } from '../utils.js';

const defaultWindowWidth = 1200;
const defaultWindowHeight = 800;
const defaultScale = 1;

// Delay after viewport resize to ensure rendering is complete
const viewportSettleDelay = 200;

// Delay when element has no size, waiting for content to render
const elementRenderDelay = 1000;

// Formats that still go through the deprecated ffmpeg-based page.screencast()
const legacyFormats = ['gif', 'webm'];

export async function screencast(page, options) {
    const { output, selector, windowWidth, windowHeight, quiet } = options;
    const format = options.format || 'mp4';
    const legacy = legacyFormats.includes(format);
    const WIDTH = windowWidth || defaultWindowWidth;
    const HEIGHT = windowHeight || defaultWindowHeight;
    const SCALE = options.scale || defaultScale;

    if (legacy && !quiet) {
        log.warn(`${format} output is deprecated and will be removed in a future version, use mp4 instead.`);
    }

    await page.setViewport({
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: SCALE,
    });

    await setTimeout(viewportSettleDelay);

    const rect = await getElementRect(page, selector);
    const castOptions = { ...options, format, WIDTH, HEIGHT, SCALE };

    const startRecording = legacy ? () => startScreencast(page, rect, castOptions) : () => startRecord(page, rect, castOptions);

    const totalSeconds = Math.ceil(options.time / 1000);

    const updateStatus = (remaining) => {
        if (!quiet) {
            clearLine();
            process.stdout.write(style.green('●') + style.dim(` recording... (${remaining}s)`));
        }
    };

    const recorder = await startRecording();

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
        if (!quiet) {
            clearLine();
        }
    }

    const { size } = await fs.stat(output).catch(() => ({ size: 0 }));
    if (!size) {
        throw new Error('no frames were captured, the recorded video is empty');
    }

    return output;
}

async function getElementRect(page, selector) {
    return await page.evaluate(
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
}

async function startRecord(page, rect, options) {
    const { SCALE, selector } = options;
    let width = options.WIDTH;
    let height = options.HEIGHT;
    let clip = getClip(rect, width, height);

    // Content outside the layout viewport isn't painted, so grow it to fit the element.
    if (clip.x + clip.width > width || clip.y + clip.height > height) {
        width = Math.max(width, Math.ceil(clip.x + clip.width));
        height = Math.max(height, Math.ceil(clip.y + clip.height));
        await page.setViewport({ width, height, deviceScaleFactor: SCALE });
        await setTimeout(viewportSettleDelay);
        clip = getClip(await getElementRect(page, selector), width, height);
    }

    // page.record() has no crop option, so limit the visible area to the element
    // without changing the layout viewport the page sees.
    const session = await page.createCDPSession();
    await session.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: SCALE,
        mobile: false,
        viewport: { ...clip, scale: 1 },
    });
    await setTimeout(viewportSettleDelay);

    try {
        // Frames are capped to 800x600 unless the max size is set explicitly.
        return await page.record({
            path: options.output,
            maxWidth: Math.ceil(clip.width * SCALE),
            maxHeight: Math.ceil(clip.height * SCALE),
        });
    } catch (e) {
        if (/startScreenRecording.*wasn't found/.test(e.message)) {
            throw new Error('the browser does not support screen recording, please update it to the latest version');
        }
        throw e;
    }
}

export function getClip(rect, width, height) {
    if (rect?.width && rect?.height) {
        return { x: Math.max(rect.x, 0), y: Math.max(rect.y, 0), width: rect.width, height: rect.height };
    }
    return { x: 0, y: 0, width, height };
}

/** @deprecated Remove together with gif/webm output. */
async function startScreencast(page, crop, options) {
    const { WIDTH, HEIGHT, SCALE } = options;

    const castOption = {
        scale: SCALE,
        format: options.format,
        path: options.output,
    };

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

    try {
        return await page.screencast(castOption);
    } catch (e) {
        if (e.code === 'ENOENT') {
            throw new Error(`ffmpeg is required for ${options.format} output, please install it and make sure it is in your PATH`);
        }
        throw e;
    }
}
