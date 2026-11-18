import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readTime } from '../lib/utils.js';
import { getOutputInfo } from '../lib/render/index.js';
import { parseScale, parseWindowSize } from '../lib/handler.js';

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

    it('should throw for invalid time format', () => {
        assert.throws(() => readTime('invalid'), /invalid time/);
        assert.throws(() => readTime(''), /invalid time/);
        assert.throws(() => readTime('1x'), /invalid time/);
    });
});

describe('CLI option parsing - window size', () => {
    it('should parse window size with x separator', () => {
        assert.deepStrictEqual(parseWindowSize('1600x1000'), { width: 1600, height: 1000 });
    });

    it('should parse window size with comma separator', () => {
        assert.deepStrictEqual(parseWindowSize('1200,800'), { width: 1200, height: 800 });
    });

    it('should use width as height when no height provided', () => {
        assert.deepStrictEqual(parseWindowSize('800'), { width: 800, height: 800 });
    });

    it('should reject invalid window size format', () => {
        for (const size of ['abc', '100xabc', 'abcx100', '0x100', '100x0', '-100x200', 'x100']) {
            assert.throws(() => parseWindowSize(size), /invalid window size/, `expected "${size}" to be invalid`);
        }
    });

    it('should reject window size exceeding maximum', () => {
        assert.throws(() => parseWindowSize('9000x1000'), /maximum is 8192x8192/);
        assert.throws(() => parseWindowSize('1000x9000'), /maximum is 8192x8192/);
    });

    it('should accept the maximum window size', () => {
        assert.deepStrictEqual(parseWindowSize('8192x8192'), { width: 8192, height: 8192 });
    });
});

describe('CLI option parsing - scale validation', () => {
    it('should parse valid scale values', () => {
        for (const scale of ['0.5', '1', '2', '10', '0.1']) {
            assert.strictEqual(parseScale(scale), Number(scale));
        }
    });

    it('should reject invalid scale values', () => {
        for (const scale of ['0', '-1', '11', 'abc']) {
            assert.throws(() => parseScale(scale), /invalid scale/, `expected "${scale}" to be invalid`);
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
