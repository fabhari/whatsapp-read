const { createReadStream } = require("node:fs");
const { stat } = require("node:fs/promises");
const { google } = require("googleapis");

async function requireFile(filePath, label) {
  const file = await stat(filePath).catch(() => null);
  if (!file?.isFile()) {
    throw new Error(`${label} was not found.`);
  }
}

async function uploadShort({
  videoPath,
  thumbnailPath,
  metadata,
  credentials,
  googleApi = google,
  createReadStreamImpl = createReadStream,
}) {
  if (!credentials?.clientId || !credentials?.clientSecret || !credentials?.refreshToken) {
    throw new Error("YouTube OAuth credentials are not configured.");
  }
  await requireFile(videoPath, "Branded video");

  const auth = new googleApi.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri,
  );
  auth.setCredentials({ refresh_token: credentials.refreshToken });

  const youtube = googleApi.youtube({ version: "v3", auth });
  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: metadata,
    media: {
      mimeType: "video/mp4",
      body: createReadStreamImpl(videoPath),
    },
  });
  const videoId = response.data?.id;
  if (!videoId) {
    throw new Error("YouTube did not return an uploaded video ID.");
  }

  let thumbnailUploaded = false;
  let warning;
  if (thumbnailPath) {
    try {
      await requireFile(thumbnailPath, "Thumbnail");
      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: "image/jpeg",
          body: createReadStreamImpl(thumbnailPath),
        },
      });
      thumbnailUploaded = true;
    } catch {
      warning = "Video uploaded, but YouTube did not accept the custom thumbnail.";
    }
  }

  return { videoId, thumbnailUploaded, warning };
}

module.exports = { uploadShort };