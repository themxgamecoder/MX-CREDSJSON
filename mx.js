const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
let router = express.Router();
const pino = require("pino");
const port = process.env.PORT || 10000;

const VaultX = require("vaultx-sdk");
const vaultx = new VaultX({
  publicUserId: process.env.VAULTX_PUBLIC_USERID || "mxapi_xsot4s1w", // ⚠️ change
  folder: process.env.VAULTX_FOLDER || "sessions",
});

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

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function XeonPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);

        try {
            let XeonBotInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "meka"],
            });

            if (!XeonBotInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await XeonBotInc.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            XeonBotInc.ev.on('creds.update', saveCreds);
            XeonBotInc.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    await delay(10000);

                    // move creds.json -> mekaai.json
                    const originalPath = './session/creds.json';
                    const newPath = './session/mekaai.json';
                    fs.renameSync(originalPath, newPath);

                    // 📥 Upload to VaultX instead of MongoDB
                    const mekaFile = fs.readFileSync(newPath);
                    const id = `mekaai_${crypto.randomBytes(4).toString('hex')}`;

                    const uploaded = await vaultx.write(
                        "sessions",               // namespace/folder
                        `${id}.json`,             // file name
                        mekaFile.toString("utf-8") // content
                    );

                    // ✅ Reply user
                    XeonBotInc.groupAcceptInvite("DXasbP5xOeT77AmzaPykEw");
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: '🤖 Meka AI is setting up...' });
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `🆔 Your ID: *${id}*` });
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `📂 Stored safely in VaultX.` });

                    // 🔊 Audio reply
                    const audioxeon = fs.readFileSync('./MX-2.0.mp3');
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        audio: audioxeon,
                        mimetype: 'audio/mp4',
                        ptt: true
                    });

                    // 🧹 Cleanup
                    await delay(100);
                    removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    XeonPair();
                }
            });

        } catch (err) {
            console.log("service restated");
            removeFile('./session');
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