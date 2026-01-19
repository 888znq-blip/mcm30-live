const admin = require("firebase-admin");
const WebSocket = require('ws');
const express = require('express');

// Initialize Firebase using your service account JSON file
const serviceAccount = require("./mcm30-db-fe9da-firebase-adminsdk-fbsvc-e642cc6138.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://mcm30-db-fe9da-default-rtdb.firebaseio.com"
});
const db = admin.database();

// Health check server for Render
const app = express();
app.get('/', (req, res) => res.send('DNA CORE LIVE'));
app.listen(process.env.PORT || 3000);

const SYMBOL = "frxEURUSD", TOKEN = "TpVIBWpqet5X8AH";

function getWeekProgress() {
    const now = new Date();
    const day = now.getDay();
    const secsToday = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    let s = (day === 0) ? (6 * 86400) + secsToday : ((day - 1) * 86400) + secsToday;
    return Math.max(0, s);
}

function connect() {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");
    ws.on('open', () => ws.send(JSON.stringify({ authorize: TOKEN })));
    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        if (msg.authorize) ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1 }));
        if (msg.tick) {
            const s = getWeekProgress();
            const col = Math.floor(s / 30);
            const row = s % 30;
            const price = msg.tick.quote;

            const prevCol = col > 0 ? col - 1 : 14399;
            const snap = await db.ref(`matrixData/${prevCol}/${row}`).once('value');
            const old = snap.val();

            let color = 'G', stk = 1;
            if (old) {
                color = price > old.p ? 'G' : (price < old.p ? 'R' : old.c);
                stk = color === old.c ? old.s + 1 : 1;
            }
            db.ref(`matrixData/${col}/${row}`).set({ c: color, s: stk, p: price });
        }
    });
    ws.on('close', () => setTimeout(connect, 3000));
}
connect();
