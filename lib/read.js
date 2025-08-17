import os from 'node:os';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { stdin } from 'node:process';
import { style } from './style.js';
import { checkExists } from './static.js';

export async function read(path) {
    let result = { content: '', type: '', error: null };

    if (path === undefined || path === '-') {
        let stdinActive = false;
        stdin.on('data', () => stdinActive = true);

        result.type = 'stdin';
        const key = os.platform() === 'win32' ? 'CTRL+Z' : 'CTRL+D';
        setTimeout(() => {
            if (!stdinActive) {
                console.log(
                    style.dim('Reading from stdin — press ') + style.bold.yellow(key) + style.dim(' to end input.\n'),
                );
            }
        }, 200);
        try {
            result.content = await readFromStdin();
            console.log('\n');
        } catch (e) {
            result.error = e;
        }
    } else if (/^(https:\/\/)?codepen\.io/.test(path)) {
        result.type = 'codepen';
        const match = path.match(/^(https:\/\/)?codepen\.io\/([^\/]+)\/(pen|details|full)\/([^\/]+)$/) || [];
        const [user, id] = [match[2], match[4]];
        if (user && id) {
            result.content = `https://cdpn.io/${user}/fullpage/${id}?nocache=true&view=fullpage`;
        } else {
            result.error = new Error('unsupported CodePen url, should be like https://codepen.io/:user/pen/:id');
        }
    } else if (/^(https?:\/\/)/.test(path)) {
        result.type = 'webpage';
        result.content = path;
    } else if (/\.html$/.test(path)) {
        result.type = 'html';
        const resolvedPath = resolve(path);
        const exists = await checkExists(resolvedPath);
        if (exists) {
            result.content = `file://${resolvedPath}`;
        } else {
            result.error = new Error(`file not found: ${path}`);
        }
    } else if (/\.cssd?$/.test(path)) {
        const { content, error } = await readFile(path);
        result = { type: 'css', content, error };
    } else {
        result.error = new Error('invalid input, accept .html, .css, .cssd, CodePen link, or http(s) URL');
    }

    if (result.content) {
        result.content = result.content.trim();
    }

    if (!result.error && !result.content) {
        result.error = new Error('empty input');
    }

    return result;
}

function readFromStdin() {
    return new Promise((resolve, reject) => {
        let content = '';
        stdin.setEncoding('utf8');
        stdin.on('data', (c) => content += c);
        stdin.on('end', () => resolve(content));
        stdin.on('error', reject);
    });
}

async function readFile(path) {
    let content = '', error;
    try {
        content = await fs.readFile(path, 'utf8');
    } catch (e) {
        error = e;
    }
    return { content, error };
}
