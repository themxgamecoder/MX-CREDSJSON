const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const router = express.Router();
const tempCredsStore = {};

function generateId() {
  return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

function scheduleDeletion(id, filepath) {
  setTimeout(() => {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    delete tempCredsStore[id];
  }, 5 * 60 * 1000);
}

function removeFile(FilePath) {
  if (fs.existsSync(FilePath)) {
    fs.rmSync(FilePath, { recursive: true, force: true });
  }
}

router.get("/", async (req, res) => {
  let num = req.query.number;
  if (!num) return res.status(400).send({ error: "Missing number" });

  const { state, saveCreds } = await useMultiFileAuthState(`./session`);

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
    printQRInTerminal: false,
    logger: pino({ level: "info" }),
    browser: ["Ubuntu", "Chrome", "MX-2.0"]
  });

  sock.ev.on("connection.update", async (update) => {
    console.log("🧩 Connection Update:", update);

    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ Connected to WhatsApp");

      await delay(5000); // Allow some buffer

      try {
        const sessionFile = fs.readFileSync("./session/creds.json");
        const id = generateId();
        const tempDir = `./temp_creds`;
        const credsPath = `${tempDir}/${id}.json`;

        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(credsPath, sessionFile);
        tempCredsStore[id] = credsPath;
        scheduleDeletion(id, credsPath);

        await sock.sendMessage(sock.user.id, {
          text: `🪪 Your File ID:\n\n*${id}*\nUse it in your bot to download creds.json.\n\n© MXGAMΞCØDΞR`
        });

        console.log("✅ File ID sent via WhatsApp:", id);

        await delay(2000);
        removeFile('./session');
        process.exit(0);
      } catch (err) {
        console.error("❌ Error saving or sending creds:", err.message);
      }
    }

    if (connection === "close") {
      const errorCode = lastDisconnect?.error?.output?.statusCode;
      console.log("⚠️ Disconnected. Code:", errorCode);

      if (errorCode === 401) {
        console.log("🚫 Connection refused: unauthorized or expired session.");
      } else {
        console.log("🔁 Exiting so system restarts...");
      }
      removeFile('./session');
      process.exit(1);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Get pairing code
  try {
    num = num.replace(/\D/g, "");
    const code = await sock.requestPairingCode(num);
    console.log("🔑 Pairing Code:", code);

    if (!res.headersSent) {
      return res.send({ code });
    }
  } catch (err) {
    console.error("❌ Error requesting code:", err.message);
    if (!res.headersSent) {
      return res.status(500).send({ error: "Failed to get pairing code" });
    }
  }
});

// ✅ creds.json route
router.get("/creds", (req, res) => {
  const id = req.query.id;
  if (!id || !tempCredsStore[id]) {
    return res.status(404).send({ error: "Invalid or expired ID" });
  }

  const filePath = tempCredsStore[id];
  res.sendFile(path.resolve(filePath), (err) => {
    if (!err) {
      fs.unlinkSync(filePath);
      delete tempCredsStore[id];
    }
  });
});

// Optional: log unexpected crashes
process.on("uncaughtException", function (err) {
  console.log("💥 Uncaught Exception:", err.message);
});

module.exports = router;
