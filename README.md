# WhatsApp Shorts Automation

Send a public YouTube Shorts link in the linked WhatsApp account's self-chat. The worker downloads it, adds the supplied ishow arasiyal branding, creates a thumbnail and channel metadata, uploads it to YouTube, and replies with the result.

The downloader (`yt-dlp`) is unofficial, may break, and may conflict with YouTube's terms. Only publicly accessible videos are supported; the worker does not bypass login or other access restrictions. OpenAI is not used.

## Local setup

Requirements: Node.js 22+, pnpm 12, `yt-dlp`, FFmpeg, and GPG.

1. Install packages with `pnpm install`.
2. Run `pnpm start` and scan the QR code using the WhatsApp number that will run the bot.
3. Confirm the terminal says WhatsApp is connected. Video processing also requires `yt-dlp`, FFmpeg, and the YouTube OAuth settings below; do not send a production link until those are configured.
4. Keep `auth_info_baileys/` private. It contains WhatsApp login credentials and is ignored by Git.

## YouTube OAuth

Create a Google Cloud project, enable YouTube Data API v3, configure OAuth consent, and create OAuth credentials with the `https://www.googleapis.com/auth/youtube.upload` scope. Use the Google OAuth Playground with your own client credentials to authorize your channel and obtain a refresh token. Add these as GitHub Actions repository secrets; never commit or send their values in chat:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

The uploader sets visibility to public, category to News & Politics, and the audience setting to not made for kids. Some YouTube API projects may need verification before public uploads are allowed; test privately first.

## Hourly GitHub Actions

The scheduled workflow listens for up to 55 seconds each hour and can also be started manually. It uses recent WhatsApp history sync and a message ledger to catch up and avoid duplicate processing. Delivery is best-effort and may be delayed or missed; included GitHub Actions minutes and YouTube API quota are limited, so monitor usage.

Pair WhatsApp locally first, then create an encrypted initial session bundle from the repository root:

```sh
mkdir -p data
tar -czf /tmp/whatsapp-state.tar.gz auth_info_baileys data
gpg --symmetric --cipher-algo AES256 --output /tmp/whatsapp-state.tar.gz.gpg /tmp/whatsapp-state.tar.gz
base64 -w0 /tmp/whatsapp-state.tar.gz.gpg
```

Add the resulting base64 string as `WHATSAPP_INITIAL_STATE_B64` and the same GPG passphrase as `WHATSAPP_STATE_PASSPHRASE` in the private repository's Actions secrets. The workflow stores updated session state and the duplicate ledger in an encrypted Actions cache. Do not commit the generated bundle or session directory.

Run `pnpm test` for the local test suite. Tests mock YouTube, FFmpeg, and `yt-dlp`; a real QR pairing and private YouTube upload are still required before enabling automatic public uploads.
