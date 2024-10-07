# @css-doodle/cli

The css-doodle command line tool for previewing and generating images.

<img src="screenshot/preview.png" width="480px" alt="screenshot" />

## Installation

```bash
npm install -g @css-doodle/cli
```

## Commands

### render
Generate an image from the CSS Doodle source file.

```bash
cssd render code.css
```

#### -o, --output

Custom output filename of the generated image.

```bash
cssd render code.css -o result.png
```

#### -x, --scale

Scale factor of the generated image, defaults to 1.

```bash
cssd render code.css -x 4
```

### preview
Open a window to preview the CSS Doodle file.

```bash
cssd preview code.css
```

#### --fullscreen

Open the preview in fullscreen mode.

```bash
cssd preview code.css --fullscreen
```


### config

Display/set the configuration.

```bash
cssd config
```

#### browserPath

Use a custom browser to preview and generate images.

```bash
cssd config browserPath /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

### generate

Generate code using CSS Doodle generators.

#### svg

Generate SVG code using svg() function.

```bash
cssd generate svg code.css
```

#### polygon

Generate CSS polygon() using shape() function.

```bash
cssd generate polygon code.css
```

## Usage

```
Usage: css-doodle [options] [command]

The css-doodle CLI for previewing and generating images

Options:
  -V, --version               output the version number
  -h, --help                  display help for command

Commands:
  render [options] [source]   generate an image from the CSS Doodle source file
  preview [options] <source>  open a window to preview the CSS Doodle file
  parse [source]              print the parsed tokens, helped to debug on development
  config                      display/set the configuration
  generate                    generate code using CSS Doodle generators
  help [command]              display help for command
```
