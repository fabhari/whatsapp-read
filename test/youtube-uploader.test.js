const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { uploadShort } = require("../src/youtube-uploader");

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
};
const metadata = {
  snippet: { title: "Test #Shorts", categoryId: "25" },
  status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
};

test("uploads video and thumbnail using YouTube OAuth", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shorts-upload-"));
  const videoPath = path.join(root, "video.mp4");
  const thumbnailPath = path.join(root, "thumbnail.jpg");
  const calls = [];
  let credentialsSet;

  try {
    await writeFile(videoPath, "video");
    await writeFile(thumbnailPath, "thumbnail");
    class OAuth2 {
      setCredentials(value) {
        credentialsSet = value;
      }
    }
    const googleApi = {
      auth: { OAuth2 },
      youtube: ({ version, auth }) => {
        assert.equal(version, "v3");
        assert.ok(auth instanceof OAuth2);
        return {
          videos: {
            insert: async (request) => {
              calls.push(["insert", request]);
              return { data: { id: "uploaded123" } };
            },
          },
          thumbnails: {
            set: async (request) => calls.push(["thumbnail", request]),
          },
        };
      },
    };

    const result = await uploadShort({
      videoPath,
      thumbnailPath,
      metadata,
      credentials,
      googleApi,
      createReadStreamImpl: (filePath) => filePath,
    });

    assert.deepEqual(credentialsSet, { refresh_token: "refresh-token" });
    assert.deepEqual(result, { videoId: "uploaded123", thumbnailUploaded: true, warning: undefined });
    assert.equal(calls[0][0], "insert");
    assert.deepEqual(calls[0][1].part, ["snippet", "status"]);
    assert.equal(calls[0][1].requestBody.status.privacyStatus, "public");
    assert.equal(calls[0][1].media.body, videoPath);
    assert.equal(calls[1][0], "thumbnail");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps a completed upload when YouTube rejects a custom thumbnail", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shorts-upload-"));
  const videoPath = path.join(root, "video.mp4");
  const thumbnailPath = path.join(root, "thumbnail.jpg");

  try {
    await writeFile(videoPath, "video");
    await writeFile(thumbnailPath, "thumbnail");
    const googleApi = {
      auth: { OAuth2: class { setCredentials() {} } },
      youtube: () => ({
        videos: { insert: async () => ({ data: { id: "uploaded123" } }) },
        thumbnails: { set: async () => { throw new Error("not supported"); } },
      }),
    };

    const result = await uploadShort({
      videoPath,
      thumbnailPath,
      metadata,
      credentials,
      googleApi,
      createReadStreamImpl: (filePath) => filePath,
    });

    assert.equal(result.videoId, "uploaded123");
    assert.equal(result.thumbnailUploaded, false);
    assert.match(result.warning, /custom thumbnail/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("requires OAuth credentials before upload", async () => {
  await assert.rejects(
    uploadShort({ videoPath: "/missing/video.mp4", metadata, credentials: {} }),
    /OAuth credentials are not configured/,
  );
});