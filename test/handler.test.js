import { describe, it } from 'node:test';
import assert from 'node:assert';
import { compareVersions, getTitle, isPackageVersion, isValidCssDoodleFile, normalizeConfigField } from '../lib/handler.js';
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

    it('accepts css-doodle@latest', () => {
        assert.strictEqual(isPackageVersion('css-doodle@latest'), true);
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

describe('normalizeConfigField', () => {
    it('maps browser path aliases to browserPath', () => {
        for (const alias of ['browserPath', 'browser-path', 'executablePath', 'executable-path']) {
            assert.strictEqual(normalizeConfigField(alias), 'browserPath');
        }
    });

    it('keeps other fields as is', () => {
        assert.strictEqual(normalizeConfigField('css-doodle'), 'css-doodle');
        assert.strictEqual(normalizeConfigField('foo'), 'foo');
    });
});

describe('getTitle', () => {
    it('returns undefined for stdin', () => {
        assert.strictEqual(getTitle(undefined, 'stdin'), undefined);
        assert.strictEqual(getTitle('-', 'stdin'), undefined);
    });

    it('uses the file name without extension', () => {
        assert.strictEqual(getTitle('path/to/code.css', 'css'), 'code');
        assert.strictEqual(getTitle('page.html', 'html'), 'page');
    });

    it('uses the pen id for CodePen links', () => {
        assert.strictEqual(getTitle('https://codepen.io/user/pen/MQEeJo', 'codepen'), 'MQEeJo');
        assert.strictEqual(getTitle('codepen.io/user/pen/MQEeJo/?editors=1100', 'codepen'), 'MQEeJo');
    });

    it('uses the doodle id for css-doodle links', () => {
        assert.strictEqual(getTitle('https://css-doodle.com/d/R3WhVB20fJ9fbZ1L', 'doodle'), 'R3WhVB20fJ9fbZ1L');
        assert.strictEqual(getTitle('css-doodle.com/d/R3WhVB20fJ9fbZ1L/?x=1', 'doodle'), 'R3WhVB20fJ9fbZ1L');
    });

    it('uses the last path segment or hostname for URLs', () => {
        assert.strictEqual(getTitle('https://example.com/foo/bar.html?q=1', 'webpage'), 'bar');
        assert.strictEqual(getTitle('https://example.com/foo/', 'webpage'), 'foo');
        assert.strictEqual(getTitle('https://example.com/?q=1', 'webpage'), 'example.com');
        assert.strictEqual(getTitle('https://example.com/a%20b', 'webpage'), 'a-b');
    });
});

describe('compareVersions', () => {
    it('compares major, minor, and patch numerically', () => {
        assert.strictEqual(compareVersions('1.12.1', '1.12.1'), 0);
        assert.strictEqual(compareVersions('1.12.1', '1.12.0'), 1);
        assert.strictEqual(compareVersions('1.9.0', '1.12.0'), -1);
        assert.strictEqual(compareVersions('2.0.0', '1.99.99'), 1);
    });

    it('ignores prerelease tags', () => {
        assert.strictEqual(compareVersions('1.13.0-beta.1', '1.13.0'), 0);
    });
});
