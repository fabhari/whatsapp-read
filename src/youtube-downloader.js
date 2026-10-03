const { execFile: execFileCallback } = require("node:child_process");
const { readFile, stat } = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");
const { parseYouTubeShortsUrl } = require("./shorts-url");

const execFile = promisify(execFileCallback);
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

async function downloadPublicShort(input, { outputDir, execFileImpl = execFile } = {}) {
  const shorts = parseYouTubeShortsUrl(input);
  if (!shorts) {
    throw new Error("Please provide a valid YouTube Shorts link.");
  }
  if (!outputDir) {
    throw new Error("An output directory is required.");
  }

  const resolvedOutputDir = path.resolve(outputDir);
  const outputTemplate = path.join(resolvedOutputDir, "%(id)s.%(ext)s");
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--max-filesize",
    `${MAX_VIDEO_BYTES}`,
    "--write-info-json",
    "--format",
    "best[ext=mp4][height<=1920]/best[height<=1920]",
    "--output",
    outputTemplate,
    "--print",
    "after_move:filepath",
    shorts.url,
  ];

  let result;
  try {
    result = await execFileImpl("yt-dlp", args, {
      timeout: 300_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("yt-dlp is not installed.", { cause: error });
    }
    throw new Error("The public video could not be downloaded.", { cause: error });
  }

  const outputPath = result.stdout.trim().split(/\r?\n/).at(-1);
  if (!outputPath) {
    throw new Error("yt-dlp did not produce a video file.");
  }

  const resolvedOutputPath = path.resolve(outputPath);
  const relativeOutputPath = path.relative(resolvedOutputDir, resolvedOutputPath);
  if (
    !relativeOutputPath ||
    relativeOutputPath.startsWith("..") ||
    path.isAbsolute(relativeOutputPath)
  ) {
    throw new Error("yt-dlp returned a video path outside the job directory.");
  }

  const file = await stat(resolvedOutputPath);
  if (!file.isFile() || file.size === 0 || file.size > MAX_VIDEO_BYTES) {
    throw new Error("The downloaded video is empty or exceeds the 100 MB limit.");
  }

  let metadata = {};
  try {
    const source = JSON.parse(
      await readFile(path.join(resolvedOutputDir, `${shorts.videoId}.info.json`), "utf8"),
    );
    metadata = {
      title: typeof source.title === "string" ? source.title : "",
      description: typeof source.description === "string" ? source.description : "",
      tags: Array.isArray(source.tags) ? source.tags : [],
    };
  } catch {
    // The upload can still use the free fallback metadata if source details are unavailable.
  }

  return { videoId: shorts.videoId, filePath: resolvedOutputPath, metadata };
}

module.exports = { downloadPublicShort, MAX_VIDEO_BYTES };