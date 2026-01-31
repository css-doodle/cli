import os from 'node:os';
import { exec } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { install, Browser, detectBrowserPlatform } from '@puppeteer/browsers';
import { log, style } from './utils.js';
import { getBrowserPath, setBrowserPath } from './static.js';

const execAsync = promisify(exec);
const platform = os.platform();

/**
 * Resolve browser executable path in order of priority:
 * 1. User config (browserPath)
 * 2. System Chrome/Chromium/Edge
 * 3. Download Chrome to standard Puppeteer cache
 *
 * @param {boolean} quiet - Suppress log output
 * @returns {Promise<string>} Path to browser executable
 */
export async function resolveBrowser(quiet = false) {
    // 1. Check user config first (highest priority)
    const configPath = await getBrowserPath();
    if (configPath) {
        return configPath;
    }

    // 2. Check for system Chrome (most common case)
    const systemBrowser = await findSystemBrowser();
    if (systemBrowser) {
        if (!quiet) {
            log.info(`using system browser: ${systemBrowser}`);
        }
        // Save to config for future use
        await setBrowserPath(systemBrowser);
        return systemBrowser;
    }

    // 3. Download Chrome to standard Puppeteer cache
    if (!quiet) {
        log.warn('no system browser found, downloading Chrome...');
    }
    const downloadedBrowser = await downloadBrowser(quiet);
    // Save to config for future use
    await setBrowserPath(downloadedBrowser);
    return downloadedBrowser;
}

/**
 * Find system-installed browser (Chrome, Chromium, Edge)
 * @returns {Promise<string|null>} Browser path or null
 */
async function findSystemBrowser() {
    const browsers = [
        { name: 'google-chrome', paths: getChromePaths() },
        { name: 'chromium', paths: getChromiumPaths() },
        { name: 'microsoft-edge', paths: getEdgePaths() },
    ];

    for (const { paths } of browsers) {
        for (const browserPath of paths) {
            if (await exists(browserPath)) {
                return browserPath;
            }
        }
    }

    // Try 'which' command on Unix systems
    if (platform !== 'win32') {
        for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
            const path = await which(cmd);
            if (path) return path;
        }
    }

    return null;
}

/**
 * Get platform-specific Chrome paths
 */
function getChromePaths() {
    switch (platform) {
        case 'darwin':
            return [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
            ];
        case 'win32':
            return [
                join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
                join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
                join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
            ];
        case 'linux':
            return [
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/opt/google/chrome/google-chrome',
            ];
        default:
            return [];
    }
}

/**
 * Get platform-specific Chromium paths
 */
function getChromiumPaths() {
    switch (platform) {
        case 'darwin':
            return [
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
            ];
        case 'win32':
            return [
                join(process.env.LOCALAPPDATA || '', 'Chromium/Application/chrome.exe'),
                join(process.env.PROGRAMFILES || '', 'Chromium/Application/chrome.exe'),
            ];
        case 'linux':
            return [
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
                '/usr/lib/chromium/chromium',
                '/snap/bin/chromium',
            ];
        default:
            return [];
    }
}

/**
 * Get platform-specific Edge paths
 */
function getEdgePaths() {
    switch (platform) {
        case 'darwin':
            return [
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            ];
        case 'win32':
            return [
                join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe'),
                join(process.env.PROGRAMFILES || '', 'Microsoft/Edge/Application/msedge.exe'),
            ];
        case 'linux':
            return [
                '/usr/bin/microsoft-edge',
                '/usr/bin/microsoft-edge-stable',
            ];
        default:
            return [];
    }
}

/**
 * Check if file exists
 */
async function exists(path) {
    if (!path) return false;
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Try to find command in PATH using 'which'
 */
async function which(cmd) {
    try {
        const { stdout } = await execAsync(`which ${cmd}`);
        const path = stdout.trim();
        return await exists(path) ? path : null;
    } catch {
        return null;
    }
}

/**
 * Download Chrome browser using @puppeteer/browsers
 * Uses standard Puppeteer cache directory
 *
 * @param {boolean} quiet - Suppress log output
 */
async function downloadBrowser(quiet = false) {
    const browserPlatform = detectBrowserPlatform();

    if (!browserPlatform) {
        throw new Error(`unable to detect browser platform for ${platform}`);
    }

    try {
        const installed = await install({
            browser: Browser.CHROME,
            buildId: 'stable',
            cacheDir: undefined, // uses default Puppeteer cache
        });

        if (!quiet) {
            log.success(`downloaded Chrome: ${installed.executablePath}`);
        }

        return installed.executablePath;
    } catch (error) {
        throw new Error(`failed to download Chrome: ${error.message}`);
    }
}
