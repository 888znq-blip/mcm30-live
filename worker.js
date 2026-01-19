const admin = require("firebase-admin");
const WebSocket = require('ws');
const express = require('express');

// 1. Initialize Firebase Admin (Using the key you provided)
const serviceAccount = require("./mcm30-db-fe9da-firebase-adminsdk-fbsvc-e642cc6138.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mcm30-db-fe9da-default-rtdb.firebaseio.com"
});
const db = admin.database();

// 2. Keep Render Awake logic
const app = express();
app.get('/', (req, res) => res.send('DNA Worker Active'));
app.listen(process.env.PORT || 3000);

// 3. Trading Logic Constants
const SYMBOL = "frxEURUSD";
const MAX_COLS = 20160; 
let matrixData = {};

// 4. WebSocket Connection to Deriv
let ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

ws.on('open', () => {
    ws.send(JSON.stringify({ authorize: "TpVIBWpqet5X8AH" }));
});

ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.authorize) {
        // Pull historical data from Monday 00:00 IST to now
        const now = new Date();
        const monday = new Date(now.setDate(now.getDate() - (now.getDay() + 6) % 7));
        monday.setHours(0,0,0,0);
        const startEpoch = Math.floor((monday.getTime() - (5.5 * 3600000)) / 1000);
        
        ws.send(JSON.stringify({
            ticks_history: SYMBOL,
