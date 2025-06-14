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

// Temp ID store (auto-expires)
const tempSessionStore = {};

// Generate ID like mekaai_3d9e2a
function generateId() {
    return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

// Auto delete after 1 hour
function scheduleSessionCleanup(id, dir) {
    setTimeout(() => {
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        delete tempSessionStore[id];
    }, 60 * 60 * 1000); // 1 hour
}

// Remove folder
function removeFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
    }
}

// Start pairing process
router.get('/', async (req, res) => {
    const num = req.query.number;
    if (!num) return res.status(400).send({ error: "Phone number required" });

    const id = generateId();
    const tempDir = `./temp_sessions/${id}`;
    fs.mkdirSync(tempDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }).child({ level: "silent" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }).child({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "MX-2.0"],
        });

        if (!sock.authState.creds.registered) {
            const cleanNum = num.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(cleanNum);
            if (!res.headersSent) res.send({ code, id }); // send both code and ID
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
            if (connection === "open") {
                // Success: store session in temp store
                tempSessionStore[id] = tempDir;
                scheduleSessionCleanup(id, tempDir);

                await sock.sendMessage(sock.user.id, {
                    text: `✅ Your bot is connected!\n\nYour ID: *${id}*\nUse this ID for bot authentication.\n\n⚠️ Auto expires in 1 hour.`
                });

                // Optional: Send audio or join group
                try {
                    const audio = fs.readFileSync('./MX-2.0.mp3');
                    await sock.sendMessage(sock.user.id, {
                        audio,
                        mimetype: 'audio/mp4',
                        ptt: true
                    });
                    await sock.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");
                } catch {}

                await delay(1000);
            } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                await delay(10000);
                removeFolder(tempDir);
            }
        });
    } catch (err) {
        console.log("Error starting bot:", err);
        removeFolder(tempDir);
        if (!res.headersSent) res.status(500).send({ error: "Bot failed to start." });
    }
});

// Endpoint to verify ID exists (optional for frontend)
router.get('/verify', (req, res) => {
    const id = req.query.id;
    if (!id || !tempSessionStore[id]) {
        return res.status(404).send({ error: "Invalid or expired ID" });
    }
    res.send({ status: "valid", id });
});

// Fallback for crash logs
process.on('uncaughtException', function (err) {
    let e = String(err);
    if ([
        "conflict",
        "Socket connection timeout",
        "not-authorized",
        "rate-overlimit",
        "Connection Closed",
        "Timed Out",
        "Value not found"
    ].some(v => e.includes(v))) return;
    console.log('Caught exception:', err);
});

module.exports = router;
