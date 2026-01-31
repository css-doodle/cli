import fs from 'node:fs/promises';
import os from 'node:os';
import process from 'node:process';
import { basename, join } from 'node:path';
import { checkExists, log } from './utils.js';

import pkgInfo from '../package.json' with { type: 'json' };

const isLinux = os.platform() === 'linux';
const configRoot = join(os.homedir(), '.config');
const configDir = join(configRoot, 'css-doodle');
const configFilePath = join(configDir, 'config.json');
const configDownloadDir = join(configDir, 'download');

if (!await checkExists(configRoot)) {
    await fs.mkdir(configRoot);
}

const configOldDir = join(os.homedir(), '.css-doodle');

if (await checkExists(configOldDir) && !await checkExists(configDir)) {
    log.warn(`config directory ${configOldDir} is deprecated.\nMoving to ${configDir}.\n`);
    try {
        await fs.rename(configOldDir, configDir);
    } catch (e) {
        log.error(`failed to move config directory: ${e.message}`);
    }
}

if (!await checkExists(configDir)) {
    await fs.mkdir(configDir);
}

if (!await checkExists(configDownloadDir)) {
    await fs.mkdir(configDownloadDir);
}

if (!await checkExists(configFilePath)) {
    await fs.writeFile(configFilePath, '{}');
}

function getDefaultAppArgs() {
    const args = [
        '--disable-infobars',
        '--disable-extensions',
        '--disable-gpu-driver-bug-workarounds',
        '--disable-zero-copy',
        '--enable-experimental-web-platform-features',
        '--enable-gpu-rasterization',
        '--enable-oop-rasterization',
        '--enable-webgl-draft-extensions',
        '--enable-composited-animations',
        '--enable-optimized-css',
        '--enable-accelerated-2d-canvas',
        '--enable-gpu',
        '--ignore-gpu-blocklist',
    ];

    if (isLinux) {
        args.push('--no-sandbox', '--disable-setuid-sandbox');
    }

    return args;
}

function getPackageInfo() {
    const name = basename(process.argv[1]);
    const programName = pkgInfo.bin?.[name] ? name : 'cssd';
    return Object.assign(pkgInfo, { programName });
}

export async function getCssDoodleLib() {
    const libFile = config['css-doodle'];
    if (libFile && await checkExists(libFile)) {
        if (libFile.endsWith('.js')) {
            return await fs.readFile(libFile, 'utf8');
        } else {
            const altPath = join(libFile, 'css-doodle.min.js');
            if (await checkExists(altPath)) {
                return await fs.readFile(altPath, 'utf8');
            }
        }
    }
    log.warn(
        `css-doodle in config not found: ${libFile}.\nUsed default css-doodle instead.\n`,
    );
    return fs.readFile(join(import.meta.dirname, '../node_modules/css-doodle/css-doodle.min.js'));
}

export async function getBrowserPath() {
    const browserPath = config['browserPath'] ||
        config['browser-path'] ||
        config['executablePath'] ||
        config['executable-path'];
    if (browserPath && await checkExists(browserPath)) {
        return browserPath;
    }
    return '';
}

export async function setBrowserPath(browserPath) {
    config['browserPath'] = browserPath;
    try {
        await fs.writeFile(configFilePath, JSON.stringify(config, null, 2));
    } catch (e) {
        log.error(`failed to save browser path to config: ${e.message}`);
        process.exit(1);
    }
}

async function getConfigContent(configFilePath) {
    try {
        return JSON.parse(await fs.readFile(configFilePath, 'utf8'));
    } catch (e) {
        log.error(`failed to access config file: ${e.message}`);
        return {};
    }
}

export const config = await getConfigContent(configFilePath);
export const configPath = configFilePath;
export const configDownloadPath = configDownloadDir;

export const previewClient = await fs.readFile(join(import.meta.dirname, './preview/client.html'));
export const previewServerPath = join(import.meta.dirname, './preview/server.js');
export const defaultAppArgs = getDefaultAppArgs();
export const pkg = getPackageInfo();
