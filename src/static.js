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

export const config = JSON.parse(fs.readFileSync(configFilePath), 'utf8');
export const configPath = configFilePath;

export const pkg = JSON.parse(read('../package.json'));
export const cssDoodleLib = read('../node_modules/css-doodle/css-doodle.min.js');
export const previewClient = read('./preview/client.html');
export const previewServerPath = join(root, './preview/server.js');
export const defaultAppArgs = getDefaultAppArgs();
