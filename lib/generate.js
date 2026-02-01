import { dirname, join } from 'node:path';
import { shape, svg } from 'css-doodle/generator';

import { config } from './static.js';

export async function generateSVG(...args) {
    const libPath = getLocalLibPath();
    if (libPath) {
        const lib = await import(libPath);
        return lib.svg(...args);
    } else {
        return svg(...args);
    }
}

export async function generateShape(...args) {
    const libPath = getLocalLibPath();
    if (libPath) {
        const lib = await import(libPath);
        return lib.shape(...args);
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
