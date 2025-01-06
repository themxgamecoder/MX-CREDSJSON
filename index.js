const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require('./mx');
require('events').EventEmitter.defaultMaxListeners = 500;
app.use('/code', code);
app.use('/mx',async (req, res, next) => {
res.sendFile(__path + '/mx.html')
})
app.use('/',async (req, res, next) => {
res.sendFile(__path + '/MX-2.0.html')
})
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.listen(PORT, () => {
    console.log(`YoutTube: mxgamecoder\nTelegram: mxgamecoderr\nGitHub: @themxgamecoder
\nInstsgram: themxgamecoder\nPLEASE STAR OUR REPO\nMX-GΔMΞCØDΞR
 LOVE YOU GUYS
\n\nServer running on http://localhost:` + PORT)
})

module.exports = app