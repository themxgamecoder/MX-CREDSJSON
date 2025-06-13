const express = require('express');
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 8000;
require('events').EventEmitter.defaultMaxListeners = 500;

// Routes
const mxRoutes = require('./mx');

// ⚙️ Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 👇 Mount your routes FIRST
app.use('/', mxRoutes); // so /creds and /?number=... works!

// 🌐 Serve fallback HTML for unmatched routes
app.get('/mx', (req, res) => {
  res.sendFile(path.join(__dirname, 'mx.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'meka.html'));
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`MX-GΔMΞCØDΞR | YouTube: @mxgamecoder`);
});
