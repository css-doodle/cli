import process from 'node:process';
import fs from 'node:fs/promises';
import { styleText } from 'node:util';
import readline from 'node:readline';

function getStyleProxy() {
    let names = [];
    const p = new Proxy(function () {}, {
        get(_, prop) {
            names.push(prop);
            return p;
        },
        apply(_, ___, args) {
            const result = styleText(names, ...args);
            names = [];
            return result;
        },
    });

    return p;
}

function clearRow() {
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[1A\x1b[2K');
    }
}

function clearLine() {
    if (process.stdout.isTTY) {
        process.stdout.write('\r\x1b[2K');
    }
}

function checkExists(filePath) {
    return fs.access(filePath, fs.constants.F_OK).then(() => true).catch(() => false);
}

function readTime(number, options = {}) {
    let result = 0;
    if (/^(\d+)(ms)?$/.test(number)) {
        result = Number(number.replace('ms', ''));
    }
    if (/^(\d+)s$/.test(number)) {
        result = Number(number.replace('s', '')) * 1000;
    }
    if (/^(\d+)m$/.test(number)) {
        result = Number(number.replace('m', '')) * 60 * 1000;
    }
    return Math.min(result, options.max ?? Infinity);
}

function question(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

const style = getStyleProxy();

const log = {
    success: (msg) => console.log(style.green(`✓ ${msg}`)),
    error: (msg) => console.error(style.red(`✗ ${msg}`)),
    warn: (msg) => console.warn(style.yellow(`⚠ ${msg}`)),
    info: (msg) => console.log(style.blue('▶') + style.dim(` ${msg}`)),
    progress: (msg) => console.log(style.green('●') + style.dim(` ${msg}`)),
};

export { checkExists, clearLine, clearRow, log, question, readTime, style };
