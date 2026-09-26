import { describe, it } from 'node:test';
import assert from 'node:assert';
import { read } from '../lib/read.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
            { input: 'https://codepen.io/user/pen/abc123/', type: 'trailing-slash' },
            { input: 'https://codepen.io/user/pen/abc123?editors=1100', type: 'query' },
            { input: 'https://codepen.io/user/pen/abc123/#code', type: 'hash' },
        ];
        for (const { input } of urls) {
            const result = await read(input);
            assert.strictEqual(result.type, 'codepen');
            assert.strictEqual(result.content, 'https://cdpn.io/user/fullpage/abc123?nocache=true&view=fullpage');
        }
    });

    it('throws error for invalid CodePen URL', async () => {
        await assert.rejects(
            async () => await read('https://codepen.io/user'),
            /unsupported CodePen url/,
        );
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

    it('encodes special characters in HTML file URL', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'css-doodle-test-'));
        const testFile = join(tempDir, 'a #b %20.html');
        await writeFile(testFile, '<html></html>');
        try {
            const result = await read(testFile);
            assert.ok(result.content.endsWith('/a%20%23b%20%2520.html'));
            assert.strictEqual(fileURLToPath(result.content), testFile);
        } finally {
            await rm(tempDir, { recursive: true });
        }
    });

    it('accepts upper case extensions', async () => {
        const css = await withTempFile('CSS', '@grid: 5x5;', read);
        assert.strictEqual(css.type, 'css');
        const html = await withTempFile('HTML', '<html></html>', read);
        assert.strictEqual(html.type, 'html');
    });

    it('throws error for non-existing CSS file', async () => {
        await assert.rejects(
            async () => await read('/non/existing/file.css'),
            /file not found/,
        );
    });

    it('throws error for non-existing HTML file', async () => {
        await assert.rejects(
            async () => await read('/non/existing/file.html'),
            /file not found/,
        );
    });
});

describe('read - invalid inputs', () => {
    it('throws error for unsupported file extension', async () => {
        await assert.rejects(
            async () => await read('file.txt'),
            /invalid input/,
        );
    });

    it('throws error for path without extension', async () => {
        await assert.rejects(
            async () => await read('random/path/without/extension'),
            /invalid input/,
        );
    });
});
