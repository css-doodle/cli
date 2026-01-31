import process from 'node:process';
import fs from 'node:fs/promises';
import { styleText } from 'node:util';

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

const style = getStyleProxy();

export { checkExists, clearRow, readTime, style };
