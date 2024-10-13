import { setTimeout } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function screencast(page, options) {
    const { scale, output, selector, windowWidth, windowHeight } = options;

    await page.setViewport({
        width: windowWidth,
        height: windowHeight,
        defaultScaleFactor: scale
    });

    const crop = await page.evaluate(selector => {
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

    let pathFile = options.mp4
        ? join(tmpdir(), randomUUID() + '.webm')
        : output;

    const recorder = await page.screencast({
        path: pathFile,
        crop,
    });

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
