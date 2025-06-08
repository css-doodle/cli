# @css-doodle/cli

Command-line tool for css-doodle to preview and generate images/videos.

<img src="screenshot/preview.png" width="480px" alt="screenshot" />

## Installation

```bash
npm install -g @css-doodle/cli
```

>[!NOTE]
> After installation, you can use `cssd` or `css-doodle` command in the terminal.

## Usage

```console
Usage: cssd [options] [command] [source]

Arguments:
  source         css-doodle source file to preview (same as run command)

Options:
  -V, --version  output the version number
  -h, --help     display help for command

Commands:
  run            Open a window to preview the css|cssd file
  render         Generate an image from a css/cssd/html file, CodePen link, or http(s) URL
  generate       Generate code using css-doodle generators
  config         Display/set configurations
  use            Shorthand to fetch and use a custom version of css-doodle
  parse          Print the parsed tokens, help to debug in development
  upgrade        Upgrade CLI to latest version
```

## Commands

### run
Open a window to preview the css-doodle source file. The source file can be either `.css` or `.cssd`.

* `--fullscreen`: Open in fullscreen mode.

```bash
cssd run code.css
cssd run code.css --fullscreen
```

The `run` can be omitted if you just want to preview.

```bash
cssd somefile.css
```

### render
Generate an image/video from the css-doodle source file.
The source file can be a `.css`, `.cssd`, `.html` file, CodePen link, or http(s) URL.

* `-o, --output <output>`:      Custom output filename of the generated result
* `-x, --scale <scale>`:        Scale factor of the generated result, defaults to `2` for images, `1` for videos
* `-s, --selector <selector>`:  CSS selector to target the rendered node, defaults to `css-doodle`
* `-d, --delay <delay>`:        Delay time before taking screenshot/screencast, e.g, `2s`
* `-t, --time <time>`:          Record screen for a specific time, e.g, `10s`
* `-q, --quiet`:                Quiet mode, suppresses non-error output
* `-w, --window <size>`:        The size of the rendered window, defaults to `1600x1000` for images, `1200x900` for videos
* `--mp4`:                      Use `mp4` as the generated video format


```bash
cssd render
cssd render code.css
cssd render code.css -o result.png
cssd render code.css -x 4
cssd render https://codepen.io/yuanchuan/pen/MQEeJo
```

Screen recording:

```bash
cssd render -t 10s
```

By default the generated video is in `webm` format,
you can transform it automatically into `mp4` by adding `--mp4` option,
or use an output filename with `.mp4` extension.

```bash
cssd render -t 10s --mp4
cssd render -o result.mp4
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

Display/set the configurations in key/value pairs.

* `set <field> <value>`: Set a configuration with key/value pair.
* `get <field>`: Get a configuration value by key.
* `unset <field>`: Unset a configuration field.
* `list`: List all configurations.

Recognizable `field` configurations:

* `browserPath`: The path to the browser executable.
* `css-doodle`: The path to the css-doodle to use.

```bash
# show all configurations
cssd config list

# use a custom browser
cssd config set browserPath /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# unset
cssd config unset browserPath

# get the value
cssd config get browserPath

# download and use a custom version of css-doodle
cssd config set css-doodle 0.40.6
```

### use
Shorthand of `cssd config set css-doodle <version>`.

* `<version>`: The version of css-doodle to use. It can be a specific version or `latest`.

```bash
cssd use css-doodle@0.40.6

# or just version
cssd use 0.40.6
cssd use latest
```

### upgrade
Upgrade CLI to latest version.

```bash
cssd upgrade
```
