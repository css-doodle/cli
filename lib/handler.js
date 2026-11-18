import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { config, configDownloadPath, configPath, getBrowserPath, pkg } from './static.js';
import { generateShape, generateSVG } from './generate.js';
import { parse } from './parse.js';
import { preview } from './preview/index.js';
import { prepareOutput, render } from './render/index.js';
import { read } from './read.js';
import { checkExists, clearRow, log, readTime, style, suggestSimilar } from './utils.js';

export async function handleRender(source, options) {
    options.delay = readTimeOption('delay', options.delay, 30 * 1000, options.quiet);
    options.time = readTimeOption('time', options.time, 60 * 1000, options.quiet);
    if (options.window) {
        const { width, height } = parseWindowSize(options.window);
        options.windowWidth = width;
        options.windowHeight = height;
    }
    if (options.scale) {
        options.scale = parseScale(options.scale);
    }

    let output;
    let start;
    if (await prepareOutput(options)) {
        const { content, type } = await read(source);
        options.type = type;
        options.title = getTitle(source, type);
        start = Date.now();
        output = await render(content, options);
    }
    if (!output) {
        if (!options.quiet) {
            log.warn('aborted');
        }
        return;
    }
    const time = (Date.now() - start) / 1000;
    if (!options.quiet) {
        const outputTime = `(${time}s)`;
        console.log(`${style.green('✓ saved')} to ${output} ${style.dim(outputTime)}`);
    }
}

export async function handleParse(source) {
    const { content } = await read(source);
    console.log(JSON.stringify(await parse(content), null, 2));
}

export async function handlePreview(source, options) {
    if (options.window) {
        options.windowSize = parseWindowSize(options.window);
    }
    const fromStdin = source === undefined || source === '-';
    let content, type;
    try {
        const result = await read(source);
        content = result.content;
        type = result.type;
    } catch (e) {
        if (e.message === 'empty input' && fromStdin && process.stdin.isTTY) {
            content = '';
            type = 'css';
        } else {
            throw e;
        }
    }

    if (type === 'codepen' || type === 'html' || type === 'webpage') {
        throw new Error('only .css and .cssd files are supported for preview');
    }
    if (fromStdin) {
        options.fromStdin = true;
        await preview(content, 'css-doodle', options);
    } else if (type === 'doodle') {
        options.fromStdin = true;
        await preview(content, getTitle(source, type), options);
    } else {
        const title = path.basename(source);
        await preview(source, title, options);
    }
}

export async function handleGenerateSVG(source, options = {}) {
    let { content } = await read(source);
    content = content.trim();
    if (/^svg\s*\{/i.test(content) || !content.length) {
        console.log(await generateSVG(content, { seed: options.seed }));
    } else {
        throw new Error('invalid SVG format');
    }
}

export async function handleGenerateShape(source) {
    const { content } = await read(source);
    console.log(await generateShape(content));
}

export async function handleSetConfig(field, value) {
    field = checkConfigField(field);
    if (value === '') {
        return handleUnsetConfig(field);
    }
    if (field === 'css-doodle') {
        if (value === 'bundled') {
            delete config[field];
            const version = await getBundledCssDoodleVersion();
            await saveConfig(`using the bundled css-doodle${version ? `@${version}` : ''}`);
            return;
        }
        if (await checkExists(value)) {
            if (!await isValidCssDoodleFile(value)) {
                throw new Error(`invalid css-doodle package file '${value}'`);
            }
            config[field] = path.resolve(value);
        } else if (isPackageVersion(value)) {
            const { dir, version } = await fetchCssDoodleSource(value);
            config[field] = dir;
            await saveConfig(`using css-doodle@${version}`);
            return;
        } else {
            throw new Error(`invalid package version '${value}'`);
        }
    } else if (field === 'browserPath') {
        config[field] = await resolveBrowserExecutable(value);
        deleteBrowserPathAliases();
    }
    await saveConfig();
}

export async function handleUnsetConfig(field) {
    field = normalizeConfigField(field);
    if (!Object.hasOwn(config, field)) {
        checkConfigField(field);
    }
    delete config[field];
    if (field === 'browserPath') {
        deleteBrowserPathAliases();
    }
    await saveConfig();
}

export async function handleUseAction(version) {
    await handleSetConfig('css-doodle', version);
}

export async function handleDisplayConfig(field) {
    field = checkConfigField(field);
    const value = field === 'browserPath' ? await getBrowserPath() : config[field];
    console.log(value ?? '');
}

export async function handleDisplayConfigList() {
    const displayConfig = { ...config };
    const browserPath = await getBrowserPath();
    displayConfig.browserPath = browserPath || '(auto-detected)';
    console.log(JSON.stringify(displayConfig, null, 2));
}

export function handleUpdate() {
    const currentVersion = pkg.version;
    let latestVersion;

    try {
        log.info('checking for updates...');
        latestVersion = execSync(`npm view @css-doodle/cli version`, { encoding: 'utf8' }).trim();
        clearRow();
    } catch (e) {
        clearRow();
        throw new Error(`failed to check for updates: ${e.message}`);
    }

    if (compareVersions(currentVersion, latestVersion) >= 0) {
        log.success(`already up to date (${currentVersion})`);
        return;
    }

    const { command, reason } = getUpdateCommand(packageDir, getNpmGlobalRoot());
    if (!command) {
        throw new Error(`${latestVersion} is available, but ${reason}`);
    }

    log.info(`upgrading CLI from ${currentVersion} to ${latestVersion}`);
    try {
        execSync(command, { stdio: 'inherit' });
        clearRow();
        log.success(`CLI updated to ${latestVersion}`);
    } catch (e) {
        clearRow();
        throw new Error(`update failed: ${e.message}`);
    }
}

// Name of the output file, without the extension.
function getTitle(source, type) {
    if (!source || source === '-') {
        return;
    }
    if (type === 'codepen' || type === 'doodle' || type === 'webpage') {
        const url = new URL(/^https?:\/\//.test(source) ? source : `https://${source}`);
        const name = safeDecodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
        const title = name ? path.basename(name, path.extname(name)) : url.hostname;
        return title.replace(/[^\w.-]+/g, '-');
    }
    return path.basename(source, path.extname(source));
}

function safeDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

const browserPathAliases = ['browser-path', 'executablePath', 'executable-path'];
const configFields = ['browserPath', 'css-doodle'];

function normalizeConfigField(field) {
    return browserPathAliases.includes(field) ? 'browserPath' : field;
}

function checkConfigField(field) {
    field = normalizeConfigField(field);
    if (!configFields.includes(field)) {
        const suggestion = suggestSimilar(field, configFields);
        const hint = suggestion ? `did you mean '${suggestion}'?` : `expected one of: ${configFields.join(', ')}`;
        throw new Error(`unknown config field '${field}', ${hint}`);
    }
    return field;
}

// Accepts a macOS app bundle too, e.g. `/Applications/Google Chrome.app`,
// using the only executable inside it.
async function resolveBrowserExecutable(value) {
    const file = path.resolve(value);
    const stat = await fs.stat(file).catch(() => null);
    if (stat?.isFile()) {
        return file;
    }
    if (!stat) {
        throw new Error(`browser not found: ${value}`);
    }
    if (/\.app$/i.test(file)) {
        const dir = path.join(file, 'Contents/MacOS');
        const names = await fs.readdir(dir).catch(() => []);
        if (names.length === 1) {
            return path.join(dir, names[0]);
        }
    }
    throw new Error(`'${value}' is a directory, expected the path to the browser executable`);
}

async function getBundledCssDoodleVersion() {
    const lib = await fs.readFile(fileURLToPath(import.meta.resolve('css-doodle')), 'utf8');
    return lib.match(/^\/\*! css-doodle v?([\w.-]+)/)?.[1];
}

const packageDir = path.join(import.meta.dirname, '..');

// The command to update the CLI with the package manager it's installed by,
// told from where it's installed. No command when it can't be updated globally.
// The commands are fixed strings, run in a shell for the .cmd shims on Windows.
function getUpdateCommand(dir, npmGlobalRoot) {
    dir = dir.replaceAll('\\', '/').toLowerCase();
    const name = '@css-doodle/cli';
    if (!dir.includes('/node_modules/')) {
        return { reason: 'the CLI runs from its source code, e.g. linked with npm link, update it with git instead' };
    }
    if (dir.includes('/_npx/')) {
        return { reason: `the CLI runs through npx, use npx ${name}@latest to run the latest version` };
    }
    if (dir.includes('/.volta/')) {
        return { command: `volta install ${name}` };
    }
    if (dir.includes('/pnpm/')) {
        return { command: `pnpm add -g ${name}` };
    }
    if (dir.includes('/.bun/')) {
        return { command: `bun add -g ${name}` };
    }
    if (dir.includes('/yarn/')) {
        return { command: `yarn global add ${name}` };
    }
    const npmRoot = npmGlobalRoot?.replaceAll('\\', '/').toLowerCase().replace(/\/?$/, '/');
    if (npmRoot && !dir.startsWith(npmRoot)) {
        return { reason: `the CLI is installed in a project, update it there with npm install ${name}@latest` };
    }
    return { command: `npm install --silent --no-fund -g ${name}` };
}

function getNpmGlobalRoot() {
    try {
        return execSync('npm root -g', { encoding: 'utf8' }).trim();
    } catch {
        return undefined;
    }
}

const maxWindowSize = 8192;

// `1600x1000`, `1600,1000`, or `800` for a square.
function parseWindowSize(value) {
    const [w, h = w] = String(value).split(/[,x]/);
    const width = Number(w);
    const height = Number(h);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        throw new Error(`invalid window size '${value}', expected format: WIDTHxHEIGHT (e.g., 1600x1000)`);
    }
    if (width > maxWindowSize || height > maxWindowSize) {
        throw new Error(`window size too large, maximum is ${maxWindowSize}x${maxWindowSize}`);
    }
    return { width, height };
}

function parseScale(value) {
    const scale = Number(value);
    if (!Number.isFinite(scale) || scale <= 0 || scale > 10) {
        throw new Error(`invalid scale '${value}', expected a number between 0.01 and 10`);
    }
    return scale;
}

// Remove the old alias keys so they won't shadow or be shadowed by `browserPath`.
function deleteBrowserPathAliases() {
    for (const alias of browserPathAliases) {
        delete config[alias];
    }
}

async function saveConfig(message = 'done') {
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        log.success(message);
    } catch (_e) {
        throw new Error('failed to write config file');
    }
}

function readTimeOption(name, value, max, quiet) {
    const time = readTime(value);
    if (time > max) {
        if (!quiet) {
            log.warn(`${name} '${value}' exceeds the maximum of ${max / 1000}s, using ${max / 1000}s instead`);
        }
        return max;
    }
    return time;
}

async function fetchCssDoodleSource(value) {
    const version = value.replace(/^css-doodle@/, '');
    const prefix = path.join(configDownloadPath, version);
    const existed = await checkExists(prefix);
    const dir = path.join(prefix, 'node_modules/css-doodle');
    try {
        log.info(`fetching css-doodle@${version} from npm registry`);
        execSync(`npm i css-doodle@${version} --prefix ${JSON.stringify(prefix)}`, { stdio: 'ignore' });
    } catch (_e) {
        if (!existed) {
            await fs.rm(prefix, { recursive: true, force: true });
        }
        throw new Error(`failed to fetch css-doodle@${version}`);
    }
    const { version: installed } = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
    return { dir, version: installed };
}

// Compare the major.minor.patch part of two versions, returns -1, 0, or 1.
function compareVersions(a, b) {
    const pa = String(a).split(/[.-]/, 3).map(Number);
    const pb = String(b).split(/[.-]/, 3).map(Number);
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff) return Math.sign(diff);
    }
    return 0;
}

function isPackageVersion(value) {
    return /^(css-doodle@)?(latest|\d+\.\d+\.\d+)$/.test(value);
}

async function isValidCssDoodleFile(file) {
    try {
        const content = await fs.readFile(file, 'utf8');
        return content.startsWith('/*! css-doodle');
    } catch (_e) {
        return false;
    }
}

export {
    checkConfigField,
    compareVersions,
    getTitle,
    getUpdateCommand,
    isPackageVersion,
    isValidCssDoodleFile,
    normalizeConfigField,
    parseScale,
    parseWindowSize,
    resolveBrowserExecutable,
};
