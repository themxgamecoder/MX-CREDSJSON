const express = require('express');
const fs = require('fs');
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const router = express.Router();

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
  let num = req.query.number;

  async function XeonPair() {
    // ✅ Ensure session directory exists
    if (!fs.existsSync('./session')) fs.mkdirSync('./session', { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(`./session`);

    try {
      const XeonBotInc = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "MX-2.0"]
      });

      // ✅ Listen for creds update first and handle file sync here
      XeonBotInc.ev.on('creds.update', async () => {
        await saveCreds();
        await delay(500); // ensure file is fully written

        if (fs.existsSync('./session/creds.json')) {
          const sessionXeon = fs.readFileSync('./session/creds.json');
          const audioxeon = fs.readFileSync('./MX-2.0.mp3');

          const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, {
            document: sessionXeon,
            mimetype: `application/json`,
            fileName: `creds.json`
          });

          await XeonBotInc.sendMessage(XeonBotInc.user.id, {
            audio: audioxeon,
            mimetype: 'audio/mp4',
            ptt: true
          }, {
            quoted: xeonses
          });

          await XeonBotInc.sendMessage(XeonBotInc.user.id, {
            text: `*_🛑Do not share this file with anybody_*\n\n© *_Subscribe_* www.youtube.com/@mxgamecoder *_on Youtube_*`
          }, {
            quoted: xeonses
          });

          await delay(100);
          await removeFile('./session');
          process.exit(0);
        }
      });

      // ✅ Request pairing if not already registered
      if (!XeonBotInc.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await XeonBotInc.requestPairingCode(num);

        if (!res.headersSent) {
          await res.send({ code });
        }

        console.log("⏳ Pairing in progress...");
      }

      // ✅ Handle connection updates
      XeonBotInc.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
          console.log("✅ Connected to WhatsApp");
        } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
          await delay(10000);
          XeonPair(); // retry
        }
      });

    } catch (err) {
      console.log("service restarted due to error:", err);
      await removeFile('./session');
      if (!res.headersSent) {
        await res.send({ code: "Service Unavailable" });
      }
    }
  }

  return await XeonPair();
});

process.on('uncaughtException', function (err) {
  const e = String(err);
  if (
    e.includes("conflict") ||
    e.includes("Socket connection timeout") ||
    e.includes("not-authorized") ||
    e.includes("rate-overlimit") ||
    e.includes("Connection Closed") ||
    e.includes("Timed Out") ||
    e.includes("Value not found")
  ) return;

  console.log('Caught exception: ', err);
});

module.exports = router;
