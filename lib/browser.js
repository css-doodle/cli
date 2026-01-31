import os from 'node:os';
import { access, constants } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { Browser, detectBrowserPlatform, install } from '@puppeteer/browsers';
import { log } from './utils.js';
import { getBrowserPath, setBrowserPath } from './static.js';
import process from 'node:process';

const platform = os.platform();
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';

const BROWSER_PATHS = {
    darwin: {
        chrome: [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        ],
        chromium: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
        edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    },
    win32: {
        chrome: [
            join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
            join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
            join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
        ],
        chromium: [
            join(process.env.LOCALAPPDATA ?? '', 'Chromium/Application/chrome.exe'),
            join(process.env.PROGRAMFILES ?? '', 'Chromium/Application/chrome.exe'),
        ],
        edge: [
            join(process.env.LOCALAPPDATA ?? '', 'Microsoft/Edge/Application/msedge.exe'),
            join(process.env.PROGRAMFILES ?? '', 'Microsoft/Edge/Application/msedge.exe'),
        ],
    },
    linux: {
        chrome: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/google-chrome'],
        chromium: ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/lib/chromium/chromium', '/snap/bin/chromium'],
        edge: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'],
    },
};

const PATH_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];

function getPuppeteerCacheDir() {
    if (isWindows) {
        return join(process.env.LOCALAPPDATA || os.homedir(), 'puppeteer');
    }
    if (isMac) {
        return join(os.homedir(), 'Library', 'Caches', 'puppeteer');
    }
    return join(process.env.XDG_CACHE_HOME || join(os.homedir(), '.cache'), 'puppeteer');
}

async function exists(path) {
    if (!path) return false;
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function findInPath(cmd) {
    const pathDirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
    for (const dir of pathDirs) {
        const fullPath = join(dir, cmd);
        try {
            await access(fullPath, isWindows ? constants.F_OK : constants.X_OK);
            return fullPath;
        } catch {
            continue;
        }
    }
    return null;
}

export async function resolveBrowser(quiet = false) {
    const configPath = await getBrowserPath();
    if (configPath && await exists(configPath)) {
        return configPath;
    }

    const systemBrowser = await findSystemBrowser();
    if (systemBrowser) {
        if (!quiet) {
            log.info(`using system browser: ${systemBrowser}`);
        }
        await setBrowserPath(systemBrowser);
        return systemBrowser;
    }

    if (!quiet) {
        log.warn('no system browser found, downloading Chrome...');
    }
    const downloadedBrowser = await downloadBrowser(quiet);
    await setBrowserPath(downloadedBrowser);
    return downloadedBrowser;
}

async function findSystemBrowser() {
    const paths = BROWSER_PATHS[platform] ?? {};
    for (const browserPath of [...paths.chrome, ...paths.chromium, ...paths.edge]) {
        if (await exists(browserPath)) {
            return browserPath;
        }
    }

    if (!isWindows) {
        for (const cmd of PATH_COMMANDS) {
            const found = await findInPath(cmd);
            if (found) return found;
        }
    }

    return null;
}

async function downloadBrowser(quiet = false) {
    const browserPlatform = detectBrowserPlatform();
    if (!browserPlatform) {
        throw new Error(`unable to detect browser platform for ${platform}`);
    }

    try {
        const installed = await install({
            browser: Browser.CHROME,
            buildId: 'stable',
            cacheDir: getPuppeteerCacheDir(),
        });

        if (!quiet) {
            log.success(`downloaded Chrome: ${installed.executablePath}`);
        }

        return installed.executablePath;
    } catch (error) {
        throw new Error(`failed to download Chrome: ${error.message}`);
    }
}
