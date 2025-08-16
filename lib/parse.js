import process from 'node:process';
import { dirname, join } from 'node:path';
import { parse_css } from 'css-doodle/parser';

import { config } from './static.js';
import { style } from './style.js';

export async function parse(code) {
    if (config['css-doodle']) {
        const libPath = join(
            dirname(config['css-doodle']), '/src/exports/parser/index.js'
        );
        try {
            const lib = await import(libPath);
            return lib.parse_css(code);
        } catch(e) {
            console.error(style.red(e.message || 'parse failed'));
            process.exit(1);
        }
    } else {
        return parse_css(code);
    }
}
