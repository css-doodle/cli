import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readTime } from '../lib/utils.js';
import { getOutputInfo } from '../lib/render/index.js';

describe('CLI option parsing - readTime for delay/time options', () => {
    it('should parse delay option with seconds', () => {
        const delay = readTime('2s');
        assert.strictEqual(delay, 2000);
    });

    it('should parse delay option with milliseconds', () => {
        const delay = readTime('500ms');
        assert.strictEqual(delay, 500);
    });

    it('should parse time option with seconds', () => {
        const time = readTime('10s');
        assert.strictEqual(time, 10000);
    });

    it('should parse time option with minutes', () => {
        const time = readTime('1m');
        assert.strictEqual(time, 60000);
    });

    it('should cap delay at max value', () => {
        const delay = readTime('60s', { max: 30 * 1000 });
        assert.strictEqual(delay, 30000);
    });

    it('should cap time at max value', () => {
        const time = readTime('120s', { max: 60 * 1000 });
        assert.strictEqual(time, 60000);
    });

    it('should handle zero values', () => {
        assert.strictEqual(readTime('0s'), 0);
        assert.strictEqual(readTime('0'), 0);
        assert.strictEqual(readTime('0ms'), 0);
    });

    it('should return 0 for invalid time format', () => {
        assert.strictEqual(readTime('invalid'), 0);
        assert.strictEqual(readTime(''), 0);
        assert.strictEqual(readTime('1x'), 0);
    });
});

describe('CLI option parsing - window size', () => {
    it('should parse window size with x separator', () => {
        const window = '1600x1000';
        const [w, h = w] = window.split(/[,x]/);
        assert.strictEqual(Number(w), 1600);
        assert.strictEqual(Number(h), 1000);
    });

    it('should parse window size with comma separator', () => {
        const window = '1200,800';
        const [w, h = w] = window.split(/[,x]/);
        assert.strictEqual(Number(w), 1200);
        assert.strictEqual(Number(h), 800);
    });

    it('should use width as height when no height provided', () => {
        const window = '800';
        const [w, h = w] = window.split(/[,x]/);
        assert.strictEqual(Number(w), 800);
        assert.strictEqual(Number(h), 800);
    });

    it('should parse square window', () => {
        const window = '1000x1000';
        const [w, h = w] = window.split(/[,x]/);
        assert.strictEqual(Number(w), 1000);
        assert.strictEqual(Number(h), 1000);
    });
});

describe('CLI option parsing - window size validation', () => {
    it('should reject invalid window size format', () => {
        const invalidSizes = ['abc', '100xabc', 'abcx100', '0x100', '100x0', '-100x200'];
        for (const size of invalidSizes) {
            const [w, h = w] = size.split(/[,x]/);
            const width = Number(w);
            const height = Number(h);
            const isValid = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
            assert.strictEqual(isValid, false, `expected "${size}" to be invalid`);
        }
    });

    it('should reject window size exceeding maximum', () => {
        const width = 9000;
        const height = 1000;
        const exceedsMax = width > 8192 || height > 8192;
        assert.strictEqual(exceedsMax, true);
    });

    it('should accept valid window sizes', () => {
        const validSizes = ['800x600', '1920x1080', '100x100', '8192x8192'];
        for (const size of validSizes) {
            const [w, h = w] = size.split(/[,x]/);
            const width = Number(w);
            const height = Number(h);
            const isValid = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
            const withinMax = width <= 8192 && height <= 8192;
            assert.strictEqual(isValid && withinMax, true, `expected "${size}" to be valid`);
        }
    });
});

describe('CLI option parsing - scale validation', () => {
    it('should parse valid scale values', () => {
        const validScales = ['0.5', '1', '2', '10', '0.1'];
        for (const scale of validScales) {
            const num = Number(scale);
            const isValid = Number.isFinite(num) && num > 0 && num <= 10;
            assert.strictEqual(isValid, true, `expected "${scale}" to be valid`);
        }
    });

    it('should reject invalid scale values', () => {
        const invalidScales = ['0', '-1', '11', 'abc'];
        for (const scale of invalidScales) {
            const num = Number(scale);
            const isValid = Number.isFinite(num) && num > 0 && num <= 10;
            assert.strictEqual(isValid, false, `expected "${scale}" to be invalid`);
        }
    });
});

describe('CLI option parsing - format via getOutputInfo', () => {
    const supportedImageFormats = ['png', 'jpeg', 'webp'];
    const supportedVideoFormats = ['mp4', 'webm', 'gif'];

    it('should accept all supported image formats', () => {
        for (const format of supportedImageFormats) {
            const result = getOutputInfo({ format });
            assert.strictEqual(result.format, format);
            assert.strictEqual(result.type, 'image');
        }
    });

    it('should accept all supported video formats', () => {
        for (const format of supportedVideoFormats) {
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
