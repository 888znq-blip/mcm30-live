import express from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import WebSocket from 'ws';

// 1. SETUP FIREBASE
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://mcm30-db-fe9da-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = getDatabase();
const DERIV_WS = "wss://ws.derivws.com/websockets/v3?app_id=1089";

const app = express();
const port = process.env.PORT || 3000;

app.get('/update', async (req, res) => {
    try {
        await runDataCollection();
        res.status(200).send('EURUSD Data updated successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating data');
    }
});

app.get('/', (req, res) => res.send('MCM EURUSD Bot is Active.'));

app.listen(port, () => console.log(`Server running on port ${port}`));

// 3. THE LOGIC (EURUSD & MONDAY START)
function runDataCollection() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(DERIV_WS);
        
        const safetyTimeout = setTimeout(() => {
            ws.terminate();
            reject(new Error("WebSocket timeout"));
        }, 20000);

        // Calculate Monday 00:00:00 UTC of current week
        const getMondayTimestamp = () => {
            const now = new Date();
            const day = now.getUTCDay();
            const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0));
            return Math.floor(monday.getTime() / 1000);
        };

        ws.on('open', () => {
            console.log("Fetching EURUSD from Monday...");
            ws.send(JSON.stringify({
                ticks_history: "frxEURUSD", // Updated to EUR/USD
                adjust_start_time: 1,
                start: getMondayTimestamp(), // Dynamic Monday Start
                end: "latest",
                style: "ticks"
            }));
        });

        ws.on('message', async (data) => {
            const msg = JSON.parse(data);
            if (msg.history) {
                clearTimeout(safetyTimeout);
                const historyRef = db.ref('tick_history');
                await historyRef.set({
                    prices: msg.history.prices,
                    times: msg.history.times,
                    symbol: "EURUSD",
                    lastUpdate: Date.now()
                });
                console.log("Database updated with EURUSD data.");
                ws.close();
                resolve();
            }
        });
        
        ws.on('error', (e) => {
            clearTimeout(safetyTimeout);
            reject(e);
        });
    });
}
