const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const app = express();
const port = process.env.PORT || 10000;

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

// Create folders if not exist
if (!fs.existsSync('./creds')) fs.mkdirSync('./creds');
if (!fs.existsSync('./session')) fs.mkdirSync('./session');

// Util: delete folder
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Util: generate random ID
function generateId() {
    return "mekaai_" + Math.floor(Math.random() * 100000);
}

// Cleanup expired files every 5 mins
setInterval(() => {
    const files = fs.readdirSync('./creds');
    const now = Date.now();
    for (let file of files) {
        const filePath = path.join('./creds', file);
        const stats = fs.statSync(filePath);
        if (now - stats.ctimeMs > 60 * 60 * 1000) { // 1 hour
            fs.unlinkSync(filePath);
            console.log(`🧹 Deleted expired: ${file}`);
        }
    }
}, 5 * 60 * 1000); // Every 5 mins

// === Pairing Endpoint ===
app.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Missing number" });

    async function XeonPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);

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
                const id = generateId();

                XeonBotInc.ev.on("creds.update", async () => {
                    await delay(8000);
                    const credsPath = `./creds/${id}.json`;
                    const creds = fs.readFileSync('./session/creds.json');
                    fs.writeFileSync(credsPath, creds);

                    const file = fs.readFileSync(credsPath);
                    const audioxeon = fs.readFileSync('./MX-2.0.mp3');

                    const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        document: file,
                        mimetype: `application/json`,
                        fileName: `creds.json`
                    });

                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        text: `🔐 Your file has been paired.\n\n🆔 File ID: *${id}*\n\n📥 You can now paste this ID in the Replit terminal.\n\n🛑 _Do not share this ID or file with anyone_`,
                        quoted: xeonses
                    });

                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        audio: audioxeon,
                        mimetype: 'audio/mp4',
                        ptt: true
                    }, { quoted: xeonses });

                    await delay(100);
                    removeFile('./session');
                    XeonBotInc.end();
                });

                return res.send({ code, id });
            }

            XeonBotInc.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
                if (connection === "open") return;
                if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(5000);
                    XeonPair();
                }
            });

        } catch (err) {
            console.log("Error in XeonPair:", err);
            removeFile('./session');
            if (!res.headersSent) res.send({ code: "Service Unavailable" });
        }
    }

    return await XeonPair();
});

// === Download Endpoint ===
app.get('/creds', async (req, res) => {
    const id = req.query.id;
    const filepath = `./creds/${id}.json`;

    if (!id || !fs.existsSync(filepath)) {
        return res.status(404).json({ error: "File not found or expired" });
    }

    res.sendFile(filepath, { root: "." });
});

// Handle uncaught errors silently
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

app.listen(port, () => {
    console.log(`⚡ Pairing server running on port ${port}`);
});
