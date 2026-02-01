import { dirname, extname, join } from 'node:path';
import { parse_css } from 'css-doodle/parser';

import { config } from './static.js';

export async function parse(code) {
    let configPath = config['css-doodle'];

    if (configPath) {
        if (extname(configPath)) {
            configPath = dirname(configPath);
        }
        const libPath = join(configPath, 'src/exports/parser/index.js');
        try {
            const lib = await import(libPath);
            return lib.parse_css(code);
        } catch (e) {
            const message = e.message || 'parse failed';
            throw new Error(`${message} (hint: ensure your custom css-doodle version has parser exports)`);
        }
    } else {
        return parse_css(code);
    }
}
