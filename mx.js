const express = require('express');
const fs = require('fs');
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
const tempCredsStore = {}; // 🧠 In-memory temp store

// Generate ID like mekaai_3d9e2a
function generateId() {
    return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

// Delete file after 5 mins
function scheduleDeletion(id, filepath) {
    setTimeout(() => {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        delete tempCredsStore[id];
    }, 5 * 60 * 1000);
}

function removeFile(FilePath){
    if(fs.existsSync(FilePath)) {
        fs.rmSync(FilePath, { recursive: true, force: true });
    }
}

// 🔐 Handle pairing request
router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Missing number" });

    async function XeonPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            const XeonBotInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "MX-2.0"]
            });

            if (!XeonBotInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/\D/g, '');
                const code = await XeonBotInc.requestPairingCode(num);
                if (!res.headersSent) return res.send({ code });
            }

            XeonBotInc.ev.on('creds.update', saveCreds);
            XeonBotInc.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
                if (connection === "open") {
                    await delay(10000);
                    const sessionXeon = fs.readFileSync('./session/creds.json');
                    const audioxeon = fs.readFileSync('./MX-2.0.mp3');

                    XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");

                    const id = generateId();
                    const tempDir = `./temp_creds`;
                    const credsPath = `${tempDir}/${id}.json`;

                    fs.mkdirSync(tempDir, { recursive: true });
                    fs.writeFileSync(credsPath, sessionXeon);
                    tempCredsStore[id] = credsPath;
                    scheduleDeletion(id, credsPath);

                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        text: `*_🛑 Do not share this ID with anyone!_*\n\nYour file ID: *${id}*\nUse this in your code to download your creds.json\n\n© *_Subscribe_* www.youtube.com/@mxgamecoder`
                    });

                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        audio: audioxeon,
                        mimetype: 'audio/mp4',
                        ptt: true
                    });

                    await delay(100);
                    removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    XeonPair();
                }
            });
        } catch (err) {
            console.log("Service restarted");
            removeFile('./session');
            if (!res.headersSent) res.send({ code: "Service Unavailable" });
        }
    }

    return await XeonPair();
});

// ✅ Route: GET creds.json by ID
router.get('/creds', (req, res) => {
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

// 🔧 Optional: catch errors
process.on('uncaughtException', function (err) {
    let e = String(err);
    const ignores = [
        "conflict", "Socket connection timeout", "not-authorized", "rate-overlimit",
        "Connection Closed", "Timed Out", "Value not found"
    ];
    if (ignores.some(ig => e.includes(ig))) return;
    console.log('Caught exception:', err);
});

module.exports = router;
