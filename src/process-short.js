const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { downloadPublicShort } = require("./youtube-downloader");
const { brandShortVideo } = require("./video-branding");
const { buildVideoMetadata } = require("./video-metadata");
const { uploadShort } = require("./youtube-uploader");

async function processShortUrl(url, {
  brandingPath,
  credentials,
  download = downloadPublicShort,
  brand = brandShortVideo,
  upload = uploadShort,
} = {}) {
  const jobDir = await mkdtemp(path.join(os.tmpdir(), "whatsapp-short-"));
  try {
    const source = await download(url, { outputDir: jobDir });
    const metadata = buildVideoMetadata(source.metadata);
    const branded = await brand({
      inputPath: source.filePath,
      brandingPath,
      outputDir: jobDir,
      videoId: source.videoId,
    });
    return await upload({
      videoPath: branded.videoPath,
      thumbnailPath: branded.thumbnailPath,
      metadata,
      credentials,
    });
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
}

module.exports = { processShortUrl };