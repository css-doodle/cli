import os from 'node:os';
import fs from 'node:fs/promises';
import { stdin } from 'node:process';
import { msgTip, msgKey } from './message.js';

export async function read(path) {
    let result = { content: '', type: '', error: null };

    if (path === undefined) {
        result.type = 'stdin';
        const key = os.platform() === 'win32' ? 'CTRL+Z' : 'CTRL+D';
        console.log(
            msgTip('Reading from stdin — press ') + msgKey(key) + msgTip(' to end input.\n')
        );
        try {
            result.content = await readFromStdin();
            console.log('\n');
        } catch (e) {
            result.error = e;
        }
    }
    else if (/^(https:\/\/)?codepen\.io/.test(path)) {
        result.type = 'codepen';
        const match = path.match(/^(https:\/\/)?codepen\.io\/([^\/]+)\/(pen|details|full)\/([^\/]+)$/) || [];
        const [user, id] = [match[2], match[4]];
        if (user && id) {
            result.content = `https://cdpn.io/${user}/fullpage/${id}?nocache=true&view=fullpage`;
        } else {
            result.error = new Error('unsupported CodePen url, should be like https://codepen.io/:user/pen/:id');
        }
    }
    else if (/\.html$/.test(path)) {
        const { content, error } = await readFile(path);
        result = { type: 'html', content, error };
    }
    else if (/\.cssd?$/.test(path)) {
        const { content, error } = await readFile(path);
        result = { type: 'css', content, error };
    }
    else {
        result.error = new Error('invalid input, accept .html, .css, .cssd, and CodePen link');
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
        stdin.on('data', c => content += c);
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
