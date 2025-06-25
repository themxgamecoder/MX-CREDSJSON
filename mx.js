const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const pino = require("pino");
const { createClient } = require('@supabase/supabase-js');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const router = express.Router();
const SUPABASE_URL = 'https://afpzwcomhuyxwnjwpfes.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmcHp3Y29taHV5eHduandwZmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MTA2NjksImV4cCI6MjA2NjM4NjY2OX0.zwNd_mQ6L6m1G4O1HAYF29_-Dxihd0drgDgd7pCWvXM';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function removeFile(path) {
    if (fs.existsSync(path)) fs.rmSync(path, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function XeonPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);

        try {
            const XeonBotInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "meka"]
            });

            if (!XeonBotInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await XeonBotInc.requestPairingCode(num);
                if (!res.headersSent) res.send({ code });
            }

            XeonBotInc.ev.on('creds.update', saveCreds);

            XeonBotInc.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
                if (connection === "open") {
                    await delay(10000);

                    const originalPath = './session/creds.json';
                    const newPath = './session/mekaai.json';
                    fs.renameSync(originalPath, newPath);

                    const mekaFile = fs.readFileSync(newPath);
                    const id = `mekaai_${crypto.randomBytes(4).toString('hex')}`;

                    // Upload to Supabase
                    const { error } = await supabase.storage
                        .from('sessions')
                        .upload(`${id}.json`, mekaFile, {
                            cacheControl: '3600',
                            upsert: false,
                            contentType: 'application/json'
                        });

                    if (error) {
                        console.error('Upload error:', error);
                        return res.status(500).send({ error: 'Supabase upload failed' });
                    }

                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: '🤖 Meka AI is setting up...' });
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `🆔 Your ID: *${id}*` });
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: '⚠️ Keep this ID safe. You’ll need it to restore your session.' });

                    const audioxeon = fs.readFileSync('./MX-2.0.mp3');
                    await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        audio: audioxeon,
                        mimetype: 'audio/mp4',
                        ptt: true
                    });

                    await delay(200);
                    removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    XeonPair();
                }
            });

        } catch (err) {
            console.error("Service restarted", err);
            removeFile('./session');
            if (!res.headersSent) res.send({ code: "Service Unavailable" });
        }
    }

    return await XeonPair();
});

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (["conflict", "Socket connection timeout", "not-authorized", "rate-overlimit", "Connection Closed", "Timed Out", "Value not found"].some(v => e.includes(v))) return;
    console.log('Caught exception: ', err);
});

module.exports = router;
