const admin = require("firebase-admin");
const WebSocket = require('ws');
const express = require('express');

// 1. Initialize Firebase Admin using your key file
const serviceAccount = require("./mcm30-db-fe9da-firebase-adminsdk-fbsvc-e642cc6138.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://mcm30-db-fe9da-default-rtdb.firebaseio.com"
});
const db = admin.database();

// 2. Render Health Check (Prevents deployment timeout)
const app = express();
app.get('/', (req, res) => res.send('DNA CORE SERVER ACTIVE'));
app.listen(process.env.PORT || 3000);

// 3. DNA Engine Variables
const SYMBOL = "frxEURUSD", TOKEN = "TpVIBWpqet5X8AH";
const MAX_COLS = 14400;

function getWeekProgress() {
    const now = new Date();
    const day = now.getDay();
    const secsToday = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    let s = (day === 0) ? (6 * 86400) + secsToday : ((day - 1) * 86400) + secsToday;
    return Math.max(0, s);
}

// 4. Connect to Market and Save to Firebase
function connect() {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");
    
    ws.on('open', () => ws.send(JSON.stringify({ authorize: TOKEN })));
    
    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        if (msg.authorize) ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1 }));
        
        if (msg.tick) {
            const s = getWeekProgress();
            const col = Math.floor(s / 30) % MAX_COLS;
            const row = s % 30;
            const price = msg.tick.quote;

            // Get previous data from Firebase to calculate streak
            const prevCol = col > 0 ? col - 1 : MAX_COLS - 1;
            const snapshot = await db.ref(`matrixData/${prevCol}/${row}`).once('value');
            const old = snapshot.val();

            let color = 'G', streak = 1;
            if (old) {
                color = price > old.p ? 'G' : (price < old.p ? 'R' : old.c);
                streak = color === old.c ? old.s + 1 : 1;
            }

            // Save to Firebase
            db.ref(`matrixData/${col}/${row}`).set({
                c: color,
                p: price,
                s: streak
            });
        }
    });

    ws.on('close', () => setTimeout(connect, 3000));
}

connect();
