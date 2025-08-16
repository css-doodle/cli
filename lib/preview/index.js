import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

import puppeteer from 'puppeteer';

import { previewServerPath, getBrowserPath, defaultAppArgs } from '../static.js';
import { style } from '../style.js';

const SIZE = '600,628';

export async function preview(sourceFile, title, options = {}) {
    const source = sourceFile;
    if (options.fromStdin) {
        sourceFile = join(tmpdir(), crypto.randomUUID());
        try {
            await fs.writeFile(sourceFile, source);
        } catch (_e) {
            console.error(style.red('failed to create a temporary file for preview'));
            process.exit(1);
        }
    }

    const serverProcess = spawn('node', [previewServerPath, sourceFile], {
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
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

            const settings = {
                headless: false,
                waitForInitialPage: false,
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    ...args,
                    ...defaultAppArgs,
                ],
            };

            const browserPath = await getBrowserPath();
            if (browserPath) {
                settings.executablePath = browserPath;
            }

            puppeteer.launch(settings)
                .catch(e => {
                    console.error(e.message);
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
