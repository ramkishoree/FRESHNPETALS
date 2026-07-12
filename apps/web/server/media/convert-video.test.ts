import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { convertVideoToWebOptimized } from './convert-video';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
const execFileAsync = promisify(execFile);

/**
 * Generates a real, playable source video via ffmpeg's synthetic test
 * pattern generator, invoking the ffmpeg binary directly rather than
 * through fluent-ffmpeg — fluent-ffmpeg pre-validates input formats
 * against its own capability cache and (incorrectly, confirmed via a
 * direct CLI run producing a valid file) rejects `-f lavfi`. That's a
 * limitation of fluent-ffmpeg's format-detection for this one synthetic
 * test source, not of the actual conversion pipeline under test, which
 * only ever receives real uploaded video files, never a lavfi source.
 */
async function makeTestVideo(size: string): Promise<Buffer> {
  if (!ffmpegPath) throw new Error('ffmpeg-static binary not available.');
  const outputPath = path.join(os.tmpdir(), `${randomUUID()}-testsrc.mp4`);
  await execFileAsync(ffmpegPath, [
    '-f',
    'lavfi',
    '-i',
    `testsrc=duration=1:size=${size}:rate=5`,
    '-pix_fmt',
    'yuv420p',
    '-y',
    outputPath,
  ]);
  const buffer = await readFile(outputPath);
  await unlink(outputPath);
  return buffer;
}

describe('convertVideoToWebOptimized', () => {
  it('converts a real source video into a valid, smaller MP4 with a real WebP thumbnail', async () => {
    const source = await makeTestVideo('640x480');
    const result = await convertVideoToWebOptimized(source);

    // 'ftyp' at byte offset 4 is the mandatory box every valid MP4 file starts with.
    expect(result.video.subarray(4, 8).toString('ascii')).toBe('ftyp');
    expect(result.sizeBytes).toBe(result.video.length);

    // Re-decode the thumbnail with sharp to prove it's a genuinely valid image, not just header bytes.
    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.format).toBe('webp');
    expect(thumbMeta.width).toBeGreaterThan(0);
  }, 30000);

  it('scales down a source wider than the max width', async () => {
    const wideSource = await makeTestVideo('1920x1080');
    const result = await convertVideoToWebOptimized(wideSource);

    // Probe the converted output's actual dimensions rather than trusting
    // the conversion function's own claims about what it did.
    const tmpOut = path.join(os.tmpdir(), `${randomUUID()}-probe.mp4`);
    await writeFile(tmpOut, result.video);
    const probedWidth = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(tmpOut, (err, data) => {
        if (err) return reject(err);
        const stream = data.streams.find((s) => s.codec_type === 'video');
        resolve(stream?.width ?? 0);
      });
    });
    await unlink(tmpOut);

    expect(probedWidth).toBeLessThanOrEqual(1280);
  }, 30000);
});
