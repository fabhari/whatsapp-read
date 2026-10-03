const test = require("node:test");
const assert = require("node:assert/strict");
const { handleSelfChatMessage } = require("../src/whatsapp-handler");

function createMessage(text, overrides = {}) {
  return {
    key: { remoteJid: "15550001111@s.whatsapp.net", fromMe: true },
    message: { conversation: text },
    ...overrides,
  };
}

test("acknowledges a valid Shorts URL from the self-chat", async () => {
  const sent = [];
  const handled = await handleSelfChatMessage({
    message: createMessage("https://youtube.com/shorts/AbCdEf123_-"),
    ownJid: "15550001111:2@s.whatsapp.net",
    upsertType: "notify",
    sendMessage: async (...args) => sent.push(args),
    isSameUser: (first, second) =>
      first.split("@")[0].split(":")[0] === second.split("@")[0].split(":")[0],
  });

  assert.equal(handled, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0][1].text, /Link accepted/);
});

test("runs the processor and reports upload completion", async () => {
  const responses = [];
  let processed;
  await handleSelfChatMessage({
    message: createMessage("https://youtube.com/shorts/AbCdEf123_-"),
    ownJid: "15550001111@s.whatsapp.net",
    upsertType: "notify",
    sendMessage: async (_jid, content) => responses.push(content.text),
    isSameUser: (first, second) => first === second,
    processShort: async (url, messageId) => {
      processed = { url, messageId };
      return { duplicate: false, result: { videoId: "uploaded123" } };
    },
  });

  assert.deepEqual(processed, {
    url: "https://www.youtube.com/shorts/AbCdEf123_-",
    messageId: undefined,
  });
  assert.match(responses[0], /Processing started/);
  assert.match(responses[1], /https:\/\/youtu\.be\/uploaded123/);
});

test("reports processing failures without exposing internal error details", async () => {
  const responses = [];
  await handleSelfChatMessage({
    message: createMessage("https://youtube.com/shorts/AbCdEf123_-"),
    ownJid: "15550001111@s.whatsapp.net",
    upsertType: "notify",
    sendMessage: async (_jid, content) => responses.push(content.text),
    isSameUser: (first, second) => first === second,
    processShort: async () => { throw new Error("private token value"); },
  });

  assert.match(responses[1], /Processing failed/);
  assert.doesNotMatch(responses[1], /private token value/);
});

test("returns an error for non-Shorts text in the self-chat", async () => {
  let response;
  await handleSelfChatMessage({
    message: createMessage("https://example.com/video"),
    ownJid: "15550001111@s.whatsapp.net",
    upsertType: "notify",
    sendMessage: async (_jid, content) => { response = content.text; },
    isSameUser: (first, second) => first === second,
  });

  assert.match(response, /valid YouTube Shorts link/);
});

test("ignores other chats, incoming messages, history, and automation replies", async () => {
  let sendCount = 0;
  const common = {
    ownJid: "15550001111@s.whatsapp.net",
    upsertType: "notify",
    sendMessage: async () => { sendCount += 1; },
    isSameUser: (first, second) => first === second,
  };

  await handleSelfChatMessage({
    ...common,
    message: createMessage("hello", {
      key: { remoteJid: "15550002222@s.whatsapp.net", fromMe: true },
    }),
  });
  await handleSelfChatMessage({
    ...common,
    message: createMessage("hello", {
      key: { remoteJid: "15550001111@s.whatsapp.net", fromMe: false },
    }),
  });
  await handleSelfChatMessage({
    ...common,
    upsertType: "append",
    message: createMessage("hello", {
      messageTimestamp: Math.floor(Date.now() / 1000) - 25 * 60 * 60,
    }),
  });
  await handleSelfChatMessage({
    ...common,
    message: createMessage("Automation: Please send a valid YouTube Shorts link."),
  });

  assert.equal(sendCount, 0);
});

test("processes a recent history-synced Shorts message", async () => {
  let processed = 0;
  await handleSelfChatMessage({
    message: createMessage("https://youtube.com/shorts/AbCdEf123_-", {
      messageTimestamp: Math.floor(Date.now() / 1000) - 30,
    }),
    ownJid: "15550001111@s.whatsapp.net",
    upsertType: "append",
    sendMessage: async () => {},
    isSameUser: (first, second) => first === second,
    processShort: async () => {
      processed += 1;
      return { duplicate: true };
    },
  });

  assert.equal(processed, 1);
});

test("matches self-chat when WhatsApp uses alternate phone and LID addresses", async () => {
  let processed = 0;
  await handleSelfChatMessage({
    message: createMessage("https://youtube.com/shorts/AbCdEf123_-", {
      key: {
        remoteJid: "linked-lid@lid",
        remoteJidAlt: "15550001111@s.whatsapp.net",
        fromMe: true,
      },
    }),
    ownJid: "linked-lid@lid",
    ownJidAlt: "15550001111@s.whatsapp.net",
    upsertType: "notify",
    sendMessage: async () => {},
    isSameUser: (first, second) => first === second,
    processShort: async () => {
      processed += 1;
      return { duplicate: true };
    },
  });

  assert.equal(processed, 1);
});