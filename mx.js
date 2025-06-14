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

const tempSessionStore = {}; // Only store ID, no creds.json

function generateId() {
    return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
};

function scheduleSessionDeletion(id) {
    setTimeout(() => {
        delete tempSessionStore[id];
        removeFile(`./temp_auth/${id}`);
    }, 60 * 60 * 1000); // 1 hour
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    const id = generateId();
    const tempPath = `./temp_auth/${id}`;

    async function startBot() {
        const { state, saveCreds } = await useMultiFileAuthState(tempPath);

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
                await delay(1000);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                if (!res.headersSent) {
                    return res.send({ code });
                }
            }

            sock.ev.on('creds.update', saveCreds);
            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    tempSessionStore[id] = tempPath;
                    scheduleSessionDeletion(id);

                    await sock.sendMessage(sock.user.id, {
                        text: `*_🛑 Do not share this ID with anyone_*\n\nYour access ID: *${id}*\n\nUse this to connect to your bot anytime for 1 hour.`
                    });

                    const audio = fs.readFileSync('./MX-2.0.mp3');
                    await sock.sendMessage(sock.user.id, {
                        audio,
                        mimetype: 'audio/mp4',
                        ptt: true
                    });

                    await delay(100);
                    if (fs.existsSync('./session')) removeFile('./session');
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(5000);
                    startBot();
                }
            });
        } catch (err) {
            console.log("Service error, restarting...");
            removeFile(tempPath);
            if (!res.headersSent) {
                res.send({ code: "Service Unavailable" });
            }
        }
    }

    await startBot();
});

// ✅ Route to return the session folder path via ID (use only internally or via your logic)
router.get('/connect', (req, res) => {
    const id = req.query.id;
    if (!id || !tempSessionStore[id]) {
        return res.status(404).send({ error: "Invalid or expired ID" });
    }

    return res.send({ message: `Valid ID: ${id}`, path: tempSessionStore[id] });
});

// Error handling
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
