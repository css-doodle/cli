import fs from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const isLinux = os.platform() === 'linux';
const root = dirname(fileURLToPath(import.meta.url));
const configDir = join(os.homedir(), '.css-doodle');
const configFilePath = join(configDir, 'config.json');

if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
}

if (!fs.existsSync(configFilePath)) {
    fs.writeFileSync(configFilePath, '{}');
}

function read(path) {
    return fs.readFileSync(join(root, path), 'utf8');
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
    ];

    if (isLinux) {
        args.push('--no-sandbox', '--disable-setuid-sandbox');
    }

    return args;
}

export function getCssDoodleLib() {
    const libPath = config['css-doodle'];
    if (libPath) {
        if (fs.existsSync(libPath)) {
            return fs.readFileSync(libPath, 'utf8');
        } else {
            console.warn(`[warn] css-doodle not found: ${libPath}. Use default css-doodle instead.`);
            console.info('[info] Please check it with `config` command.\n');
        }
    }
    return read('../node_modules/css-doodle/css-doodle.min.js');
}

export function getBrowserPath() {
    const browserPath = config['browserPath']
        || config['browser-path']
        || config['executablePath']
        || config['executable-path'];
    if (browserPath) {
        if (fs.existsSync(browserPath)) {
            return browserPath;
        } else {
            console.warn(`[warn] Browser not found: ${browserPath}. Use default browser instead.`);
            console.info('[info] Please check it with `config` command.\n');
        }
    }
    return '';
}

export const config = JSON.parse(fs.readFileSync(configFilePath), 'utf8');
export const configPath = configFilePath;
export const pkg = JSON.parse(read('../package.json'));
export const previewClient = read('./preview/client.html');
export const previewServerPath = join(root, './preview/server.js');
export const defaultAppArgs = getDefaultAppArgs();
