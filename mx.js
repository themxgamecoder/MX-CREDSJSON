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

// Store for temp creds with auto-expiry
const tempCredsStore = {};

// Generate ID like mekaai_3d9e2a
function generateId() {
    return "mekaai_" + crypto.randomBytes(3).toString("hex");
}

// Delete file after 2 mins if unused
function scheduleDeletion(id, filepath) {
    setTimeout(() => {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        delete tempCredsStore[id];
    }, 2 * 60 * 1000); // 2 minutes
}

function removeFile(FilePath){
    if(!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
};

router.get('/', async (req, res) => {
    let num = req.query.number;
    async function XeonPair() {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(`./session`);
        try {
            let XeonBotInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                printQRInTerminal: false,
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: [ "Ubuntu", "Chrome", "MX-2.0" ],
            });

            if(!XeonBotInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g,'');
                const code = await XeonBotInc.requestPairingCode(num);
                if(!res.headersSent){
                    await res.send({code});
                }
            }

            XeonBotInc.ev.on('creds.update', saveCreds);
            XeonBotInc.ev.on("connection.update", async (s) => {
                const {
                    connection,
                    lastDisconnect
                } = s;

                if (connection == "open") {
                    await delay(10000);

                    const sessionXeon = fs.readFileSync('./session/creds.json');
                    const audioxeon = fs.readFileSync('./MX-2.0.mp3');
                    XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");

                    // 🔥 Create unique temp file
                    const id = generateId();
                    const tempDir = `./temp_creds`;
                    const credsPath = `${tempDir}/${id}.json`;

                    // ✅ Ensure folder exists (works even on Render)
                    fs.mkdirSync(tempDir, { recursive: true });
                    fs.writeFileSync(credsPath, sessionXeon);
                    tempCredsStore[id] = credsPath;
                    scheduleDeletion(id, credsPath); // delete after 5 min

                    // 📩 Send ID to user (not the file)
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        text: `*_🛑Do not share this ID with anyone_*\n\nYour file ID: *${id}*\n\nUse this in your code to download your creds.json\n\n© *_Subscribe_* www.youtube.com/@mxgamecoder *_on Youtube_*`
                    });

                    // 🔊 Send audio
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        audio: audioxeon,
                        mimetype: 'audio/mp4',
                        ptt: true
                    });

                    await delay(100);
                    await removeFile('./session');
                   // process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    XeonPair();
                }
            });
        } catch (err) {
            console.log("service restated");
            await removeFile('./session');
            if(!res.headersSent){
                await res.send({code:"Service Unavailable"});
            }
        }
    }
    return await XeonPair();
});

// ✅ New Route to GET the creds.json by ID
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

// 👀 Optional: Error safety
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
