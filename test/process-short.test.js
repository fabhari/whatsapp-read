const test = require("node:test");
const assert = require("node:assert/strict");
const { access } = require("node:fs/promises");
const { processShortUrl } = require("../src/process-short");

test("runs download, branding, metadata, and upload, then removes temporary files", async () => {
  const calls = [];
  let jobDir;
  const result = await processShortUrl("https://youtube.com/shorts/AbCdEf123_-", {
    brandingPath: "/workspace/brand.jpg",
    credentials: { clientId: "id" },
    download: async (_url, { outputDir }) => {
      jobDir = outputDir;
      calls.push("download");
      return {
        videoId: "AbCdEf123_-",
        filePath: `${outputDir}/source.mp4`,
        metadata: { title: "Source title" },
      };
    },
    brand: async (options) => {
      calls.push("brand");
      assert.equal(options.brandingPath, "/workspace/brand.jpg");
      return { videoPath: `${options.outputDir}/branded.mp4`, thumbnailPath: `${options.outputDir}/thumbnail.jpg` };
    },
    upload: async (options) => {
      calls.push("upload");
      assert.equal(options.metadata.snippet.title, "Source title #Shorts");
      assert.equal(options.credentials.clientId, "id");
      return { videoId: "uploaded123", thumbnailUploaded: true };
    },
  });

  assert.deepEqual(calls, ["download", "brand", "upload"]);
  assert.deepEqual(result, { videoId: "uploaded123", thumbnailUploaded: true });
  await assert.rejects(access(jobDir));
});

test("removes the temporary job directory when a stage fails", async () => {
  let jobDir;
  await assert.rejects(
    processShortUrl("https://youtube.com/shorts/AbCdEf123_-", {
      download: async (_url, { outputDir }) => {
        jobDir = outputDir;
        throw new Error("download failed");
      },
    }),
    /download failed/,
  );
  await assert.rejects(access(jobDir));
});