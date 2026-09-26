import * as generator from 'css-doodle/generator';

import { importCustomModule } from './static.js';

export async function generateSVG(...args) {
    const lib = await importCustomModule('generator') ?? generator;
    return lib.svg(...args);
}

export async function generateShape(...args) {
    const lib = await importCustomModule('generator') ?? generator;
    return lib.shape(...args);
}
