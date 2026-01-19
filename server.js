import express from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import WebSocket from 'ws';
import cors from 'cors'; // Added CORS support for frontend buttons

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://mcm30-db-fe9da-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = getDatabase();
const DERIV_WS = "wss://ws.derivws.com/websockets/v3?app_id=1089";

const app = express();
app.use(cors()); // Allow your Netlify/GitHub domain to call the reset
const port = process.env.PORT || 3000;

app.get('/reset-cloud', async (req, res) => {
    try {
        await db.ref('tick_history').remove(); 
        await runCollection(true); // True = start from NOW
        res.status(200).send('Database wiped and restarted.');
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/update', async (req, res) => {
    try {
        await runCollection(false); // False = standard Monday start
        res.status(200).send('Standard weekly update successful.');
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(port, () => console.log(`Server running on port ${port}`));

function runCollection(isFresh) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(DERIV_WS);
        const timeout = setTimeout(() => { ws.terminate(); reject(new Error("Timeout")); }, 30000);

        const getMonday = () => {
            const now = new Date();
            const day = now.getUTCDay();
            const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
            return Math.floor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0,0,0)).getTime() / 1000);
        };

        ws.on('open', () => {
            const startTime = isFresh ? Math.floor(Date.now() / 1000) : getMonday();
            ws.send(JSON.stringify({
                ticks_history: "frxEURUSD",
                adjust_start_time: 1,
                start: startTime,
                end: "latest",
                style: "ticks"
            }));
        });

        ws.on('message', async (data) => {
            const msg = JSON.parse(data);
            if (msg.history) {
                clearTimeout(timeout);
                await db.ref('tick_history').set({
                    prices: msg.history.prices,
                    times: msg.history.times,
                    lastUpdate: Date.now()
                });
                ws.close();
                resolve();
            }
        });
    });
}
