import process from 'node:process';
import { dirname, extname, join } from 'node:path';
import { parse_css } from 'css-doodle/parser';

import { config } from './static.js';
import { log } from './utils.js';

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
            log.error(`${message} (hint: ensure your custom css-doodle version has parser exports)`);
            process.exit(1);
        }
    } else {
        return parse_css(code);
    }
}
