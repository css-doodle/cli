# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.12.1] - TBD

### Fixed

- Remove `process.exit` from library code, making the code more testable
- Update overwrite prompt to use readline and accept Enter as default
- Fix error handling, race condition, and async patterns

### Changed

- Code cleanups and refactoring

## [1.12.0] - 2026-01-31

### Added

- Add `-y/--yes` option to render command for auto-overwrite without prompting
- Add single-key detection for overwrite prompt (no need to press Enter)
- Add live countdown timer during screen recording
- Add `clearLine()` utility for better terminal output management
- Add tests for improved code reliability

### Changed

- Switch to `puppeteer-core` with on-demand browser download for lighter installation
- Refactor logging to use consistent icons and colors throughout CLI
- Improve terminal clearing behavior with dedicated utilities

### Fixed

- Fix zombie process risk in preview command by improving resource cleanup
- Fix screencast viewport scaling issues with proper input validation
- Ensure browser always closes properly with try/finally blocks
- Fix memory leaks by cleaning up stdin event listeners
- Fix terminal row clearing issues (clearRow improvements)
- Fix user abort handling in render command
- Fix JSON.parse() encoding parameter placement
- Remove unnecessary `process.send` call in `getCssDoodleLib`
- Fix various Deno lint warnings

### Security

- Improved error handling across static.js and parse.js
- Standardized error handling patterns in all CLI command handlers

## [1.11.1] - 2025-01-19

### Fixed

- Fix double clearRow and normalize error messages
- Improve console output consistency

## [1.11.0] - 2025-01-19

### Added

- Add `gen` command alias for `generate`
- Add `--show-paint-rects` and `--show-fps-counter` options for debugging

### Changed

- Use `run` as the default command when no command is specified

### Fixed

- Fix local css-doodle library path resolution
- Do not add extra line to terminal after stdin finish
- Improve HTML detection in render command
- Fix dependencies security in Puppeteer (upgraded from 24.16.2 to 24.25.0)

## [1.10.0] - 2025-01-13

### Added

- Allow `stdin` to render direct HTML content
- Enhanced CLI update process with better user feedback

### Fixed

- Fix GPU-related flags for better compatibility
- Fix typo in render command argument description
- Fix typo in gen command example

## [1.9.1] - 2025-01-10

### Fixed

- Check for new version before updating CLI to prevent unnecessary updates

## [1.9.0] - 2025-01-09

### Added

- Initial support for video recording with `-t/--time` option
- Add `--fullscreen` option for preview mode

### Changed

- Upgrade Puppeteer to 24.x for improved stability

## [1.8.0] - 2024-12-20

### Added

- Add `use` command to fetch and use custom versions of css-doodle
- Add `config` command for managing CLI configurations

### Fixed

- Improve CodePen link handling

## [1.7.0] - 2024-12-10

### Added

- Add support for rendering from CodePen URLs
- Add `parse` command for debugging parsed tokens

### Changed

- Refactor command structure for better maintainability

## [1.6.0] - 2024-11-28

### Added

- Add scale factor (`-x/--scale`) option for higher resolution output
- Add delay (`-d/--delay`) option for timing screenshot capture

### Fixed

- Improve error messages for missing files

## [1.5.0] - 2024-11-15

### Added

- Add output format selection (`-f/--format`) for images and videos
- Add window size configuration (`-w/--window`)

### Changed

- Default output format is now PNG for images

## [1.4.0] - 2024-11-01

### Added

- Add `render` command for generating static images
- Add `preview`/`run` command for live preview

### Fixed

- Fix browser window sizing issues

## [1.3.0] - 2024-10-20

### Added

- Initial release with basic CLI functionality
- Support for `.css` and `.cssd` file types
- File watching for live reload during preview

[1.12.1]: https://github.com/css-doodle/cli/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/css-doodle/cli/compare/v1.11.1...v1.12.0
[1.11.1]: https://github.com/css-doodle/cli/compare/v1.11.0...v1.11.1
[1.11.0]: https://github.com/css-doodle/cli/compare/v1.10.1...v1.11.0
[1.10.0]: https://github.com/css-doodle/cli/compare/v1.9.1...v1.10.0
[1.9.1]: https://github.com/css-doodle/cli/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/css-doodle/cli/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/css-doodle/cli/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/css-doodle/cli/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/css-doodle/cli/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/css-doodle/cli/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/css-doodle/cli/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/css-doodle/cli/releases/tag/v1.3.0
