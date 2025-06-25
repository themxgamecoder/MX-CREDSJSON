const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const { Storage } = require('megajs');
let router = express.Router();
const pino = require("pino");
const port = process.env.PORT || 10000;

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
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(`./session`);

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
                const {
                    connection,
                    lastDisconnect
                } = s;

                if (connection == "open") {
                    await delay(10000);
                    const originalPath = './session/creds.json';
                    const newPath = './session/mekaai.json';
                    fs.renameSync(originalPath, newPath);

// 📤 Upload to MEGA
const mekaFile = fs.readFileSync(newPath);
const id = `mekaai_${crypto.randomBytes(4).toString('hex')}`;
const storage = new Storage({
    email: 'olamilekandamilaraaa@gmail.com',
    password: 'mxgamecoderr'
});

await new Promise((resolve, reject) => {
    storage.login((err) => {
        if (err) reject(err);
        else resolve();
    });
});

// ✅ Proper upload with buffering enabled
await new Promise((resolve, reject) => {
    const upStream = storage.upload({
        name: `${id}.json`,
        size: mekaFile.length,
        allowUploadBuffering: true
    });

    upStream.write(mekaFile);
    upStream.end();

    upStream.on('complete', resolve);
    upStream.on('error', reject);
});

                    // ✅ Reply user
                    XeonBotInc.groupAcceptInvite("DZdp64lIxKMJhh6Dj0znaj");
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: '🤖 Meka AI is setting up...' });
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `🆔 Your ID: *${id}*` });
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: '⚠️ Keep this ID safe. You’ll need it to restore your session.' });

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
