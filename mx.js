const express = require('express');
const fs = require('fs');
const path = require("path");
const crypto = require("crypto");
let router = express.Router();
const pino = require("pino");
const port = process.env.PORT || 10000;

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

// Store for temp sessions
const tempCredsStore = {};

function generateId() {
  return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

function scheduleDeletion(id, dirPath) {
  setTimeout(() => {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
    delete tempCredsStore[id];
  }, 60 * 60 * 1000); // 1 hour
}

function removeFile(FilePath){
  if(!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
};

router.get('/', async (req, res) => {
  let num = req.query.number;
  async function XeonPair() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    try {
      let XeonBotInc = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}))
        },
        printQRInTerminal: false,
        logger: pino({level: "fatal"}),
        browser: ["MekaAI", "Chrome", "MX-2.0"]
      });

      if (!XeonBotInc.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g,'');
        const code = await XeonBotInc.requestPairingCode(num);
        if (!res.headersSent) {
          await res.send({ code });
        }
      }

      XeonBotInc.ev.on('creds.update', saveCreds);
      XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection == "open") {
          await delay(10000);

          const id = generateId();
          const tempDir = `./temp_creds/${id}`;
          fs.mkdirSync(tempDir, { recursive: true });

          fs.readdirSync('./session').forEach(file => {
            fs.copyFileSync(`./session/${file}`, `${tempDir}/${file}`);
          });

          tempCredsStore[id] = tempDir;
          scheduleDeletion(id, tempDir);

          await XeonBotInc.sendMessage(XeonBotInc.user.id, {
            text: `*_🛑Do not share this ID with anyone_*

Your connection ID: *${id}*

Use this ID to connect your bot to WhatsApp.`
          });

          await delay(100);
          await removeFile('./session');
        } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
          await delay(10000);
          XeonPair();
        }
      });
    } catch (err) {
      console.log("service restarted");
      await removeFile('./session');
      if (!res.headersSent) {
        await res.send({ code: "Service Unavailable" });
      }
    }
  }
  return await XeonPair();
});

router.get('/connect', async (req, res) => {
  const id = req.query.id;
  const sessionPath = tempCredsStore[id];
  if (!id || !sessionPath || !fs.existsSync(sessionPath)) {
    return res.status(404).send({ error: "Invalid or expired session ID" });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const XeonBotInc = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
    },
    printQRInTerminal: false,
    logger: pino({ level: "fatal" }),
    browser: ["MekaAI", "Chrome", "MX-2.0"]
  });

  XeonBotInc.ev.on('creds.update', saveCreds);
  XeonBotInc.ev.on("connection.update", async (s) => {
    const { connection } = s;
    if (connection == "open") {
      await XeonBotInc.sendMessage(XeonBotInc.user.id, {
        text: `✅ Connected via ID: *${id}*\n\nBot is live on WhatsApp!`
      });
    }
  });

  res.send({ success: true, message: "Connecting bot via ID..." });
});

process.on('uncaughtException', function (err) {
  let e = String(err);
  if (e.includes("conflict")) return;
  if (e.includes("Socket connection timeout")) return;
  if (e.includes("not-authorized")) return;
  if (e.includes("rate-overlimit")) return;
  if (e.includes("Connection Closed")) return;
  if (e.includes("Timed Out")) return;
  if (e.includes("Value not found")) return;
  console.log('Caught exception: ', err);
});

module.exports = router;
