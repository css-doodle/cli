import { setTimeout } from 'node:timers/promises';
import { exec } from 'node:child_process';

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

    const recorder = await page.screencast({
        path: output,
        crop,
    });

    await setTimeout(options.time);
    await recorder.stop();

    if (options.mp4) {
        try {
            return await webmToMp4(output);
        } catch (e) {
            throw e;
        }
    }

    return output;
}

function webmToMp4(input) {
    const output = input.replace('.webm', '.mp4');
    return new Promise((resolve, reject) => {
        exec(`echo -y | ffmpeg -i ${input} -c:v copy ${output}`, (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                resolve(output);
            }
        });
    });
}
