import express from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import WebSocket from 'ws';

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://mcm30-db-fe9da-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = getDatabase();
const DERIV_WS = "wss://ws.derivws.com/websockets/v3?app_id=1089";

const app = express();
const port = process.env.PORT || 3000;

// Existing Update Route
app.get('/update', async (req, res) => {
    try {
        await runDataCollection(false); // Normal Monday start
        res.status(200).send('Data updated from Monday');
    } catch (error) {
        res.status(500).send('Error');
    }
});

// NEW: RESET ROUTE
app.get('/reset-cloud', async (req, res) => {
    console.log("HARD RESET INITIATED...");
    try {
        await db.ref('tick_history').remove(); // Wipe Firebase
        await runDataCollection(true);         // Start fresh from NOW
        res.status(200).send('Cloud Reset Successful');
    } catch (error) {
        res.status(500).send('Reset Failed');
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));

function runDataCollection(isFresh = false) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(DERIV_WS);
        const timeout = setTimeout(() => { ws.terminate(); reject(); }, 20000);

        const getMonday = () => {
            const now = new Date();
            const day = now.getUTCDay();
            const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
            return Math.floor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0,0,0)).getTime() / 1000);
        };

        ws.on('open', () => {
            // Logic: If isFresh is true, start from "now". Otherwise, start from Monday.
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
