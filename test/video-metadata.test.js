const test = require("node:test");
const assert = require("node:assert/strict");
const { buildVideoMetadata } = require("../src/video-metadata");

test("builds YouTube metadata with channel defaults", () => {
  const metadata = buildVideoMetadata({
    title: "A current affairs short",
    description: "Summary from the original video.",
    tags: ["Tamil", "Tamil"],
  });

  assert.equal(metadata.snippet.title, "A current affairs short #Shorts");
  assert.match(metadata.snippet.description, /Summary from the original video/);
  assert.match(metadata.snippet.description, /iShow Arasiyal/);
  assert.deepEqual(metadata.snippet.tags, [
    "Tamil",
    "Shorts",
    "Tamil politics",
    "Tamil Nadu politics",
    "iShow Arasiyal",
  ]);
  assert.equal(metadata.snippet.categoryId, "25");
  assert.equal(metadata.status.privacyStatus, "public");
  assert.equal(metadata.status.selfDeclaredMadeForKids, false);
});

test("keeps title, description, and tags within YouTube limits", () => {
  const metadata = buildVideoMetadata({
    title: "A".repeat(200),
    description: "B".repeat(6000),
    tags: ["C".repeat(400), "D".repeat(200)],
  });

  assert.ok(metadata.snippet.title.length <= 100);
  assert.ok(metadata.snippet.description.length <= 5000);
  assert.ok(metadata.snippet.tags.join(",").length <= 500);
});

test("uses safe defaults when source metadata is missing", () => {
  const metadata = buildVideoMetadata();

  assert.equal(metadata.snippet.title, "Tamil Nadu Politics Update #Shorts");
  assert.match(metadata.snippet.description, /#TamilPolitics/);
});