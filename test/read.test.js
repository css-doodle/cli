import { describe, it } from 'node:test';
import assert from 'node:assert';
import { read } from '../lib/read.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function withTempFile(ext, content, callback) {
    const tempDir = await mkdtemp(join(tmpdir(), 'css-doodle-test-'));
    const testFile = join(tempDir, `test.${ext}`);
    await writeFile(testFile, content);
    try {
        return await callback(testFile);
    } finally {
        await rm(tempDir, { recursive: true });
    }
}

describe('read - URL parsing', () => {
    it('parses CodePen URLs', async () => {
        const urls = [
            { input: 'https://codepen.io/user/pen/abc123', type: 'pen' },
            { input: 'https://codepen.io/user/details/abc123', type: 'details' },
            { input: 'https://codepen.io/user/full/abc123', type: 'full' },
            { input: 'codepen.io/user/pen/abc123', type: 'no-protocol' },
        ];
        for (const { input } of urls) {
            const result = await read(input);
            assert.strictEqual(result.type, 'codepen');
            assert.strictEqual(result.content, 'https://cdpn.io/user/fullpage/abc123?nocache=true&view=fullpage');
        }
    });

    it('returns error for invalid CodePen URL', async () => {
        const result = await read('https://codepen.io/user');
        assert.strictEqual(result.type, 'codepen');
        assert.ok(result.error?.message.includes('unsupported CodePen url'));
    });

    it('parses HTTP(S) URLs', async () => {
        const https = await read('https://example.com/style.css');
        assert.strictEqual(https.type, 'webpage');
        assert.strictEqual(https.content, 'https://example.com/style.css');
        assert.ok(!https.error);

        const http = await read('http://example.com/style.css');
        assert.strictEqual(http.type, 'webpage');
        assert.strictEqual(http.content, 'http://example.com/style.css');
    });
});

describe('read - file handling', () => {
    it('reads CSS files', async () => {
        const result = await withTempFile('css', '@grid: 5x5;', read);
        assert.strictEqual(result.type, 'css');
        assert.strictEqual(result.content, '@grid: 5x5;');
        assert.ok(!result.error);
    });

    it('reads .cssd files', async () => {
        const result = await withTempFile('cssd', '@grid: 3x3;', read);
        assert.strictEqual(result.type, 'css');
        assert.strictEqual(result.content, '@grid: 3x3;');
    });

    it('trims whitespace from content', async () => {
        const result = await withTempFile('css', '  \n  @grid: 5x5;  \n  ', read);
        assert.strictEqual(result.content, '@grid: 5x5;');
    });

    it('reads HTML files and converts to file URL', async () => {
        const result = await withTempFile('html', '<html></html>', read);
        assert.strictEqual(result.type, 'html');
        assert.ok(result.content.startsWith('file://'));
        assert.ok(result.content.includes('test.html'));
        assert.ok(!result.error);
    });

    it('returns error for non-existing CSS file', async () => {
        const result = await read('/non/existing/file.css');
        assert.strictEqual(result.type, 'css');
        assert.ok(result.error?.code === 'ENOENT' || result.error?.message?.includes('ENOENT'));
    });

    it('returns error for non-existing HTML file', async () => {
        const result = await read('/non/existing/file.html');
        assert.strictEqual(result.type, 'html');
        assert.ok(result.error?.message.includes('file not found'));
    });
});

describe('read - invalid inputs', () => {
    it('returns error for unsupported file extension', async () => {
        const result = await read('file.txt');
        assert.ok(result.error?.message.includes('invalid input'));
    });

    it('returns error for path without extension', async () => {
        const result = await read('random/path/without/extension');
        assert.ok(result.error);
    });
});
