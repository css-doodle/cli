import { setTimeout } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { msgTip } from '../message.js';

const defaultWindowWidth = 1200;
const defaultWindowHeight = 800;
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

    await setTimeout(200);

    const castOption = {
        path: options.mp4
            ? join(tmpdir(), randomUUID() + '.webm')
            : output
    };

    const crop = await page.evaluate(async selector => {
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
          defaultScaleFactor: SCALE
        });
    }

    if (!options.quiet) {
        console.log(msgTip('Recording'));
    }
    const recorder = await page.screencast(castOption);

    await setTimeout(options.time);
    await recorder.stop();

    if (options.mp4) {
        try {
            return await webmToMp4(castOption.path, output);
        } catch (e) {
            throw e;
        }
    }

    return output;
}

function webmToMp4(input, output) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ['-i', input, '-c:v', 'copy', output]);
        ffmpeg.stdin.write('y\n');
        ffmpeg.stdin.end();
        ffmpeg.on('close', code => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`record failed, ffmpeg exited with code ${code}`));
            }
        });
    });
}
