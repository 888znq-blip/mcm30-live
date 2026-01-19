const admin = require("firebase-admin");
const WebSocket = require('ws');
const express = require('express');

// 1. Firebase Admin Setup
const serviceAccount = require("./mcm30-db-fe9da-firebase-adminsdk-fbsvc-e642cc6138.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://mcm30-db-fe9da-default-rtdb.firebaseio.com"
});
const db = admin.database();

// 2. Keep Render Alive (Express Server)
const app = express();
app.get('/', (req, res) => res.send('DNA CORE SERVER ACTIVE'));
app.listen(process.env.PORT || 3000);

// 3. DNA Engine Variables
const SYMBOL = "frxEURUSD";
const TOKEN = "TpVIBWpqet5X8AH";
let matrixData = {}; 

function getWeekProgress() {
    const now = new Date();
    const day = now.getDay();
    const secsToday = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    let s = (day === 0) ? (6 * 86400) + secsToday : ((day - 1) * 86400) + secsToday;
    return Math.max(0, s);
}

// 4. Connect to Market
function connect() {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");
    
    ws.on('open', () => ws.send(JSON.stringify({ authorize: TOKEN })));
    
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.authorize) ws.send(JSON.stringify({ ticks: SYMBOL, subscribe: 1 }));
        
        if (msg.tick) {
            const s = getWeekProgress();
            const col = Math.floor(s / 30);
            const row = s % 30;
            const price = msg.tick.quote;

            // Simple Streak Logic for the server
            // (You can expand this to match your exact DNA logic)
            const color = (Math.random() > 0.5) ? 'G' : 'R'; 
            
            // SAVE TO FIREBASE
            db.ref(`matrixData/${col}/${row}`).set({
                c: color,
                p: price,
                s: 1 // streak
            });
        }
    });

    ws.on('close', () => setTimeout(connect, 3000));
}

connect();
