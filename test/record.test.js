import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { findSystemBrowser } from '../lib/browser.js';

const cli = fileURLToPath(new URL('../bin/index.js', import.meta.url));
const browser = await findSystemBrowser();

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
    let tmpDir;
    let env;

    before(async () => {
        // Use a fresh config so a custom css-doodle version doesn't affect the result.
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cssd-record-'));
        const configDir = path.join(tmpDir, '.config', 'css-doodle');
        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(path.join(configDir, 'config.json'), JSON.stringify({ browserPath: browser }));
        env = { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir };
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    async function record(name, code, args) {
        const source = path.join(tmpDir, `${name}.css`);
        const output = path.join(tmpDir, `${name}.mp4`);
        await fs.writeFile(source, code);
        await promisify(execFile)(process.execPath, [cli, 'render', source, '-o', output, '-q', '-y', ...args], { env });
        return readMp4(await fs.readFile(output));
    }

    it('should record the doodle at 60fps', async () => {
        const code = `
            @grid: 4 / 200px;
            background: hsl(calc(@i * 20), 70%, 60%);
            animation: spin 1s linear infinite;
            @keyframes spin { to { transform: rotate(1turn) } }
        `;
        const info = await record('spin', code, ['-t', '1s', '-x', '2']);
        assert.strictEqual(info.codec, 'av01');
        assert.strictEqual(info.width, 400);
        assert.strictEqual(info.height, 400);
        assert.ok(info.frames >= 45, `expected about 60 frames, got ${info.frames}`);
    });

    it('should record the animation from the start', async () => {
        const code = `
            @grid: 4 / 200px;
            background: red;
            animation: shrink 1s forwards;
            @keyframes shrink { to { transform: scale(.5) } }
        `;
        const info = await record('once', code, ['-t', '2s']);
        assert.ok(info.frames >= 50, `expected about 60 frames of the 1s animation, got ${info.frames}`);
    });
});
