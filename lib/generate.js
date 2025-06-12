import { dirname, join } from 'node:path';
import { svg, shape } from 'css-doodle/generator';

import { config } from './static.js';

export async function generateSVG(...args) {
    const libPath = getLocalLibPath();
    if (libPath) {
        try {
            const lib = await import(libPath);
            return lib.svg(...args);
        } catch(_e) {
            return svg(...args);
        }
    }
    return svg(...args);
}

export async function generateShape(...args) {
    const libPath = getLocalLibPath();
    if (libPath) {
        try {
            const lib = await import(libPath);
            return lib.shape(...args);
        } catch(_e) {
            return shape(...args);
        }
    }
    return shape(...args);
}

function getLocalLibPath() {
    if (config['css-doodle']) {
        return join(
            dirname(config['css-doodle']), '/src/exports/generator/index.js'
        );
    }
}
