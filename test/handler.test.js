import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isPackageVersion, isValidCssDoodleFile } from '../lib/handler.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function withTempFile(content, callback) {
    const tempDir = await mkdtemp(join(tmpdir(), 'css-doodle-test-'));
    const testFile = join(tempDir, 'test.js');
    await writeFile(testFile, content);
    try {
        return await callback(testFile);
    } finally {
        await rm(tempDir, { recursive: true });
    }
}

describe('isPackageVersion', () => {
    it('accepts "latest"', () => {
        assert.strictEqual(isPackageVersion('latest'), true);
    });

    it('accepts semantic versions', () => {
        const valid = ['1.0.0', '0.48.0', '10.20.30'];
        for (const v of valid) {
            assert.strictEqual(isPackageVersion(v), true, `expected ${v} to be valid`);
        }
    });

    it('accepts versions with css-doodle@ prefix', () => {
        assert.strictEqual(isPackageVersion('css-doodle@1.0.0'), true);
        assert.strictEqual(isPackageVersion('css-doodle@0.48.0'), true);
    });

    it('rejects css-doodle@latest (only bare "latest" is valid)', () => {
        assert.strictEqual(isPackageVersion('css-doodle@latest'), false);
    });

    it('rejects invalid versions', () => {
        const invalid = ['v1.0.0', '1.0', '1', '', 'invalid', '1.0.0.0'];
        for (const v of invalid) {
            assert.strictEqual(isPackageVersion(v), false, `expected "${v}" to be invalid`);
        }
    });

    it('rejects invalid css-doodle@ prefixes', () => {
        assert.strictEqual(isPackageVersion('css-doodle@'), false);
        assert.strictEqual(isPackageVersion('css-doodle@v1.0.0'), false);
        assert.strictEqual(isPackageVersion('cssdoodle@1.0.0'), false);
    });
});

describe('isValidCssDoodleFile', () => {
    it('returns true for file with css-doodle header', async () => {
        const result = await withTempFile(
            '/*! css-doodle v0.48.0 */\n// some code',
            isValidCssDoodleFile,
        );
        assert.strictEqual(result, true);
    });

    it('returns false for file without css-doodle header', async () => {
        const result = await withTempFile(
            '// some other code\nconsole.log("hello");',
            isValidCssDoodleFile,
        );
        assert.strictEqual(result, false);
    });

    it('returns false for empty file', async () => {
        const result = await withTempFile('', isValidCssDoodleFile);
        assert.strictEqual(result, false);
    });

    it('returns false for non-existing file', async () => {
        assert.strictEqual(await isValidCssDoodleFile('/non/existing/file.js'), false);
    });

    it('returns false for file with similar but different header', async () => {
        const result = await withTempFile(
            '/* css-doodle without exclamation */',
            isValidCssDoodleFile,
        );
        assert.strictEqual(result, false);
    });
});
