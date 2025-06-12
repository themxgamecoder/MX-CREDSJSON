const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const router = express.Router();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

// 🔧 Remove a file or folder safely
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const num = req.query.number?.replace(/[^0-9]/g, '');
    if (!num || num.length < 10) return res.status(400).send({ error: "Invalid number" });

    // ✅ Ensure ./session folder exists
    const sessionDir = path.join(__dirname, 'session');
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    async function startPairing() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);

        try {
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "MX-2.0"]
            });

            // 🔐 Save credentials on update
            sock.ev.on('creds.update', saveCreds);

            // 📡 Handle connection updates
            sock.ev.on("connection.update", async ({ connection }) => {
                if (connection === "open") {
                    console.log("✅ Paired successfully. Saving session...");

                    await saveCreds();

                    // 📁 Send creds.json to the paired number
                    const sessionFile = './session/creds.json';
                    if (fs.existsSync(sessionFile)) {
                        const sessionData = fs.readFileSync(sessionFile);
                        await sock.sendMessage(sock.user.id, {
                            document: sessionData,
                            mimetype: "application/json",
                            fileName: "creds.json"
                        });

                        await sock.sendMessage(sock.user.id, {
                            text: `✅ *Session saved.*\n\n🛑 *Do not share this file.*\nSubscribe 👉 youtube.com/@mxgamecoder`
                        });
                    }

                    await delay(5000);
                    process.exit(0); // ✅ Exit cleanly after pairing
                }
            });

            // 📲 Request pairing code
            if (!sock.authState.creds.registered) {
                await delay(1500);
                const code = await sock.requestPairingCode(num);
                console.log(`🔑 Pairing Code for ${num}: ${code}`);
                if (!res.headersSent) {
                    res.send({ code });
                }
            }
        } catch (err) {
            console.error("❌ Pairing Error:", err);
            removeFile('./session');
            if (!res.headersSent) res.status(500).send({ code: "Service Unavailable" });
        }
    }

    return await startPairing();
});

// 🛠 Ignore known harmless errors
process.on('uncaughtException', function (err) {
    const e = String(err);
    const ignored = [
        "conflict", "Socket connection timeout", "not-authorized",
        "rate-overlimit", "Connection Closed", "Timed Out", "Value not found"
    ];
    if (ignored.some(i => e.includes(i))) return;
    console.error('❗ Uncaught Exception:', err);
});

module.exports = router;
