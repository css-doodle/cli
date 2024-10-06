import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

import puppeteer from 'puppeteer';

import { previewServerPath, defaultAppArgs, config } from '../static.js';

const SIZE = '600,628';

export function preview(sourceFile, title, options = {}) {
    const serverProcess = spawn('node', [previewServerPath, sourceFile], {
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    serverProcess.unref();

    serverProcess.on('message', (message) => {
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

            if (config.browserPath) {
                settings.executablePath = config.browserPath;
            }

            puppeteer.launch(settings)
                .catch(e => {
                    console.log(e.message);
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
