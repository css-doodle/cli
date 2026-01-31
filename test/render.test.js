import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildHTML, getOutputInfo, maybeHTML, processIfOutputExists } from '../lib/render/index.js';

describe('getOutputInfo', () => {
    it('should default to png format when no options provided', () => {
        const result = getOutputInfo({});
        assert.strictEqual(result.format, 'png');
        assert.strictEqual(result.type, 'image');
    });

    it('should default to mp4 format when time option is provided', () => {
        const result = getOutputInfo({ time: 5000 });
        assert.strictEqual(result.format, 'mp4');
        assert.strictEqual(result.type, 'video');
    });

    it('should use explicit format when provided', () => {
        const result = getOutputInfo({ format: 'webp' });
        assert.strictEqual(result.format, 'webp');
        assert.strictEqual(result.type, 'image');
    });

    it('should detect format from output filename extension', () => {
        const options = { output: 'test.webp' };
        const result = getOutputInfo(options);
        assert.strictEqual(result.format, 'webp');
        assert.strictEqual(result.type, 'image');
    });

    it('should detect video format from output filename extension', () => {
        const options = { output: 'test.mp4' };
        const result = getOutputInfo(options);
        assert.strictEqual(result.format, 'mp4');
        assert.strictEqual(result.type, 'video');
    });

    it('should throw error for unrecognized format', () => {
        assert.throws(() => {
            getOutputInfo({ format: 'bmp' });
        }, /unrecognized format 'bmp'/);
    });

    it('should throw error for conflicting format and extension', () => {
        assert.throws(() => {
            getOutputInfo({ format: 'png', output: 'test.mp4' });
        }, /conflicting format 'png' and output extension 'mp4'/);
    });

    it('should append extension to output without extension', () => {
        const options = { output: 'testfile', format: 'jpeg' };
        const result = getOutputInfo(options);
        assert.strictEqual(options.output, 'testfile.jpeg');
        assert.strictEqual(result.format, 'jpeg');
    });

    it('should default to mp4 extension when time is set but no format provided', () => {
        const options = { output: 'video', time: 5000 };
        const result = getOutputInfo(options);
        assert.strictEqual(options.output, 'video.mp4');
        assert.strictEqual(result.format, 'mp4');
        assert.strictEqual(result.type, 'video');
    });

    it('should support all image formats', () => {
        const imageFormats = ['png', 'jpeg', 'webp'];
        for (const format of imageFormats) {
            const result = getOutputInfo({ format });
            assert.strictEqual(result.format, format);
            assert.strictEqual(result.type, 'image');
        }
    });

    it('should support all video formats', () => {
        const videoFormats = ['mp4', 'webm', 'gif'];
        for (const format of videoFormats) {
            const result = getOutputInfo({ format });
            assert.strictEqual(result.format, format);
            assert.strictEqual(result.type, 'video');
        }
    });

    it('should be case insensitive for formats', () => {
        const result = getOutputInfo({ format: 'PNG' });
        assert.strictEqual(result.format, 'png');
    });
});

describe('buildHTML', () => {
    it('should wrap code in HTML template with css-doodle lib', () => {
        const code = '@grid: 5x5;';
        const lib = '/* css-doodle lib */';
        const result = buildHTML(code, lib);

        assert.ok(result.includes('<!doctype html>'));
        assert.ok(result.includes('<css-doodle>'));
        assert.ok(result.includes('</css-doodle>'));
        assert.ok(result.includes('<template>'));
        assert.ok(result.includes('@grid: 5x5;'));
        assert.ok(result.includes('/* css-doodle lib */'));
    });

    it('should escape HTML special characters in code', () => {
        const code = '<div>test</div>';
        const lib = 'lib';
        const result = buildHTML(code, lib);

        // The code should be inside the template tag
        assert.ok(result.includes('<template>'));
        assert.ok(result.includes(code));
    });

    it('should include proper viewport and styling', () => {
        const result = buildHTML('code', 'lib');

        assert.ok(result.includes('width: 100%'));
        assert.ok(result.includes('height: 100%'));
        assert.ok(result.includes('display: grid'));
    });
});

describe('maybeHTML', () => {
    it('should return true for HTML tags', () => {
        assert.strictEqual(maybeHTML('<div>'), true);
        assert.strictEqual(maybeHTML('<div></div>'), true);
        assert.strictEqual(maybeHTML('<span class="test">'), true);
        assert.strictEqual(maybeHTML('<img src="test.jpg" />'), true);
        assert.strictEqual(maybeHTML('<custom-element>'), true);
    });

    it('should return true for HTML with whitespace', () => {
        assert.strictEqual(maybeHTML('  <div>'), true);
        assert.strictEqual(maybeHTML('\t\n<html>'), true);
    });

    it('should return true for DOCTYPE declarations', () => {
        assert.strictEqual(maybeHTML('<!DOCTYPE html>'), true);
        assert.strictEqual(maybeHTML('<!doctype html>'), true);
    });

    it('should return true for XML declarations', () => {
        assert.strictEqual(maybeHTML('<?xml version="1.0"?>'), true);
    });

    it('should return true for HTML comments', () => {
        assert.strictEqual(maybeHTML('<!-- comment -->'), true);
    });

    it('should return false for non-HTML strings', () => {
        assert.strictEqual(maybeHTML('plain text'), false);
        assert.strictEqual(maybeHTML('@grid: 5x5;'), false);
        assert.strictEqual(maybeHTML('css-doodle { }'), false);
        assert.strictEqual(maybeHTML(''), false);
    });

    it('should return false for CSS-like content', () => {
        assert.strictEqual(maybeHTML('.class { color: red; }'), false);
        assert.strictEqual(maybeHTML('#id { width: 100px; }'), false);
    });

    it('should handle self-closing tags', () => {
        assert.strictEqual(maybeHTML('<br/>'), true);
        assert.strictEqual(maybeHTML('<input type="text"/>'), true);
    });
});

describe('processIfOutputExists', () => {
    let tempDir;
    let testFile;

    before(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cssd-test-'));
        testFile = path.join(tempDir, 'test-output.png');
    });

    after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should return true when file does not exist', async () => {
        const nonExistentFile = path.join(tempDir, 'non-existent.png');
        const result = await processIfOutputExists(nonExistentFile, false);
        assert.strictEqual(result, true);
    });

    it('should return true when file exists and yes is true', async () => {
        await fs.writeFile(testFile, 'test content');
        const result = await processIfOutputExists(testFile, true);
        assert.strictEqual(result, true);
        await fs.unlink(testFile);
    });

    it('should return true when file does not exist even with yes=true', async () => {
        const nonExistentFile = path.join(tempDir, 'non-existent-2.png');
        const result = await processIfOutputExists(nonExistentFile, true);
        assert.strictEqual(result, true);
    });
});
