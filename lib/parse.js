import { dirname, join } from 'node:path';
import { parse_css } from 'css-doodle/parser';

import { config } from './static.js';

export async function parse(code) {
    if (config['css-doodle']) {
        const libPath = join(
            dirname(config['css-doodle']), '/src/exports/parser/index.js'
        );
        try {
            const lib = await import(libPath);
            return lib.parse_css(code);
        } catch(_e) {
            return parse_css(code);
        }
    }
    return parse_css(code);
}
