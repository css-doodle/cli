#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { pkg, config, configPath } from '../src/static.js';
import { parse } from '../src/parse.js';
import { preview } from '../src/preview/index.js';
import { render } from '../src/render.js';
import { generateSVG, generateShape } from '../src/generate.js';

import { Command } from 'commander';

const program = new Command();

function read(path) {
    let content = '';
    let error = null;
    try {
        content = fs.readFileSync(path, 'utf8');
    } catch (e) {
        error = e;
    }
    return { content, error };
}

async function handleRender(source, options) {
    let { content, error } = read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        let basename = path.basename(source);
        let extname = path.extname(basename);
        let title = extname ? basename.split(extname)[0] : basename;
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

function handleParse(source) {
    let { content, error } = read(source);
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

function handlePreview(source, options) {
    let { content, error } = read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        let title = path.basename(source);
        preview(source, title, options);
    }
}

function handleGenerateSVG(source) {
    let { content, error } = read(source);
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

function handleGenerateShape(source) {
    let { content, error } = read(source);
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

program
    .name('css-doodle')
    .description(pkg.description)
    .version(pkg.version);

program
    .command('render')
    .description('generate an image from the CSS Doodle source file')
    .argument('<source>', 'the CSS Doodle source file used to generate the image')
    .option('-o, --output <output>', 'custom filename of the generated image')
    .option('-x, --scale <scale>', 'scale factor of the generated image, defaults to 1')
    .action((source, options) => {
        handleRender(source, options);
    });

program.command('preview')
    .description('open a window to preview the CSS Doodle file')
    .argument('<source>', 'source file to preview')
    .option('--fullscreen', 'open the preview in fullscreen mode')
    .action((source, options) => {
        handlePreview(source, options);
    });

program.command('parse')
    .description('print the parsed tokens, helped to debug on development')
    .argument('<source>', 'source file to parse')
    .action((source) => {
        handleParse(source);
    });

program.command('config')
    .description('display/set the configuration')
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

const commandGenerate = program.command('generate')
    .description('generate code using CSS Doodle generators')
    .action((_, cmd) => {
        cmd.help();
    });

    commandGenerate.command('svg <source>')
        .description('generate SVG code using svg() function')
        .action((source) => {
            handleGenerateSVG(source);
        })

    commandGenerate.command('polygon <source>')
        .description('generate CSS polygon() using shape() function')
        .action((source) => {
            handleGenerateShape(source);
        });

if (process.argv.length <= 2) {
    program.help();
} else {
    program.parse();
}
