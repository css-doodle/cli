#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { pkg, config, configPath } from '../src/static.js';
import { parse } from '../src/parse.js';
import { preview } from '../src/preview/index.js';
import { screenshot } from '../src/screenshot.js';

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


async function handleGenerate(source, options) {
    let { content, error } = read(source);
    if (error) {
        console.log(error.message);
        process.exit(1);
    } else {
        let basename = path.basename(source);
        let extname = path.extname(basename);
        let title = extname ? basename.split(extname)[0] : basename;
        let output = await screenshot(content, {
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
    .command('screenshot')
    .argument('<source>', 'the CSS Doodle source file used to generate the image')
    .option('-o, --output <output>', 'custom filename of the generated image')
    .option('-x, --scale <scale>', 'scale factor of the generated image, defaults to 1')
    .action((source, options) => {
        handleGenerate(source, options);
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

if (process.argv.length <= 2) {
    program.help();
} else {
    program.parse();
}
