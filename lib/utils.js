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

const timeUnits = { ms: 1, s: 1000, m: 60 * 1000 };

function readTime(value, options = {}) {
    if (value === undefined) return 0;
    const match = String(value).trim().match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/);
    if (!match) {
        throw new Error(`invalid time '${value}', expected a number with an optional unit ms|s|m, e.g. 500ms, 2s, 1.5m`);
    }
    const result = Math.round(Number(match[1]) * timeUnits[match[2] ?? 'ms']);
    return Math.min(result, options.max ?? Infinity);
}

function suggestSimilar(word, candidates) {
    let suggestion;
    let minDistance = 3;
    for (const candidate of candidates) {
        const distance = editDistance(word, candidate);
        if (distance < minDistance) {
            minDistance = distance;
            suggestion = candidate;
        }
    }
    return suggestion;
}

// Levenshtein distance
function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) {
        d[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
    }
    return d[a.length][b.length];
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

export { checkExists, clearLine, clearRow, log, question, readTime, style, suggestSimilar };
