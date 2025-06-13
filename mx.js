const express = require('express');
const fs = require('fs');
const path = require("path");
const crypto = require("crypto");
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const tempCredsStore = {}; // Store active sessions

// Generate unique ID like mekaai_xxxxxx
function generateId() {
    return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

// Clean up session after 2 mins
function scheduleDeletion(id, dirPath) {
    setTimeout(() => {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
        delete tempCredsStore[id];
    }, 2 * 60 * 1000); // 2 minutes
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Number required" });

    const id = generateId();
    const sessionPath = `./temp_creds/${id}`;
    fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["Ubuntu", "Chrome", "MX-2.0"]
        });

        if (!sock.authState.creds.registered) {
            num = num.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(num);
            return res.send({ code });
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on("connection.update", async ({ connection }) => {
            if (connection === "open") {
                tempCredsStore[id] = sessionPath;
                scheduleDeletion(id, sessionPath);

                await sock.sendMessage(sock.user.id, {
                    text: `🎉 Your bot ID: *${id}*\nUse this to connect your bot.\n\n⛔️ Do NOT share this ID!`
                });

                await sock.sendMessage(sock.user.id, {
                    audio: fs.readFileSync("./MX-2.0.mp3"),
                    mimetype: 'audio/mp4',
                    ptt: true
                });
            }
        });

    } catch (err) {
        console.error("Failed:", err);
        if (!res.headersSent) {
            res.send({ code: "Service Unavailable" });
        }
    }
});

// Optional: Endpoint to check if ID exists
router.get('/check-id', (req, res) => {
    const id = req.query.id;
    if (!id || !tempCredsStore[id]) {
        return res.status(404).send({ error: "Invalid or expired ID" });
    }
    return res.send({ valid: true });
});

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (
        e.includes("conflict") ||
        e.includes("Socket connection timeout") ||
        e.includes("not-authorized") ||
        e.includes("rate-overlimit") ||
        e.includes("Connection Closed") ||
        e.includes("Timed Out") ||
        e.includes("Value not found")
    ) return;
    console.error('Caught exception:', err);
});

module.exports = router;
