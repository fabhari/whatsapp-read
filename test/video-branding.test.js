const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { brandShortVideo } = require("../src/video-branding");

test("creates vertical branded video and thumbnail with FFmpeg", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shorts-branding-"));
  const inputPath = path.join(root, "source.mp4");
  const brandingPath = path.join(root, "brand.jpg");
  const outputDir = path.join(root, "output");
  const calls = [];

  try {
    await writeFile(inputPath, "source-video");
    await writeFile(brandingPath, "branding-image");
    const result = await brandShortVideo({
      inputPath,
      brandingPath,
      outputDir,
      videoId: "AbCdEf123_-",
      execFileImpl: async (_command, args) => {
        calls.push(args);
        await writeFile(args.at(-1), `output-${calls.length}`);
        return { stdout: "", stderr: "" };
      },
    });

    assert.equal(await readFile(result.videoPath, "utf8"), "output-1");
    assert.equal(await readFile(result.thumbnailPath, "utf8"), "output-2");
    assert.equal(calls.length, 2);
    const filter = calls[0][calls[0].indexOf("-filter_complex") + 1];
    assert.ok(filter.includes("1080:1920:force_original_aspect_ratio=decrease"));
    assert.ok(filter.includes("colorchannelmixer=aa=0.82"));
    assert.ok(calls[1].includes("-frames:v"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects missing inputs before running FFmpeg", async () => {
  let called = false;

  await assert.rejects(
    brandShortVideo({
      inputPath: "/missing/source.mp4",
      brandingPath: "/missing/brand.jpg",
      outputDir: "/tmp/shorts-branding-test",
      videoId: "AbCdEf123_-",
      execFileImpl: async () => { called = true; },
    }),
    /Downloaded video was not found/,
  );
  assert.equal(called, false);
});