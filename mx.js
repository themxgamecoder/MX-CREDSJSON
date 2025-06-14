const express = require('express');
const fs = require('fs');
const path = require("path");
const crypto = require("crypto");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");

const router = express.Router();
const tempCredsStore = {}; // Maps ID -> filepath
const TEMP_DIR = "./temp_creds";
const SESSION_DIR = "./session";

function generateId() {
  return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

function scheduleDeletion(id, filepath, timeoutMs = 60 * 60 * 1000) { // 1 hour
  setTimeout(() => {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    delete tempCredsStore[id];
  }, timeoutMs);
}

function removeFile(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
  let num = req.query.number;

  async function XeonPair() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    try {
      let XeonBotInc = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "MX-2.0"],
      });

      if (!XeonBotInc.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await XeonBotInc.requestPairingCode(num);
        if (!res.headersSent) return res.send({ code });
      }

      XeonBotInc.ev.on('creds.update', saveCreds);

      XeonBotInc.ev.on("connection.update", async ({ connection }) => {
        if (connection === "open") {
          await delay(3000);

          const sessionData = fs.readFileSync(`${SESSION_DIR}/creds.json`);
          const audioMsg = fs.readFileSync("./MX-2.0.mp3");

          const id = generateId();
          const credsPath = `${TEMP_DIR}/${id}.json`;
          fs.mkdirSync(TEMP_DIR, { recursive: true });
          fs.writeFileSync(credsPath, sessionData);

          tempCredsStore[id] = credsPath;
          scheduleDeletion(id, credsPath);

          await XeonBotInc.sendMessage(XeonBotInc.user.id, {
            text: `*_🛑Do not share this ID with anyone_*

Your session ID: *${id}*
Use this ID to login without creds.json!`
          });

          await XeonBotInc.sendMessage(XeonBotInc.user.id, {
            audio: audioMsg,
            mimetype: 'audio/mp4',
            ptt: true
          });

          await delay(100);
          await removeFile(SESSION_DIR);
        }
      });
    } catch (err) {
      console.error("Pairing Error:", err);
      removeFile(SESSION_DIR);
      if (!res.headersSent) res.send({ code: "Service Unavailable" });
    }
  }

  await XeonPair();
});

router.get('/creds', (req, res) => {
  const id = req.query.id;
  if (!id || !tempCredsStore[id]) {
    return res.status(404).send({ error: "Invalid or expired ID" });
  }
  res.sendFile(path.resolve(tempCredsStore[id]), err => {
    if (!err) {
      fs.unlinkSync(tempCredsStore[id]);
      delete tempCredsStore[id];
    }
  });
});

process.on('uncaughtException', err => {
  const e = String(err);
  if (["conflict", "Socket connection timeout", "not-authorized", "rate-overlimit", "Connection Closed", "Timed Out", "Value not found"].some(msg => e.includes(msg))) return;
  console.error("[ERROR] Uncaught Exception:", err);
});

module.exports = router;
