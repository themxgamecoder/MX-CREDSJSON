const express = require('express');
const fs = require('fs');
const path = require("path");
const crypto = require("crypto");
const pino = require("pino");
const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");

const router = express.Router();
const port = process.env.PORT || 10000;

// 🧠 In-memory store for active sessions linked to IDs
const sessionStore = {};

// 🛠 Generate unique ID like mekaai_3d9e2a
function generateId() {
    return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

// 🧹 Cleanup session after 2 minutes
function scheduleSessionCleanup(id) {
    setTimeout(() => {
        delete sessionStore[id];
    }, 2 * 60 * 1000);
}

// ❌ Clean any folder (e.g., ./session)
function removeFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
    }
}

// 📦 Main bot pairing route
router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing number" });

    async function pairBot() {
        const sessionDir = "./session";
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        try {
            const XeonBotInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "MX-2.0"],
            });

            if (!XeonBotInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await XeonBotInc.requestPairingCode(num);
                if (!res.headersSent) return res.send({ code });
            }

            XeonBotInc.ev.on('creds.update', saveCreds);
            XeonBotInc.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
                if (connection === "open") {
                    await delay(3000);

                    const sessionId = generateId();
                    sessionStore[sessionId] = {
                        connectedAt: Date.now(),
                        user: XeonBotInc.user
                    };

                    // ✅ Send back session ID
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        text: `*_🛑 Keep this ID safe!_*\n\nYour session ID: *${sessionId}*\nUse this ID to connect.\n\n© MXGameCoder`
                    });

                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        audio: fs.readFileSync('./MX-2.0.mp3'),
                        mimetype: 'audio/mp4',
                        ptt: true
                    });

                    scheduleSessionCleanup(sessionId);
                    removeFolder(sessionDir); // Clean up session
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    pairBot(); // Retry
                }
            });

        } catch (err) {
            console.log("Service crashed:", err);
            removeFolder(sessionDir);
            if (!res.headersSent) return res.send({ code: "Service Unavailable" });
        }
    }

    await pairBot();
});

// 🔍 Route to validate ID
router.get('/validate', (req, res) => {
    const id = req.query.id;
    if (!id || !sessionStore[id]) {
        return res.status(404).send({ error: "Invalid or expired session ID" });
    }

    return res.send({
        valid: true,
        user: sessionStore[id].user,
        connectedAt: sessionStore[id].connectedAt
    });
});

// 🧯 Error safety net
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
    console.log('Caught exception:', err);
});

module.exports = router;
