const SHORTS_PATH = /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

function parseYouTubeShortsUrl(input) {
  if (typeof input !== "string") {
    return null;
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname)) {
    return null;
  }

  const match = SHORTS_PATH.exec(url.pathname);
  if (!match) {
    return null;
  }

  return {
    videoId: match[1],
    url: `https://www.youtube.com/shorts/${match[1]}`,
  };
}

module.exports = { parseYouTubeShortsUrl };