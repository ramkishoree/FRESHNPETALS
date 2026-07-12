import 'server-only';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export interface VideoConversionResult {
  video: Buffer;
  thumbnail: Buffer;
  sizeBytes: number;
}

const MAX_WIDTH = 1280;
// CRF 30 is a pragmatic web-delivery point on x264's quality scale (lower =
// higher quality/larger file, ~18 is "visually lossless", ~28 is typical
// streaming-site default) — chosen for "storage light" over pixel-perfect,
// matching the owner's explicit call.
const CRF = '30';

/**
 * Ch.12 §56 Media Library, video variant — same "every upload converted
 * server-side, not something a client can skip" guarantee as
 * convert-to-webp.ts, extended to video. Vercel's serverless functions
 * have no persistent disk, only an ephemeral /tmp per invocation —
 * fluent-ffmpeg needs real file paths (not streams) for reliable
 * transcoding, so the source/output round-trip through /tmp and get
 * cleaned up unconditionally afterward.
 */
export async function convertVideoToWebOptimized(
  sourceBytes: Buffer,
): Promise<VideoConversionResult> {
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary not available (ffmpeg-static failed to install).');
  }

  const workDir = os.tmpdir();
  const inputPath = path.join(workDir, `${randomUUID()}-in`);
  const outputPath = path.join(workDir, `${randomUUID()}-out.mp4`);
  const thumbPath = path.join(workDir, `${randomUUID()}-thumb.jpg`);

  await writeFile(inputPath, sourceBytes);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .outputOptions([
          `-crf ${CRF}`,
          '-preset veryfast',
          `-vf scale='min(${MAX_WIDTH},iw)':-2`,
          '-movflags +faststart',
          '-pix_fmt yuv420p',
        ])
        .audioCodec('aac')
        .audioBitrate('96k')
        .noAudio() // product clips rarely need sound and it's most of the remaining size after video compression; drop it for "storage light"
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    // fluent-ffmpeg's .screenshots() does its own filename templating and
    // doesn't reliably honor an exact folder+filename target — shell out
    // directly for full control over the output path, same as the main
    // conversion above. -ss 0 (first frame) rather than 1s in, so this
    // still works on clips shorter than a second.
    await execFileAsync(ffmpegPath, [
      '-y',
      '-ss',
      '0',
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-vf',
      `scale='min(${MAX_WIDTH},iw)':-2`,
      thumbPath,
    ]);

    const [video, rawThumb] = await Promise.all([readFile(outputPath), readFile(thumbPath)]);
    const thumbnail = await sharp(rawThumb).webp({ quality: 80 }).toBuffer();

    return { video, thumbnail, sizeBytes: video.length };
  } finally {
    await Promise.allSettled([unlink(inputPath), unlink(outputPath), unlink(thumbPath)]);
  }
}
