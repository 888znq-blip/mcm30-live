<script type="module">
// 1. Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 2. Your Firebase Configuration
// Based on your provided JSON, your Project ID is mcm30-db-fe9da
const firebaseConfig = {
    projectId: "mcm30-db-fe9da",
    databaseURL: "https://mcm30-db-fe9da-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 3. DNA Engine Core Variables
const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let matrixData = {}; 
let currentColumn = 0;
let cameraX = 0;
let isFollowing = true;
let pulsingRows = new Set();

const CELL_W = 68, TOTAL_ROWS = 30, MAX_COLS = 14400, MARGIN_RIGHT = 145;
let CELL_H = 12;
const pad = (n, s = 2) => String(n).padStart(s, '0');

// 4. THE LIVE SYNC: Listen to Firebase instead of WebSocket
const matrixRef = ref(db, 'matrixData');

onValue(matrixRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        matrixData = data;
        
        // Find the most recent column to update the status and camera
        const cols = Object.keys(matrixData).map(Number);
        currentColumn = Math.max(...cols);
        
        document.getElementById('status').innerText = "LIVE SYNC";
        document.getElementById('status').style.color = "var(--green)";
        
        updatePanels();
        if (isFollowing) jumpToCurrent();
    }
});

// --- UI AND DRAWING LOGIC (Keep as is but remove direct WebSocket calls) ---

function updatePanels() {
    let hS = '', hI = '', hR = '', rMap = {}, gMap = {}, allP = [];
    pulsingRows.clear();
    for (let r = 0; r < TOTAL_ROWS; r++) {
        let rM = 0, gM = 0, rS = {}, gS = {};
        Object.values(matrixData).forEach(m => {
            if (m[r]) {
                if (m[r].c === 'R') { rM = Math.max(rM, m[r].s); rS[m[r].s] = (rS[m[r].s] || 0) + 1; }
                else { gM = Math.max(gM, m[r].s); gS[m[r].s] = (gS[m[r].s] || 0) + 1; }
            }
        });
        ['R', 'G'].forEach((c, i) => {
            const map = i === 0 ? rS : gS;
            Object.keys(map).forEach(s => { let freq = map[s], st = parseInt(s); allP.push({ r, c, s: st, sc: st * (100 / freq) }); });
        });
        hS += `<div class="streak-row" onclick="openModal(${r})" style="position:absolute;top:${r * CELL_H}px;height:${CELL_H}px">
            <div class="streak-col red-side">${rM ? 'x' + rM : '--'}</div><div class="streak-col green-side">${gM ? 'x' + gM : '--'}</div></div>`;
        [rS, gS].forEach((m, i) => {
            const srt = Object.keys(m).map(Number).sort((a, b) => b - a);
            if (srt.length) {
                const b = srt[0], f = m[b];
                const k = `X${b}-${f}`, sc = b * (100 / f);
                (i === 0 ? rMap : gMap)[k] = { sc, r };
            }
        });
    }
    allP.sort((a, b) => b.sc - a.sc).slice(0, 10).forEach(p => {
        const live = matrixData[currentColumn]?.[p.r];
        if (live && live.c === p.c && Math.abs(live.s - p.s) <= 1) pulsingRows.add(p.r);
    });
    for (let r = 0; r < TOTAL_ROWS; r++) hI += `<div class="index-cell ${pulsingRows.has(r) ? 'pulsing' : ''}" style="top:${r * CELL_H}px;height:${CELL_H}px">${r}</div>`;
    const rE = Object.keys(rMap).sort((a, b) => rMap[b].sc - rMap[a].sc), gE = Object.keys(gMap).sort((a, b) => gMap[b].sc - gMap[a].sc);
    for (let i = 0; i < Math.max(rE.length, gE.length); i++) {
        const rK = rE[i] || '--', gK = gE[i] || '--', rAttr = rK !== '--' ? `onclick="openReversalModal('${rK}',${rMap[rK].r},'red')"` : '', gAttr = gK !== '--' ? `onclick="openReversalModal('${gK}',${gMap[gK].r},'green')"` : '';
        hR += `<div class="reversal-row" style="position:absolute;top:${i * CELL_H}px;height:${CELL_H}px"><div class="reversal-col red-side" ${rAttr}>${rK}</div><div class="reversal-col green-side" ${gAttr}>${gK}</div></div>`;
    }
    document.getElementById('streakPanel').innerHTML = hS; document.getElementById('indexPanel').innerHTML = hI; document.getElementById('reversalPanel').innerHTML = hR;
}

function jumpToCurrent() { cameraX = Math.max(0, (currentColumn * CELL_W) - (window.innerWidth - MARGIN_RIGHT - CELL_W)); }

window.onresize = () => {
    const dpr = window.devicePixelRatio || 1; canvas.width = window.innerWidth * dpr; canvas.height = (window.innerHeight - 42) * dpr;
    canvas.style.width = window.innerWidth + 'px'; canvas.style.height = (window.innerHeight - 42) + 'px';
    ctx.scale(dpr, dpr); CELL_H = (window.innerHeight - 85) / TOTAL_ROWS;
};

function draw() {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfISTWeek = new Date(now.setDate(diff));
    startOfISTWeek.setHours(0, 0, 0, 0);

    ctx.save(); ctx.translate(-cameraX, 0);
    let sC = Math.max(0, Math.floor(cameraX / CELL_W)), eC = Math.min(MAX_COLS - 1, Math.floor((cameraX + window.innerWidth) / CELL_W) + 1);
    for (let a = sC; a <= eC; a++) {
        let x = a * CELL_W;
        if (matrixData[a]) Object.keys(matrixData[a]).forEach(r => {
            const d = matrixData[a][r];
            ctx.fillStyle = d.c === 'G' ? '#10b981' : '#ef4444'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
            ctx.fillText('x' + d.s, x + CELL_W / 2, r * CELL_H + CELL_H / 2 + 4);
        });
        ctx.fillStyle = '#1f2937'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
        ctx.fillText(pad(a, 5), x + CELL_W / 2, (TOTAL_ROWS * CELL_H) + 12);
        const lD = new Date(startOfISTWeek.getTime() + (a * 30000));
        ctx.fillStyle = '#6b7280'; ctx.font = '6px monospace';
        ctx.fillText(`${pad(lD.getHours())}:${pad(lD.getMinutes())}:${pad(lD.getSeconds())}`, x + CELL_W / 2, (TOTAL_ROWS * CELL_H) + 22);
    }
    ctx.restore(); requestAnimationFrame(draw);
}

window.onresize(); draw();
</script>
