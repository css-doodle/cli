import os from 'node:os';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { stdin } from 'node:process';
import { pathToFileURL } from 'node:url';
import { checkExists, style } from './utils.js';

export async function read(path) {
    let result = { content: '', type: '' };

    if (path === undefined || path === '-') {
        let stdinActive = false;
        const onStdinData = () => stdinActive = true;
        stdin.on('data', onStdinData);

        result.type = 'stdin';
        const key = os.platform() === 'win32' ? 'CTRL+Z' : 'CTRL+D';
        const timeoutId = setTimeout(() => {
            if (!stdinActive) {
                console.log(
                    style.dim('Reading from stdin — press ') + style.bold.yellow(key) + style.dim(' to end input.\n'),
                );
            }
        }, 200);
        try {
            result.content = await readFromStdin();
        } finally {
            clearTimeout(timeoutId);
            stdin.off('data', onStdinData);
        }
    } else if (/^(https:\/\/)?codepen\.io/.test(path)) {
        result.type = 'codepen';
        const match = path.match(/^(https:\/\/)?codepen\.io\/([^\/?#]+)\/(pen|details|full)\/([^\/?#]+)\/?([?#].*)?$/) || [];
        const [user, id] = [match[2], match[4]];
        if (user && id) {
            result.content = `https://cdpn.io/${user}/fullpage/${id}?nocache=true&view=fullpage`;
        } else {
            throw new Error('unsupported CodePen url, should be like https://codepen.io/:user/pen/:id');
        }
    } else if (/^(https:\/\/)?(www\.)?css-doodle\.com\/d\//i.test(path)) {
        result.type = 'doodle';
        const match = path.match(/^(https:\/\/)?(www\.)?css-doodle\.com\/d\/([^\/?#]+)\/?([?#].*)?$/i) || [];
        const id = match[3];
        if (id) {
            result.content = await fetchDoodle(id);
        } else {
            throw new Error('unsupported css-doodle url, should be like https://css-doodle.com/d/:id');
        }
    } else if (/^(https?:\/\/)/.test(path)) {
        result.type = 'webpage';
        result.content = path;
    } else if (/\.html?$/i.test(path)) {
        result.type = 'html';
        const resolvedPath = resolve(path);
        const exists = await checkExists(resolvedPath);
        if (exists) {
            result.content = pathToFileURL(resolvedPath).href;
        } else {
            throw new Error(`file not found: ${path}`);
        }
    } else if (/\.cssd?$/i.test(path)) {
        const content = await readFile(path);
        result = { type: 'css', content };
    } else {
        throw new Error('invalid input, accept .html, .css, .cssd, css-doodle or CodePen link, or http(s) URL');
    }

    if (result.content) {
        result.content = result.content.trim();
    }

    if (!result.content) {
        throw new Error('empty input');
    }

    return result;
}

async function fetchDoodle(id) {
    let res;
    try {
        res = await fetch(`https://css-doodle.com/api/demos/${encodeURIComponent(id)}`);
    } catch (e) {
        throw new Error(`failed to fetch doodle ${id}: ${e.cause?.message ?? e.message}`);
    }
    // Private doodles are reported as not found too.
    if (res.status === 400 || res.status === 404) {
        throw new Error(`doodle not found: ${id}`);
    }
    if (!res.ok) {
        throw new Error(`failed to fetch doodle ${id}: HTTP ${res.status}`);
    }
    const { demo } = await res.json();
    return demo?.code ?? '';
}

function readFromStdin() {
    return new Promise((resolve, reject) => {
        let content = '';
        const onData = (c) => content += c;
        const onEnd = () => {
            cleanup();
            resolve(content);
        };
        const onError = (e) => {
            cleanup();
            reject(e);
        };
        const cleanup = () => {
            stdin.off('data', onData);
            stdin.off('end', onEnd);
            stdin.off('error', onError);
        };

        stdin.setEncoding('utf8');
        stdin.on('data', onData);
        stdin.on('end', onEnd);
        stdin.on('error', onError);
    });
}

async function readFile(path) {
    try {
        return await fs.readFile(path, 'utf8');
    } catch (e) {
        if (e.code === 'ENOENT') {
            throw new Error(`file not found: ${path}`);
        }
        throw e;
    }
}
