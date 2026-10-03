const { parseYouTubeShortsUrl } = require("./shorts-url");

const RESPONSE_PREFIX = "Automation:";
const HISTORY_MAX_AGE_SECONDS = 24 * 60 * 60;

function isRecentUpsert(message, upsertType) {
  if (upsertType === "notify") {
    return true;
  }
  if (upsertType !== "append") {
    return false;
  }

  const rawTimestamp = message.messageTimestamp;
  const timestamp =
    typeof rawTimestamp?.toNumber === "function" ? rawTimestamp.toNumber() : Number(rawTimestamp);
  return Number.isFinite(timestamp) && timestamp >= Date.now() / 1000 - HISTORY_MAX_AGE_SECONDS;
}

function getMessageText(message) {
  return (
    message.message?.conversation ??
    message.message?.extendedTextMessage?.text ??
    ""
  );
}

async function handleSelfChatMessage({
  message,
  ownJid,
  ownJidAlt,
  upsertType,
  sendMessage,
  isSameUser,
  processShort,
  logError = () => {},
}) {
  const remoteJid = message.key?.remoteJid;
  const remoteJids = [remoteJid, message.key?.remoteJidAlt].filter(Boolean);
  const ownJids = [ownJid, ownJidAlt].filter(Boolean);
  if (
    !isRecentUpsert(message, upsertType) ||
    message.key?.fromMe !== true ||
    !remoteJids.some((remote) => ownJids.some((own) => isSameUser(remote, own)))
  ) {
    return false;
  }

  const text = getMessageText(message).trim();
  if (text.startsWith(RESPONSE_PREFIX)) {
    return false;
  }

  const shorts = parseYouTubeShortsUrl(text);
  if (!shorts) {
    await sendMessage(remoteJid, {
      text: `${RESPONSE_PREFIX} Please send a valid YouTube Shorts link.`,
    });
    return true;
  }

  if (!processShort) {
    await sendMessage(remoteJid, {
      text: `${RESPONSE_PREFIX} Link accepted (${shorts.videoId}).`,
    });
    return true;
  }

  await sendMessage(remoteJid, { text: `${RESPONSE_PREFIX} Processing started.` });
  try {
    const outcome = await processShort(shorts.url, message.key.id);
    if (outcome.duplicate) {
      await sendMessage(remoteJid, { text: `${RESPONSE_PREFIX} This link was already processed.` });
      return true;
    }

    const result = outcome.result ?? outcome;
    const warning = result.warning ? ` ${result.warning}` : "";
    await sendMessage(remoteJid, {
      text: `${RESPONSE_PREFIX} Upload complete: https://youtu.be/${result.videoId}.${warning}`,
    });
  } catch (error) {
    logError(error);
    await sendMessage(remoteJid, {
      text: `${RESPONSE_PREFIX} Processing failed. Check the worker logs for details.`,
    });
  }
  return true;
}

module.exports = { handleSelfChatMessage, isRecentUpsert };