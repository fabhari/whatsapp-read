const test = require("node:test");
const assert = require("node:assert/strict");
const { parseYouTubeShortsUrl } = require("../src/shorts-url");

test("accepts canonical Shorts URLs and removes tracking parameters", () => {
  assert.deepEqual(
    parseYouTubeShortsUrl("https://www.youtube.com/shorts/AbCdEf123_-?si=share"),
    {
      videoId: "AbCdEf123_-",
      url: "https://www.youtube.com/shorts/AbCdEf123_-",
    },
  );
});

test("accepts YouTube mobile and root hosts", () => {
  assert.equal(
    parseYouTubeShortsUrl("https://m.youtube.com/shorts/AbCdEf123_-/").videoId,
    "AbCdEf123_-",
  );
  assert.equal(
    parseYouTubeShortsUrl("https://youtube.com/shorts/AbCdEf123_-").videoId,
    "AbCdEf123_-",
  );
});

test("rejects non-Shorts links, other domains, and malformed input", () => {
  const invalidInputs = [
    "https://www.youtube.com/watch?v=AbCdEf123_-",
    "https://youtu.be/AbCdEf123_-",
    "https://youtube.com.evil.example/shorts/AbCdEf123_-",
    "http://www.youtube.com/shorts/AbCdEf123_-",
    "https://www.youtube.com/shorts/too-short",
    "not a link",
    null,
  ];

  for (const input of invalidInputs) {
    assert.equal(parseYouTubeShortsUrl(input), null, String(input));
  }
});