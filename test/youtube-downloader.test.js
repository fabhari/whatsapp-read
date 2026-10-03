const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { downloadPublicShort } = require("../src/youtube-downloader");

test("downloads a Shorts URL with safe, bounded yt-dlp arguments", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "shorts-download-"));
  const expectedPath = path.join(outputDir, "AbCdEf123_-.mp4");
  const calls = [];

  try {
    const result = await downloadPublicShort(
      "https://youtube.com/shorts/AbCdEf123_-?si=share",
      {
        outputDir,
        execFileImpl: async (...args) => {
          calls.push(args);
          await writeFile(expectedPath, "video-data");
          await writeFile(
            path.join(outputDir, "AbCdEf123_-.info.json"),
            JSON.stringify({ title: "Source title", description: "Source details", tags: ["Tamil"] }),
          );
          return { stdout: `${expectedPath}\n`, stderr: "" };
        },
      },
    );

    assert.deepEqual(result, {
      videoId: "AbCdEf123_-",
      filePath: expectedPath,
      metadata: {
        title: "Source title",
        description: "Source details",
        tags: ["Tamil"],
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "yt-dlp");
    assert.ok(calls[0][1].includes("--no-playlist"));
    assert.ok(calls[0][1].includes("--max-filesize"));
    assert.ok(calls[0][1].includes("--write-info-json"));
    assert.equal(calls[0][2].shell, undefined);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("rejects invalid links before invoking yt-dlp", async () => {
  let called = false;

  await assert.rejects(
    downloadPublicShort("https://youtube.com/watch?v=AbCdEf123_-", {
      outputDir: "/tmp/shorts-test",
      execFileImpl: async () => { called = true; },
    }),
    /valid YouTube Shorts link/,
  );
  assert.equal(called, false);
});

test("reports a clean failure when yt-dlp produces no file path", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "shorts-download-"));

  try {
    await assert.rejects(
      downloadPublicShort("https://youtube.com/shorts/AbCdEf123_-", {
        outputDir,
        execFileImpl: async () => ({ stdout: "", stderr: "" }),
      }),
      /did not produce a video file/,
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});