import { parse_css } from 'css-doodle/parser';

import { importCustomModule } from './static.js';

export async function parse(code) {
    let lib;
    try {
        lib = await importCustomModule('parser');
    } catch (e) {
        const message = e.message || 'parse failed';
        throw new Error(`${message} (hint: ensure your custom css-doodle version has parser exports)`);
    }
    return lib ? lib.parse_css(code) : parse_css(code);
}
