const { randomUUID } = require("node:crypto");
const { mkdir, readFile, rename, writeFile } = require("node:fs/promises");
const path = require("node:path");

const PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 2000;

async function readEntries(filePath) {
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw new Error("Could not read the processed-message ledger.", { cause: error });
  }
}

async function writeEntries(filePath, entries) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(entries), { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

function trimEntries(entries) {
  const keys = Object.keys(entries);
  if (keys.length <= MAX_ENTRIES) {
    return;
  }
  keys
    .filter((key) => entries[key].status !== "processing")
    .sort((left, right) => entries[left].updatedAt - entries[right].updatedAt)
    .slice(0, keys.length - MAX_ENTRIES)
    .forEach((key) => delete entries[key]);
}

function createMessageProcessor(filePath) {
  let transactionQueue = Promise.resolve();

  function transact(update) {
    const task = transactionQueue.then(async () => {
      const entries = await readEntries(filePath);
      const result = update(entries);
      trimEntries(entries);
      await writeEntries(filePath, entries);
      return result;
    });
    transactionQueue = task.catch(() => {});
    return task;
  }

  async function run(messageId, processMessage) {
    if (!messageId) {
      throw new Error("A WhatsApp message ID is required.");
    }

    const now = Date.now();
    const claim = await transact((entries) => {
      const existing = entries[messageId];
      if (
        existing?.status === "completed" ||
        (existing?.status === "processing" && now - existing.startedAt < PROCESSING_TIMEOUT_MS)
      ) {
        return { claimed: false, result: existing.result };
      }

      entries[messageId] = { status: "processing", startedAt: now, updatedAt: now };
      return { claimed: true };
    });

    if (!claim.claimed) {
      return { duplicate: true, result: claim.result };
    }

    try {
      const result = await processMessage();
      await transact((entries) => {
        entries[messageId] = {
          status: "completed",
          result,
          updatedAt: Date.now(),
        };
      });
      return { duplicate: false, result };
    } catch (error) {
      await transact((entries) => {
        entries[messageId] = { status: "failed", updatedAt: Date.now() };
      });
      throw error;
    }
  }

  return { run };
}

module.exports = { createMessageProcessor };