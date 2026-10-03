const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createMessageProcessor } = require("../src/message-processor");

test("processes a message once and returns the prior result for duplicates", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shorts-ledger-"));
  const processor = createMessageProcessor(path.join(root, "messages.json"));
  let runs = 0;

  try {
    const first = await processor.run("message-1", async () => {
      runs += 1;
      return { videoId: "uploaded123" };
    });
    const second = await processor.run("message-1", async () => {
      runs += 1;
      return { videoId: "unexpected" };
    });

    assert.deepEqual(first, { duplicate: false, result: { videoId: "uploaded123" } });
    assert.deepEqual(second, { duplicate: true, result: { videoId: "uploaded123" } });
    assert.equal(runs, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("allows retry after a failed processing attempt", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shorts-ledger-"));
  const processor = createMessageProcessor(path.join(root, "messages.json"));

  try {
    await assert.rejects(processor.run("message-2", async () => { throw new Error("failed"); }));
    const retry = await processor.run("message-2", async () => ({ videoId: "uploaded456" }));
    assert.deepEqual(retry, { duplicate: false, result: { videoId: "uploaded456" } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});