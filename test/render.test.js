import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildHTML, getOutputInfo, maybeHTML, prepareOutput, processIfOutputExists } from '../lib/render/index.js';
import { getClip } from '../lib/render/screencast.js';

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

    it('should accept jpg as jpeg and keep the .jpg extension', () => {
        const options = { output: 'a.jpg' };
        const result = getOutputInfo(options);
        assert.strictEqual(options.output, 'a.jpg');
        assert.strictEqual(result.format, 'jpeg');
        assert.strictEqual(result.type, 'image');
        assert.strictEqual(result.extension, 'jpg');
    });

    it('should accept -f jpg and name the output with .jpg', () => {
        const options = { format: 'jpg', output: 'a' };
        const result = getOutputInfo(options);
        assert.strictEqual(options.output, 'a.jpg');
        assert.strictEqual(result.format, 'jpeg');
        assert.strictEqual(getOutputInfo({ format: 'JPG' }).extension, 'jpg');
    });

    it('should treat jpg and jpeg as the same format', () => {
        const result = getOutputInfo({ format: 'jpg', output: 'a.jpeg' });
        assert.strictEqual(result.format, 'jpeg');
        assert.strictEqual(result.extension, 'jpeg');
    });

    it('should report the format as spelled when it conflicts', () => {
        assert.throws(() => {
            getOutputInfo({ format: 'jpg', output: 'a.png' });
        }, /conflicting format 'jpg' and output extension 'png'/);
    });

    it('should throw error for unsupported media extensions', () => {
        for (const output of ['a.svg', 'a.BMP', 'a.mov']) {
            assert.throws(() => {
                getOutputInfo({ output });
            }, /unsupported output format/);
        }
    });

    it('should keep other dotted names and append the extension', () => {
        const options = { output: 'my.doodle' };
        getOutputInfo(options);
        assert.strictEqual(options.output, 'my.doodle.png');
    });

    it('should use the format as the extension by default', () => {
        assert.strictEqual(getOutputInfo({}).extension, 'png');
        assert.strictEqual(getOutputInfo({ time: 5000 }).extension, 'mp4');
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

    it('should omit the seed attribute by default', () => {
        const result = buildHTML('code', 'lib');
        assert.ok(result.includes('<css-doodle><template>'));
    });

    it('should set the seed attribute when a seed is given', () => {
        const result = buildHTML('code', 'lib', 'abc');
        assert.ok(result.includes('<css-doodle seed="abc"><template>'));
    });

    it('should escape the seed attribute', () => {
        const result = buildHTML('code', 'lib', '"><script>');
        assert.ok(result.includes('<css-doodle seed="&quot;>&lt;script>"><template>'));
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

    it('should throw in non-TTY when file exists and yes is false', async () => {
        await fs.writeFile(testFile, 'test content');
        // isTTY is false in test environment
        await assert.rejects(processIfOutputExists(testFile, false), /already exists/);
        await fs.unlink(testFile);
    });

    it('should throw when it can not prompt and the file exists', async () => {
        await fs.writeFile(testFile, 'test content');
        await assert.rejects(processIfOutputExists(testFile, false, { prompt: false }), /already exists/);
        assert.strictEqual(await processIfOutputExists(testFile, true, { prompt: false }), true);
        await fs.unlink(testFile);
    });
});

describe('prepareOutput', () => {
    let tempDir;

    before(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cssd-test-'));
    });

    after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should resolve the format of an output file', async () => {
        const options = { output: path.join(tempDir, 'a.jpg') };
        assert.strictEqual(await prepareOutput(options), true);
        assert.strictEqual(options.format, 'jpeg');
        assert.strictEqual(options.extension, 'jpg');
        assert.strictEqual(options.outputType, 'image');
        assert.strictEqual(options.outputDir, undefined);
    });

    it('should default the recording time of videos to 5s', async () => {
        const options = { format: 'mp4' };
        await prepareOutput(options);
        assert.strictEqual(options.outputType, 'video');
        assert.strictEqual(options.time, 5000);
    });

    it('should take a path ending with a slash as a directory', async () => {
        const output = path.join(tempDir, 'missing') + '/';
        const options = { output };
        assert.strictEqual(await prepareOutput(options), true);
        assert.strictEqual(options.output, undefined);
        assert.strictEqual(options.outputDir, output);
        assert.strictEqual(options.extension, 'png');
    });

    it('should take an existing directory as a directory', async () => {
        const options = { output: tempDir, format: 'webp' };
        await prepareOutput(options);
        assert.strictEqual(options.output, undefined);
        assert.strictEqual(options.outputDir, tempDir);
        assert.strictEqual(options.extension, 'webp');
    });

    it('should report an existing output file before rendering', async () => {
        const output = path.join(tempDir, 'exists.png');
        await fs.writeFile(output, '');
        await assert.rejects(prepareOutput({ output }), /already exists/);
        assert.strictEqual(await prepareOutput({ output, yes: true }), true);
    });

    it('should report an invalid format before rendering', async () => {
        await assert.rejects(prepareOutput({ format: 'bmp' }), /unrecognized format 'bmp'/);
        await assert.rejects(prepareOutput({ output: 'a.svg' }), /unsupported output format 'svg'/);
    });
});

describe('getClip', () => {
    it('should clip to the element rect', () => {
        const clip = getClip({ x: 440, y: 240, width: 320, height: 320 }, 1200, 800);
        assert.deepStrictEqual(clip, { x: 440, y: 240, width: 320, height: 320 });
    });

    it('should clamp negative offsets to 0', () => {
        const clip = getClip({ x: -150, y: -50, width: 900, height: 700 }, 600, 400);
        assert.deepStrictEqual(clip, { x: 0, y: 0, width: 900, height: 700 });
    });

    it('should fall back to the full window when element is missing or empty', () => {
        assert.deepStrictEqual(getClip(undefined, 640, 480), { x: 0, y: 0, width: 640, height: 480 });
        assert.deepStrictEqual(getClip({ x: 10, y: 10, width: 0, height: 0 }, 640, 480), { x: 0, y: 0, width: 640, height: 480 });
    });
});
