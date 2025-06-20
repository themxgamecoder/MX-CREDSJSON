const express = require('express');
const fs = require('fs');
let router = express.Router()
const pino = require("pino");
const port = process.env.PORT || 10000;
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function removeFile(FilePath){
    if(!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true })
};
router.get('/', async (req, res) => {
    let num = req.query.number;
    async function XeonPair() {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(`./session`)
        try {
            let XeonBotInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                printQRInTerminal: false,
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: [ "Ubuntu", "Chrome", "meka" ],
            });
            if(!XeonBotInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g,'');
                const code = await XeonBotInc.requestPairingCode(num)
                if(!res.headersSent){
                    await res.send({code});
                }
            }
            XeonBotInc.ev.on('creds.update', saveCreds)
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
                    const sessionXeon = fs.readFileSync(newPath);
                    const audioxeon = fs.readFileSync('./MX-2.0.mp3');
                    XeonBotInc.groupAcceptInvite("DZdp64lIxKMJhh6Dj0znaj");
                    const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, { 
                        document: sessionXeon, 
                        mimetype: `application/json`, 
                        fileName: `mekaai.json` 
                    });
                    XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        audio: audioxeon,
                        mimetype: 'audio/mp4',
                        ptt: true
                    }, {
                        quoted: xeonses
                    });

                    // 🖼 Send image from local file `mx.jpg`
                    const imgMessage = await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                        image: fs.readFileSync('./mx.jpg'),
                        caption: `*🤖 MEKAAI BOT - VERSION 1.0*\n\nYou really thought it would be that easy to clone me? 😏\nGuess again, human... Your fate is sealed. 🔒\n\n💀 Mooo hahahahahha moo hahahahahha 😈\n\n— Powered by *ChatGPT x MekaAI*`
                    }, {
                        quoted: xeonses
                    });

                    await delay(100);
                    return await removeFile('./session');
                    process.exit(0)
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
    return await XeonPair()
});

process.on('uncaughtException', function (err) {
    let e = String(err)
    if (e.includes("conflict")) return
    if (e.includes("Socket connection timeout")) return
    if (e.includes("not-authorized")) return
    if (e.includes("rate-overlimit")) return
    if (e.includes("Connection Closed")) return
    if (e.includes("Timed Out")) return
    if (e.includes("Value not found")) return
    console.log('Caught exception: ', err)
})

module.exports = router
