// Run by `npm version` after the bump: moves the Unreleased notes in CHANGELOG.md
// under the new version and points the compare links at its tag.
import fs from 'node:fs';
import process from 'node:process';

const file = new URL('../CHANGELOG.md', import.meta.url);
const version = process.env.npm_package_version;
const now = new Date();
const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-');

function fail(message) {
    console.error(`CHANGELOG.md: ${message}`);
    process.exit(1);
}

let text = fs.readFileSync(file, 'utf8');

if (!version) fail('run this through `npm version`');
if (text.includes(`## [${version}]`)) fail(`already has ${version}`);

const unreleased = text.match(/^## \[Unreleased\]\n([\s\S]*?)^## \[/m);
if (!unreleased || !unreleased[1].trim()) fail('nothing under ## [Unreleased]');

const link = /^\[Unreleased\]: (\S+)\/compare\/(\S+)\.\.\.HEAD$/m;
if (!link.test(text)) fail('no [Unreleased] compare link');

text = text
    .replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${version}] - ${date}\n`)
    .replace(link, `[Unreleased]: $1/compare/v${version}...HEAD\n[${version}]: $1/compare/$2...v${version}`);

fs.writeFileSync(file, text);
