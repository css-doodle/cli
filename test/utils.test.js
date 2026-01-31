import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkExists, readTime } from '../lib/utils.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function withTempFile(content, callback) {
    const tempDir = await mkdtemp(join(tmpdir(), 'css-doodle-test-'));
    const testFile = join(tempDir, 'test.txt');
    await writeFile(testFile, content);
    try {
        return await callback(testFile);
    } finally {
        await rm(tempDir, { recursive: true });
    }
}

describe('readTime', () => {
    it('parses milliseconds', () => {
        assert.strictEqual(readTime('100ms'), 100);
        assert.strictEqual(readTime('0ms'), 0);
        assert.strictEqual(readTime('5000ms'), 5000);
    });

    it('parses plain numbers as milliseconds', () => {
        assert.strictEqual(readTime('100'), 100);
        assert.strictEqual(readTime('0'), 0);
        assert.strictEqual(readTime('5000'), 5000);
    });

    it('parses seconds', () => {
        assert.strictEqual(readTime('1s'), 1000);
        assert.strictEqual(readTime('0s'), 0);
        assert.strictEqual(readTime('5s'), 5000);
        assert.strictEqual(readTime('30s'), 30000);
    });

    it('parses minutes', () => {
        assert.strictEqual(readTime('1m'), 60000);
        assert.strictEqual(readTime('0m'), 0);
        assert.strictEqual(readTime('2m'), 120000);
    });

    it('returns 0 for invalid formats', () => {
        const invalid = ['invalid', 'abc', '', '1d', '1.5s'];
        for (const input of invalid) {
            assert.strictEqual(readTime(input), 0, `expected 0 for "${input}"`);
        }
    });

    it('respects max option', () => {
        assert.strictEqual(readTime('100s', { max: 5000 }), 5000);
        assert.strictEqual(readTime('10s', { max: 5000 }), 5000);
        assert.strictEqual(readTime('3s', { max: 5000 }), 3000);
        assert.strictEqual(readTime('10000', { max: 5000 }), 5000);
    });
});

describe('checkExists', () => {
    it('returns true for existing file', async () => {
        const result = await withTempFile('test content', checkExists);
        assert.strictEqual(result, true);
    });

    it('returns false for non-existing file', async () => {
        assert.strictEqual(await checkExists('/non/existing/path/file.txt'), false);
    });

    it('returns false for non-existing directory', async () => {
        assert.strictEqual(await checkExists('/non/existing/directory/'), false);
    });
});
