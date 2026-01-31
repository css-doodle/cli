import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

import puppeteer from 'puppeteer-core';

import { defaultAppArgs, previewServerPath } from '../static.js';
import { resolveBrowser } from '../browser.js';
import { log } from '../utils.js';

const SIZE = '600,628';

function cleanup(serverProcess, tempFile) {
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill();
    }
    if (tempFile) {
        fs.unlink(tempFile).catch(() => {});
    }
}

export async function preview(sourceFile, title, options = {}) {
    const source = sourceFile;
    let tempFile = null;

    if (options.fromStdin) {
        tempFile = join(tmpdir(), crypto.randomUUID());
        sourceFile = tempFile;
        try {
            await fs.writeFile(tempFile, source);
        } catch (_e) {
            log.error('failed to create temporary file for preview');
            process.exit(1);
        }
    }

    const serverProcess = spawn('node', [previewServerPath, sourceFile], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    // Ensure cleanup on parent exit
    const doCleanup = () => cleanup(serverProcess, tempFile);
    process.on('exit', doCleanup);
    process.on('SIGINT', doCleanup);
    process.on('SIGTERM', doCleanup);
    process.on('uncaughtException', (err) => {
        log.error(err.message);
        doCleanup();
        process.exit(1);
    });

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
                    doCleanup();
                    process.exit(1);
                });
        }

        if (message.exit) {
            doCleanup();
            process.exit(0);
        }
    });

    serverProcess.on('error', (e) => {
        log.error(`server process error: ${e.message}`);
        doCleanup();
        process.exit(1);
    });

    serverProcess.on('exit', (code) => {
        if (code !== 0) {
            log.error(`server process exited with code ${code}`);
        }
        doCleanup();
    });
}
