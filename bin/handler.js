import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { pkg, config, configPath } from '../src/static.js';
import { parse } from '../src/parse.js';
import { preview } from '../src/preview/index.js';
import { render } from '../src/render.js';
import { generateSVG, generateShape } from '../src/generate.js';

export async function handleRender(source, options) {
    let { content, error } = await read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        let title = 'image';
        if (source) {
            let basename = path.basename(source);
            let extname = path.extname(basename);
            title = extname ? basename.split(extname)[0] : basename;
        }

        let output = await render(content, {
            title,
            output: options.output,
            scale: options.scale
        });
        if (output) {
            console.log(`Saved to ${output}.`);
        }
    }
}

export async function handleParse(source) {
    let { content, error } = await read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        try {
            console.log(JSON.stringify(parse(content), null, 2));
        }  catch (e) {
            console.log(e.message);
            process.exit(1);
        }
    }
}

export async function handlePreview(source, options) {
    let { content, error } = await read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        let title = path.basename(source);
        preview(source, title, options);
    }
}

export async function handleGenerateSVG(source) {
    let { content, error } = await read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        content = content.trim();
        if (/^svg\s*\{/i.test(content) || !content.length) {
            console.log(generateSVG(content));
        } else {
            console.log('Not a valid SVG format');
        }
    }
}

export async function handleGenerateShape(source) {
    let { content, error } = await read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        console.log(generateShape(content));
    }
}

export function handleSetConfig(field, value) {
   config[field] = value;
   if (value === '') {
       delete config[field];
   }
   fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
   console.log('OK')
}

export function handleDisplayConfig(field) {
    console.log(config[field]);
}

export function handleDisplayConfigList() {
    console.log(JSON.stringify(config, null, 2));
}

export function getProgramName() {
    let name = path.basename(process.argv[1]);
    return pkg.bin[name] ? name : 'cssd';
}

async function read(path) {
    let content = '';
    let error = null;
    if (path === undefined) {
        console.log('No source file specified, reading from stdin...');
        let key = os.platform() === 'win32' ? 'CTRL+Z' : 'CTRL+D';
        console.log(`Press ${key} to finish input.\n`);
        try {
            content = await readFromStdin();
        } catch (e) {
            error = e;
        }
    } else {
        try {
            content = fs.readFileSync(path, 'utf8');
        } catch (e) {
            error = e;
        }
    }
    return { content, error };
}

function readFromStdin() {
    return new Promise((resolve, reject) => {
        let content = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('readable', () => {
            let chunk;
            while ((chunk = process.stdin.read())) {
                content += chunk;
            }
        });
        process.stdin.on('end', () => {
            console.log('\n');
            resolve(content);
        });
        process.stdin.on('error', reject);
    });
}

