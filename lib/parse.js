import process from 'node:process';
import { dirname, extname, join } from 'node:path';
import { parse_css } from 'css-doodle/parser';

import { config } from './static.js';
import { log, style } from './utils.js';

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
            log.error(e.message || 'parse failed');
            process.exit(1);
        }
    } else {
        return parse_css(code);
    }
}
