const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 5000;
let code = require('./mx');
require('events').EventEmitter.defaultMaxListeners = 500;
app.use('/code', code);
app.use('/mx',async (req, res, next) => {
res.sendFile(__path + '/mx.html')
})
app.use('/',async (req, res, next) => {
res.sendFile(__path + '/meka.html')
})
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.listen(PORT, '0.0.0.0', () => {
    console.log(`YoutTube: mxgamecoder\nTelegram: mxgamecoderr\nGitHub: https://t.me/mxgamecoderr
\nInstsgram: themxgamecoder\nPLEASE STAR OUR REPO\nMX-GΔMΞCØDΞR
 LOVE YOU GUYS
\n\nServer running on http://0.0.0.0:` + PORT)
})

module.exports = app
