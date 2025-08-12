#!/usr/bin/env node

import process from 'node:process';
import { styleText } from 'node:util';
import { Command } from 'commander';
import { pkg } from '../lib/static.js';
import { msgError, msgCommand } from '../lib/message.js';

import {
    handleRender,
    handleParse,
    handlePreview,
    handleGenerateSVG,
    handleGenerateShape,
    handleSetConfig,
    handleUnsetConfig,
    handleDisplayConfig,
    handleDisplayConfigList,
    handleUseAction,
    handleUpgrade,
} from '../lib/handler.js';

const program = new Command();

program
    .name(pkg.programName)
    .version(pkg.version)
    .addHelpCommand(false)
    .addHelpText('beforeAll', program => {
        if (!program.command.parent) {
            return `${pkg.description}. (${pkg.version})\n`;
        }
    })
    .addHelpText('afterAll', program => {
        if (!program.command.parent) {
            return `\nLearn more: https://css-doodle.com`;
        }
    })
    .configureHelp({
        subcommandTerm(cmd) {
            return cmd.name();
        },
        styleTitle(str) {
            return styleText('bold', str);
        },
        styleCommandText(str) {
            return styleText('bold', str);
        },
        styleArgumentText(str) {
            return styleText('bold', styleText('magenta', str));
        },
        styleArgumentTerm(str) {
            return styleText('bold', styleText('magenta', str));
        },
        styleSubcommandText(str) {
            return styleText('bold', styleText('blue', str));
        },
        styleSubcommandTerm(str) {
            return styleText('bold', styleText('blue', str));
        },
        styleOptionTerm(str) {
            return styleText('bold', styleText('cyan', str));
        },
        styleOptionText(str) {
            return styleText('bold', styleText('cyan', str));
        },
    })
    .configureOutput({
        outputError(str, write) {
            write(msgError(String(str).replace(/^error: /, '')));
        }
    });

program
    .argument('[source]', `css-doodle source file to preview (same as ${msgCommand('run')} command)`)
    .action(handlePreview);


program
    .command('run')
    .alias('preview')
    .description('Open a window to preview the css|cssd file')
    .argument('[source]', 'css-doodle source file to preview')
    .option('--fullscreen', 'open in fullscreen mode')
    .action(handlePreview);

program
    .command('render')
    .description('Generate an image from a css|cssd|html file, CodePen link, or http(s) URL')
    .argument('[source]', 'css-doolde source file used to generate the image/video')
    .option('-o, --output <output>', 'Custom output filename of the generated result')
    .option('-x, --scale <scale>', 'Scale factor of the generated result, defaults to `2` for images, `1` for videos')
    .option('-s, --selector <selector>', 'CSS selector to target the rendered node, defaults to `css-doodle`')
    .option('-d, --delay <delay>', 'Delay time before taking screenshot/screencast, e.g, `2s`')
    .option('-t, --time <time>', 'Record screen for a specific time, e.g, `10s`')
    .option('-q, --quiet', 'Quiet mode, suppresses non-error output')
    .option('-w, --window <size>', 'The size of the rendered window, defaults to `1600x1000` for images, `1200x800` for videos')
    .option('-f, --format <format>', 'Output format, `png|webp|jpeg` for images, `mp4|gif|webm` for videos')
    .action(handleRender);

const generate =
program
    .command('generate')
    .description('Generate code using css-doodle generators')
    .action((_, cmd) => cmd.help());

    generate
        .command('svg [source]')
        .description('Generate SVG code with svg() function')
        .action(handleGenerateSVG);

    generate
        .command('polygon [source]')
        .description('Generate CSS polygon() with shape() function')
        .action(handleGenerateShape);

const config =
program
    .command('config')
    .description('Display/set configurations')
    .action((_, cmd) => cmd.help());

    config
        .command('set <field> <value>')
        .description('Set a configuration with key/value pair')
        .action(handleSetConfig);

    config
        .command('get <field>')
        .description('Get a configuration value by key')
        .action(handleDisplayConfig);

    config
        .command('unset <field>')
        .description('Unset a configuration field')
        .action(handleUnsetConfig);

    config
        .command('list')
        .description('List all configurations')
        .action(handleDisplayConfigList);

program
    .command('use')
    .description('Shorthand to fetch and use a custom version of css-doodle')
    .argument('<version>', 'Custom version of css-doodle to use. E.g. css-doodle@latest')
    .action(handleUseAction);

program
    .command('parse')
    .description('Print the parsed tokens, help to debug in development')
    .argument('[source]', 'css-doodle source file to parse')
    .action(handleParse);

program
    .command('upgrade')
    .description('Upgrade CLI to latest version')
    .action(handleUpgrade);

if (process.argv.length <= 2) {
    program.help();
} else {
    program.parse();
}
