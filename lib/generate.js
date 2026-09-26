import * as generator from 'css-doodle/generator';

import { importCustomModule } from './static.js';

// The seed option is supported since css-doodle 0.53.0, older versions ignore it.
export async function generateSVG(code, options = {}) {
    const lib = await importCustomModule('generator') ?? generator;
    return lib.svg(code, { seed: options.seed });
}

export async function generateShape(...args) {
    const lib = await importCustomModule('generator') ?? generator;
    return lib.shape(...args);
}
