import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

// Use a fresh config so a custom css-doodle version doesn't affect the result,
// set before loading the CLI modules, which read the config when loaded.
// Not by changing HOME, since Chrome on Windows fails to launch with another USERPROFILE.
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cssd-record-'));
process.env.XDG_CONFIG_HOME = path.join(tmpDir, '.config');
after(() => fs.rm(tmpDir, { recursive: true, force: true }));

const { findSystemBrowser } = await import('../lib/browser.js');
const { defaultAppArgs } = await import('../lib/static.js');
const { prepareOutput, render } = await import('../lib/render/index.js');

const cli = fileURLToPath(new URL('../bin/index.js', import.meta.url));
const browser = await findSystemBrowser();

// The macOS and Windows runners have no real GPU, and record only 15-40 frames per second,
// so only check there that the animation is recorded at all.
const slowRunner = Boolean(process.env.CI) && process.platform !== 'linux';
const minFrames = (frames) => slowRunner ? 10 : frames;

// Reads the codec, frame size and frame count of a recording, which has a single video track.
function readMp4(buf) {
    const info = { codec: null, width: 0, height: 0, frames: 0 };
    const containers = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'moof', 'traf'];
    const walk = (start, end) => {
        for (let i = start; i + 8 <= end;) {
            let size = buf.readUInt32BE(i);
            const type = buf.toString('latin1', i + 4, i + 8);
            if (size === 1) size = Number(buf.readBigUInt64BE(i + 8));
            if (size === 0) size = end - i;
            if (size < 8) break;
            if (containers.includes(type)) {
                walk(i + 8, i + size);
            } else if (type === 'stsd') {
                const entry = i + 16;
                info.codec = buf.toString('latin1', entry + 4, entry + 8);
                info.width = buf.readUInt16BE(entry + 32);
                info.height = buf.readUInt16BE(entry + 34);
            } else if (type === 'stsz') {
                info.frames += buf.readUInt32BE(i + 16);
            } else if (type === 'trun') {
                info.frames += buf.readUInt32BE(i + 12);
            }
            i += size;
        }
    };
    walk(0, buf.length);
    return info;
}

// Chrome only writes a frame when something changes on the page,
// so the frame count tells how much of an animation was recorded.
describe('record', { skip: !browser && 'no browser found' }, () => {
    const spin = `
        @grid: 4 / 200px;
        background: hsl(calc(@i * 20), 70%, 60%);
        animation: spin 1s linear infinite;
        @keyframes spin { to { transform: rotate(1turn) } }
    `;

    async function renderFile(name, code, ext, args) {
        const source = path.join(tmpDir, `${name}.css`);
        const output = path.join(tmpDir, `${name}.${ext}`);
        await fs.writeFile(source, code);
        await promisify(execFile)(process.execPath, [cli, 'render', source, '-o', output, '-q', '-y', ...args]);
        return output;
    }

    async function record(name, code, args) {
        return readMp4(await fs.readFile(await renderFile(name, code, 'mp4', args)));
    }

    // The first launch of the browser is slow on the runners, and once recorded a still video on macOS.
    before(() => renderFile('warm-up', spin, 'png', []));

    it('should record the doodle at 60fps', async () => {
        const info = await record('spin', spin, ['-t', '1s', '-x', '2']);
        assert.strictEqual(info.codec, 'av01');
        assert.strictEqual(info.width, 400);
        assert.strictEqual(info.height, 400);
        assert.ok(info.frames >= minFrames(45), `expected about 60 frames, got ${info.frames}`);
    });

    it('should record the animation from the start', async () => {
        const code = `
            @grid: 4 / 200px;
            background: red;
            animation: shrink 1s forwards;
            @keyframes shrink { to { transform: scale(.5) } }
        `;
        const info = await record('once', code, ['-t', '2s']);
        assert.ok(info.frames >= minFrames(50), `expected about 60 frames of the 1s animation, got ${info.frames}`);
    });

    // css-doodle pauses when the system reduces motion.
    it('should record the animation when the system reduces motion', async () => {
        const output = path.join(tmpDir, 'reduced.mp4');
        // Chrome takes the setting from the system, so force it in Chrome, rendering in this process to add the flag.
        defaultAppArgs.push('--force-prefers-reduced-motion');
        try {
            const options = { output, type: 'css', time: 1000, quiet: true, yes: true };
            await prepareOutput(options);
            await render(spin, options);
        } finally {
            defaultAppArgs.pop();
        }
        const info = readMp4(await fs.readFile(output));
        assert.ok(info.frames >= minFrames(45), `expected about 60 frames, got ${info.frames}`);
    });
});
