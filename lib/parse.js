import * as parser from 'css-doodle/parser';

import { importCustomModule } from './static.js';

export async function parse(code) {
    let lib;
    try {
        lib = await importCustomModule('parser') ?? parser;
    } catch (e) {
        const message = e.message || 'parse failed';
        throw new Error(`${message} (hint: ensure your custom css-doodle version has parser exports)`);
    }
    // Renamed from parse_css in css-doodle 0.52.0.
    const parseCss = lib.parseCss ?? lib.parse_css;
    if (typeof parseCss !== 'function') {
        throw new Error('the parser of the current css-doodle version is not supported');
    }
    return parseCss(code);
}
