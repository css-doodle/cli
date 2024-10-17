import { setTimeout } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const defaultWindowWidth = 1200;
const defaultWindowHeight = 900;
const defaultScale = 1;

export async function screencast(page, options) {
    const { scale, output, selector, windowWidth, windowHeight } = options;
    const WIDTH = windowWidth || defaultWindowWidth;
    const HEIGHT = windowHeight || defaultWindowHeight;
    const SCALE = scale || defaultScale;

    await page.setViewport({
        width: WIDTH,
        height: HEIGHT,
        defaultScaleFactor: SCALE
    });

    const castOption = {
        path: options.mp4
            ? join(tmpdir(), randomUUID() + '.webm')
            : output
    };

    const crop = await page.evaluate(async selector => {
        const element = document.querySelector(selector);
        if (element) {
            let rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                await setTimeout(1000);
            }
            const { width, height, x, y } = element.getBoundingClientRect();
            return {
                x, y,
                width,
                height: height || width,
            }
        }
    }, selector);

    if (crop) {
        crop.x = Math.max(crop.x, 0) || 0;
        crop.y = Math.max(crop.y, 0) || 0;
        crop.width = Math.min(crop.width, WIDTH) || WIDTH;
        crop.height = Math.min(crop.height, HEIGHT) || HEIGHT;
        castOption.crop = crop;
    }

    const recorder = await page.screencast(castOption);

    await setTimeout(options.time);
    await recorder.stop();

    if (options.mp4) {
        try {
            return await webmToMp4(pathFile, output);
        } catch (e) {
            throw e;
        }
    }

    return output;
}

function webmToMp4(input, output) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ['-i', input, '-c:v',  'copy', output]);
        ffmpeg.stdin.write('y\n');
        ffmpeg.stdin.end();
        ffmpeg.on('close', code => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`error: record failed, ffmpeg exited with code ${code}`));
            }
        });
    });
}
