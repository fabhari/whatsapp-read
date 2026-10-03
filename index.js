const path = require("node:path");
const qrcode = require("qrcode-terminal");
const { handleSelfChatMessage } = require("./src/whatsapp-handler");
const { createMessageProcessor } = require("./src/message-processor");
const { processShortUrl } = require("./src/process-short");

const messageProcessor = createMessageProcessor(
  path.join(__dirname, "data", "processed-messages.json"),
);
const brandingPath = path.join(
  __dirname,
  "remove-the-colours-to-left-of-the-ishow-arasiyal-r.jpg",
);
const uploadCredentials = {
  clientId: process.env.YOUTUBE_CLIENT_ID,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
};

async function connectToWhatsApp() {
  const baileys = await import("@whiskeysockets/baileys");
  const { state, saveCreds } = await baileys.useMultiFileAuthState(
    path.join(__dirname, "auth_info_baileys"),
  );
  const socket = baileys.default({ auth: state, printQRInTerminal: false });

  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("Scan this QR code with the WhatsApp account for the bot:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("WhatsApp connected. Send a YouTube Shorts link in the account's self-chat.");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === baileys.DisconnectReason.loggedOut) {
        console.error("WhatsApp logged out. Remove auth_info_baileys and pair again.");
        return;
      }

      setTimeout(() => connectToWhatsApp().catch(console.error), 2000);
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const message of messages) {
      try {
        const handled = await handleSelfChatMessage({
          message,
          ownJid: state.creds.me?.id,
          ownJidAlt: state.creds.me?.lid ?? state.creds.me?.phoneNumber,
          upsertType: type,
          sendMessage: (jid, content) => socket.sendMessage(jid, content),
          isSameUser: baileys.areJidsSameUser,
          processShort: (url, messageId) =>
            messageProcessor.run(messageId, () =>
              processShortUrl(url, { brandingPath, credentials: uploadCredentials }),
            ),
          logError: (error) => console.error("Short processing failed:", error.message),
        });
        if (!handled && type === "notify") {
          console.log("Ignored a WhatsApp notification outside the self-chat.");
        }
      } catch (error) {
        console.error("Could not handle WhatsApp message:", error.message);
      }
    }
  });
}

connectToWhatsApp().catch((error) => {
  console.error("Could not start WhatsApp connection:", error.message);
  process.exitCode = 1;
});