import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

import puppeteer from 'puppeteer-core';

import { defaultAppArgs, previewServerPath } from '../static.js';
import { resolveBrowser } from '../browser.js';
import { log, style } from '../utils.js';

const SIZE = '600,628';

export async function preview(sourceFile, title, options = {}) {
    const source = sourceFile;
    if (options.fromStdin) {
        sourceFile = join(tmpdir(), crypto.randomUUID());
        try {
            await fs.writeFile(sourceFile, source);
        } catch (_e) {
            log.error('failed to create temporary file for preview');
            process.exit(1);
        }
    }

    const serverProcess = spawn('node', [previewServerPath, sourceFile], {
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    serverProcess.unref();

    serverProcess.on('message', async (message) => {
        if (message.info) {
            console.log(message.info);
        }
        if (message.url) {
            const params = new URLSearchParams();
            params.set('title', title);
            params.set('instance', crypto.randomUUID());

            if (options.fullscreen) {
                params.set('fullscreen', '1');
            }

            const args = [
                `--window-size=${SIZE}`,
                `--app=${message.url}?${params.toString()}`,
            ];

            if (options.fullscreen) {
                args.push('--start-fullscreen');
            }

            if (options.showFpsCounter) {
                args.push('--show-fps-counter');
            }

            if (options.showPaintRects) {
                args.push('--show-paint-rects');
            }

            const executablePath = await resolveBrowser(options.quiet);

            const settings = {
                headless: false,
                waitForInitialPage: false,
                ignoreDefaultArgs: ['--enable-automation'],
                executablePath,
                args: [
                    ...args,
                    ...defaultAppArgs,
                ],
            };

            puppeteer.launch(settings)
                .catch((e) => {
                    log.error(e.message);
                    serverProcess.kill();
                    process.exit(1);
                });
        }

        if (message.exit) {
            serverProcess.kill();
            process.exit(0);
        }
    });
}
