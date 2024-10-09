#!/usr/bin/env node

import { Command } from 'commander';
import { pkg } from '../lib/static.js';

import {
    handleRender,
    handleParse,
    handlePreview,
    handleGenerateSVG,
    handleGenerateShape,
    handleSetConfig,
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
            return `\nLearn more: https://css-doodle.com`
        }
    })
    .configureHelp({
        subcommandTerm(cmd) {
            return cmd.name()
        }
    });

program
    .command('render')
    .description('Generate an image from css-doodle file')
    .argument('[source]', 'css-doolde source file used to generate the image')
    .option('-o, --output <output>', 'Custom filename of the generated image')
    .option('-x, --scale <scale>', 'Scale factor of the generated image, defaults to 1')
    .action(handleRender);

program
    .command('preview')
    .description('Open a window to preview the css-doodle file')
    .argument('[source]', 'css-doodle source file to preview')
    .option('--fullscreen', 'open the preview in fullscreen mode')
    .action(handlePreview);

const commandGenerate = program
    .command('generate')
    .description('Generate code using css-doodle generators')
    .action((_, cmd) => cmd.help());

    commandGenerate
        .command('svg [source]')
        .description('Generate SVG code with svg() function')
        .action(handleGenerateSVG);

    commandGenerate
        .command('polygon [source]')
        .description('Generate CSS polygon() with shape() function')
        .action(handleGenerateShape);

const commandConfig = program
    .command('config')
    .description('Display/set the configurations')
    .action((_, cmd) => cmd.help());

    commandConfig
        .command('set <field> <value>')
        .description('Set a configuration with key/value pair')
        .action(handleSetConfig);

    commandConfig
        .command('get <field>')
        .description('Get a configuration value by key')
        .action(handleDisplayConfig);

    commandConfig
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
    .description('Print the parsed tokens, helped to debug on development')
    .argument('[source]', 'css-doodle source file to parse')
    .action(handleParse);

program
    .command('upgrade')
    .description('Upgrade CLI to the latest version')
    .action(handleUpgrade);

if (process.argv.length <= 2) {
    program.help();
} else {
    program.parse();
}
