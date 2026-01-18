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

// 2. SETUP SERVER
const app = express();
const port = process.env.PORT || 3000;

app.get('/update', async (req, res) => {
    console.log("External trigger received. Starting job...");
    try {
        await runDataCollection();
        res.status(200).send('Data updated successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating data');
    }
});

app.get('/', (req, res) => res.send('MCM Bot is Sleeping. Hit /update to wake me.'));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// 3. THE LOGIC (UPDATED FOR BTC)
function runDataCollection() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(DERIV_WS);
        
        const safetyTimeout = setTimeout(() => {
            ws.terminate();
            reject(new Error("WebSocket timeout"));
        }, 20000);

        ws.on('open', () => {
            console.log("Connected to Deriv. Fetching BTCUSD...");
            ws.send(JSON.stringify({
                ticks_history: "cryBTCUSD", // CHANGED TO BTC
                adjust_start_time: 1,
                count: 1000,
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
                    lastUpdate: Date.now()
                });
                console.log("Database updated with BTC data.");
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
