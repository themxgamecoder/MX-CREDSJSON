const express = require('express');
const fs = require('fs');
const path = require('path');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

function generateId() {
    return "mekaai_" + Math.floor(Math.random() * 100000);
}

if (!fs.existsSync('./creds')) fs.mkdirSync('./creds');

router.get('/creds', async (req, res) => {
    const id = req.query.id;
    const filepath = `./creds/${id}.json`;
    if (!id || !fs.existsSync(filepath)) {
        return res.status(404).json({ error: "File not found or expired" });
    }
    res.sendFile(path.resolve(filepath));
});

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function XeonPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);

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
                const id = generateId();

                if (!res.headersSent) {
                    res.send({ code, id });
                }

                XeonBotInc.ev.on("connection.update", async (s) => {
                    const { connection, lastDisconnect } = s;

                    if (connection === "open") {
                        console.log("✅ WhatsApp paired successfully:", XeonBotInc.user?.id);
                        await delay(7000);

                        // Save valid JSON
                        const sessionData = JSON.parse(fs.readFileSync('./session/creds.json', 'utf-8'));
                        fs.writeFileSync(`./creds/${id}.json`, JSON.stringify(sessionData, null, 2));

                        const audioxeon = fs.readFileSync('./MX-2.0.mp3');

                        try {
                            await XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");

                            const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                                document: Buffer.from(JSON.stringify(sessionData)),
                                mimetype: 'application/json',
                                fileName: `creds.json`,
                            });

                            await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                                text: `✅ *Your Pairing Was Successful!*\n\n🆔 Your File ID: *${id}*\n\n📥 Use this ID in Replit to auto-download your creds.json.\n\n🛑 _Don't share this ID with anyone!_`,
                                quoted: xeonses,
                            });

                            await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                                audio: audioxeon,
                                mimetype: 'audio/mp4',
                                ptt: true,
                            }, {
                                quoted: xeonses
                            });

                            await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                                text: `*_🛑Do not share this file with anybody_*\n\n© *_Subscribe_* www.youtube.com/@mxgamecoder *_on YouTube_*`,
                            }, {
                                quoted: xeonses
                            });

                            await delay(3000);
                        } catch (err) {
                            console.error("❌ Error sending messages:", err.message);
                        }

                        await removeFile('./session');
                        process.exit(0);
                    }

                    else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                        await delay(10000);
                        XeonPair();
                    }
                });
            }

            XeonBotInc.ev.on('creds.update', saveCreds);

        } catch (err) {
            console.log("service restated");
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await XeonPair();
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
