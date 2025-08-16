import process from 'node:process';
import { dirname, join } from 'node:path';
import { shape, svg } from 'css-doodle/generator';

import { config } from './static.js';
import { style } from './style.js';

export async function generateSVG(...args) {
    const libPath = getLocalLibPath();
    if (libPath) {
        try {
            const lib = await import(libPath);
            return lib.svg(...args);
        } catch (e) {
            console.error(style.red(e.message));
            process.exit(1);
        }
    } else {
        return svg(...args);
    }
}

export async function generateShape(...args) {
    const libPath = getLocalLibPath();
    if (libPath) {
        try {
            const lib = await import(libPath);
            return lib.shape(...args);
        } catch (e) {
            console.error(style.red(e.message));
            process.exit(1);
        }
    } else {
        return shape(...args);
    }
}

function getLocalLibPath() {
    if (config['css-doodle']) {
        return join(
            dirname(config['css-doodle']),
            '/src/exports/generator/index.js',
        );
    }
}
