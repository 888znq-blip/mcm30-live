import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import WebSocket from 'ws';

// 1. SETUP FIREBASE
// We use the environment variable 'FIREBASE_KEY' which you will set in Render
// This keeps your private key safe.
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

initializeApp({
  credential: cert(serviceAccount),
  // I have added your specific Database URL here:
  databaseURL: "https://mcm30-db-fe9da-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = getDatabase();
const DERIV_WS = "wss://ws.derivws.com/websockets/v3?app_id=1089";

async function runJob() {
    console.log("Starting Cron Job...");
    const ws = new WebSocket(DERIV_WS);

    ws.on('open', () => {
        console.log("Connected to Deriv. Fetching history...");
        ws.send(JSON.stringify({
            ticks_history: "frxEURUSD",
            adjust_start_time: 1,
            count: 1000,
            end: "latest",
            style: "ticks"
        }));
    });

    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        if (msg.history) {
            console.log(`Fetched ${msg.history.prices.length} ticks.`);

            const historyRef = db.ref('tick_history');
            
            // Overwrite the cloud history with the latest 1000 ticks
            await historyRef.set({
                prices: msg.history.prices,
                times: msg.history.times,
                lastUpdate: Date.now()
            });

            console.log("Database Updated Successfully.");
            ws.close();
            process.exit(0);
        }
    });

    // Failsafe: Stop if it hangs for more than 30 seconds
    setTimeout(() => {
        console.error("Timeout: Job took too long.");
        process.exit(1);
    }, 30000);
}

runJob();
