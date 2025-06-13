import fs from 'node:fs/promises';
import os from 'node:os';
import process from 'node:process';
import { join, basename } from 'node:path';

import { msgError, msgWarning } from './message.js';
import pkgInfo from '../package.json' with { type: 'json' }

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
    console.warn(msgWarning(`Config directory ${configOldDir} is deprecated.\nMoving to ${configDir}.\n`));
    try {
        await fs.rename(configOldDir, configDir);
    } catch (e) {
        console.error(msgError(`Failed to move config directory: ${e.message}`));
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
        '--enable-experimental-web-platform-features',
        '--diable-extensions',
        '--enable-gpu-rasterization',
        '--enable-oop-rasterization',
        '--enable-webgl-draft-extensions',
        '--enable-composited-animations',
        '--enable-optimized-css',
        '--enable-accelerated-2d-canvas',
        '--enable-gpu',
        '--use-angle',
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
    if (libFile) {
        if (await checkExists(libFile)) {
            return await fs.readFile(libFile , 'utf8');
        } else {
            console.warn(msgWarning(`css-doodle in config not found: ${libFile}.\nUsed default css-doodle instead.\n`));
        }
    }
    return fs.readFile(join(import.meta.dirname, '../node_modules/css-doodle/css-doodle.min.js'));
}

export async function getBrowserPath() {
    const browserPath = config['browserPath']
        || config['browser-path']
        || config['executablePath']
        || config['executable-path'];
    if (browserPath) {
        if (await checkExists(browserPath)) {
            return browserPath;
        } else {
            console.warn(msgWarning(`browser in config not found: ${browserPath}.\nUsed default browser instead.\n`));
        }
    }
    return '';
}

export function checkExists(filePath) {
    return fs.access(filePath, fs.constants.F_OK).then(() => true).catch(() => false);
}

async function getConfigContent(configFilePath) {
    try {
        return JSON.parse(await fs.readFile(configFilePath), 'utf8');
    } catch (e) {
        console.error(msgError(`Failed to access config file: ${e.message}`));
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
