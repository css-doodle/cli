#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { pkg, config, configPath } from '../src/static.js';
import { parse } from '../src/parse.js';
import { preview } from '../src/preview/index.js';
import { render } from '../src/render.js';
import { generateSVG, generateShape } from '../src/generate.js';

import { Command } from 'commander';

const program = new Command();

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

async function handleRender(source, options) {
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

async function handleParse(source) {
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

async function handlePreview(source, options) {
    let { content, error } = await read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        let title = path.basename(source);
        preview(source, title, options);
    }
}

async function handleGenerateSVG(source) {
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

async function handleGenerateShape(source) {
    let { content, error } = await read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        console.log(generateShape(content));
    }
}

function handleSetBrowser(executablePath) {
   config.browserPath = executablePath;
   fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function handleDisplayConfig(field) {
    if (field) {
        console.log(config[field]);
    } else {
        console.log(JSON.stringify(config, null, 2));
    }
}

function getProgramName() {
    let name = path.basename(process.argv[1]);
    return pkg.bin[name] ? name : 'cssd';
}

program
    .name(getProgramName())
    .description(pkg.description)
    .version(pkg.version);

program
    .command('render')
    .description('generate an image from css-doodle file')
    .argument('[source]', 'css-doolde source file used to generate the image')
    .option('-o, --output <output>', 'custom filename of the generated image')
    .option('-x, --scale <scale>', 'scale factor of the generated image, defaults to 1')
    .action((source, options) => {
        handleRender(source, options);
    });

program.command('preview')
    .description('open a window to preview the css-doodle file')
    .argument('<source>', 'css-doodle source file to preview')
    .option('--fullscreen', 'open the preview in fullscreen mode')
    .action((source, options) => {
        handlePreview(source, options);
    });

program.command('parse')
    .description('print the parsed tokens, helped to debug on development')
    .argument('[source]', 'css-doodle source file to parse')
    .action((source) => {
        handleParse(source);
    });

program.command('config')
    .description('display/set the configurations')
    .action(() => {
        handleDisplayConfig();
    })
    .command('browserPath [path]')
    .action((path, options, command) => {
        if (path === undefined) {
            handleDisplayConfig(command.name());
        } else {
            handleSetBrowser(path);
        }
    });

const commandGenerate =
    program.command('generate')
    .description('generate code using css-doodle generators')
    .action((_, cmd) => {
        cmd.help();
    });

commandGenerate
    .command('svg [source]')
    .description('generate SVG code with svg() function')
    .action((source) => {
        handleGenerateSVG(source);
    });

commandGenerate
    .command('polygon [source]')
    .description('generate CSS polygon() with shape() function')
    .action(source => {
        handleGenerateShape(source);
    });

if (process.argv.length <= 2) {
    program.help();
} else {
    program.parse();
}
