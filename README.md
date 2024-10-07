# @css-doodle/cli

A command-line tool for css-doodle to preview and generate images.

<img src="screenshot/preview.png" width="480px" alt="screenshot" />

## Installation

```bash
npm install -g @css-doodle/cli
```

After installation, you can use command `css-doodle` or `cssd` in the terminal.

## Usage

```
Usage: cssd [options] [command]

Options:
  -V, --version  output the version number
  -h, --help     display help for command

Commands:
  render         Generate an image from css-doodle file
  preview        Open a window to preview the css-doodle file
  generate       Generate code using css-doodle generators
  config         Display/set the configurations
  use            Shorthand to fetch and use a custom version of css-doodle
  parse          Print the parsed tokens, helped to debug on development
```

## Commands

### render
Generate an image from the css-doodle source file. It'll read from STDIN if no source file specified.

* `-o, --output`: Custom output filename of the generated image.
* `-x, --scale`: Scale factor of the generated image, defaults to 1.
 
```bash
cssd render
cssd render code.css
cssd render code.css -o result.png
cssd render code.css -x 4
```

### preview
Open a window to preview the css-doodle file.

* `--fullscreen`: Open in fullscreen mode.

```bash
cssd preview code.css
cssd preview code.css --fullscreen
```

### generate

Generate code using css-doodle generators.

* `svg`: Generate SVG code using svg() function.
* `polygon`: Generate CSS polygon() using shape() function.

```bash
cssd generate svg code.css
cssd generate polygon code.css

# read from STDIN
cssd generate polygon
```

### config

Display/set the configurations in key/value pairs. Currently only two configuration names are recognized:

* `set`:  Set a configuration with key/value pair.
* `get`:  Get a configuration value by key.
* `list`: List all configurations.

Recognizable configurations:

* `browserPath`: The path to the browser executable.  
* `css-doodle`: The path to the css-doodle to use.

```bash
# show all configurations
cssd config list

# use a custom browser
cssd config set browserPath /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# reset
cssd config set browserPath ''

# get the value
cssd config get browserPath

# download and use a custom version of css-doodle
cssd config set css-doodle 0.40.6
```

### use
Shorthand of `cssd config set css-doodle <version>`. 

```bash
cssd use css-doodle@0.40.6

# or just version
cssd use 0.40.6
cssd use latest
```
