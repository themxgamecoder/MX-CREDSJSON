const express = require('express');
const fs = require('fs');
const path = require('path'); // ✅ added
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

// ✅ generate random ID
function generateId() {
    return "mekaai_" + Math.floor(Math.random() * 100000);
}

// ✅ ensure /creds folder exists
if (!fs.existsSync('./creds')) fs.mkdirSync('./creds');

// ✅ new creds route
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
                browser: [ "Ubuntu", "Chrome", "MX-2.0" ],
             });
             if(!XeonBotInc.authState.creds.registered) {
                await delay(1500);
                        num = num.replace(/[^0-9]/g,'');
                            const code = await XeonBotInc.requestPairingCode(num)
                                const id = generateId(); // ✅ now available everywhere

if(!res.headersSent){
    res.send({code, id});

    XeonBotInc.ev.on('creds.update', async () => {
        await delay(7000);
        const sessionXeon = fs.readFileSync('./session/creds.json');
        fs.writeFileSync(`./creds/${id}.json`, sessionXeon); // ✅ save creds to file
                         const audioxeon = fs.readFileSync('./MX-2.0.mp3');
                         XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");
                         const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                             document: sessionXeon,
                             mimetype: `application/json`,
                             fileName: `creds.json`
                         });
                         await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                             text: `✅ *Your Pairing Was Successful!*\n\n🆔 Your File ID: *${id}*\n\n📥 Use this ID in the Replit Terminal to auto-download your creds.json.\n\n*_Do not share this ID with anyone._*`,
                             quoted: xeonses
                         });
                         XeonBotInc.sendMessage(XeonBotInc.user.id, {
                             audio: audioxeon,
                             mimetype: 'audio/mp4',
                             ptt: true
                         }, {
                             quoted: xeonses
                         });
                         await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                             text: `*_🛑Do not share this file with anybody_*\n\n© *_Subscribe_* www.youtube.com/@mxgamecoder *_on Youtube_*`
                         }, {
                             quoted: xeonses
                         });
                         await delay(100);
                         return await removeFile('./session');
                         process.exit(0)
                     });
                 }
             }
            XeonBotInc.ev.on('creds.update', saveCreds)
            XeonBotInc.ev.on("connection.update", async (s) => {
                const {
                    connection,
                    lastDisconnect
                } = s;
                if (connection == "open") {
                    // Already handled above
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
