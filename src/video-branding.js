const { execFile: execFileCallback } = require("node:child_process");
const { mkdir, stat, unlink } = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");

const execFile = promisify(execFileCallback);

async function requireFile(filePath, label) {
  const file = await stat(filePath).catch(() => null);
  if (!file?.isFile()) {
    throw new Error(`${label} was not found.`);
  }
}

async function brandShortVideo({
  inputPath,
  brandingPath,
  outputDir,
  videoId,
  execFileImpl = execFile,
}) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error("A valid YouTube video ID is required.");
  }
  if (!outputDir) {
    throw new Error("An output directory is required.");
  }

  await requireFile(inputPath, "Downloaded video");
  await requireFile(brandingPath, "Branding image");
  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${videoId}-branded.mp4`);
  const thumbnailPath = path.join(outputDir, `${videoId}-thumbnail.jpg`);
  const filter =
    "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base];" +
    "[1:v]scale=240:240,format=rgba,colorchannelmixer=aa=0.82[logo];" +
    "[base][logo]overlay=32:32:format=auto,format=yuv420p[v]";

  try {
    await execFileImpl(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-i",
        brandingPath,
        "-filter_complex",
        filter,
        "-map",
        "[v]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { timeout: 600_000, maxBuffer: 2 * 1024 * 1024 },
    );
    await execFileImpl(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        outputPath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        thumbnailPath,
      ],
      { timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
  } catch (error) {
    await Promise.all([
      unlink(outputPath).catch(() => {}),
      unlink(thumbnailPath).catch(() => {}),
    ]);
    if (error.code === "ENOENT") {
      throw new Error("FFmpeg is not installed.", { cause: error });
    }
    throw new Error("The video could not be branded.", { cause: error });
  }

  await Promise.all([
    requireFile(outputPath, "Branded video"),
    requireFile(thumbnailPath, "Thumbnail"),
  ]);

  return { videoPath: outputPath, thumbnailPath };
}

module.exports = { brandShortVideo };