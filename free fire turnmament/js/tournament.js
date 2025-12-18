/**
 * tournament.js
 * Premium Tournament Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const tourId = new URLSearchParams(window.location.search).get('id');
    if (tourId) loadTournamentDetails(tourId);
    else window.location.href = 'dashboard.html';
});

async function loadTournamentDetails(id) {
    const tournament = await db.getTournamentById(id);
    if (!tournament) return;

    // Headings
    document.getElementById('tour-title').innerText = tournament.title;
    document.getElementById('tour-date').innerText = new Date(tournament.date).toLocaleString();
    document.getElementById('tour-prize').innerText = tournament.prize;
    document.getElementById('tour-map').innerText = tournament.map || 'Unknown Sector';

    // Status Badge
    const statusEl = document.getElementById('tour-status');
    if (tournament.status === 'completed') {
        statusEl.innerText = 'MISSION COMPLETE';
        statusEl.style.background = 'var(--color-text-muted)';
        statusEl.style.color = 'black';
    } else if (tournament.trackingState === 'live') {
        statusEl.innerText = 'LIVE COMBAT';
        statusEl.classList.add('live');
    } else {
        statusEl.innerText = 'PREPARING';
    }

    // Content
    const container = document.getElementById('tour-content');

    if (tournament.status === 'completed') {
        renderLeaderboard(container, tournament);
    } else {
        renderLobby(container, tournament);
    }
}

function renderLeaderboard(container, tournament) {
    const results = tournament.results || [];
    results.sort((a, b) => b.kills - a.kills);

    const html = `
        <div class="card">
            <h2 style="color:var(--color-secondary); margin-bottom:20px">MISSION DEBRIEF // RESULTS</h2>
            <table style="width:100%; border-collapse:collapse; color:white;">
                <tr style="color:var(--color-text-muted); border-bottom:1px solid var(--glass-border)">
                    <th style="text-align:left; padding:15px">RANK</th>
                    <th style="text-align:left; padding:15px">OPERATIVE (UID)</th>
                    <th style="text-align:right; padding:15px">CONFIRMED KILLS</th>
                </tr>
                ${results.map((r, i) => `
                    <tr style="border-bottom:1px solid var(--glass-border); background: ${i < 3 ? 'rgba(255,215,0,0.05)' : 'transparent'}">
                        <td style="padding:15px; font-family:var(--font-heading); font-size:1.2rem; color:${i === 0 ? 'gold' : 'white'}">#${i + 1}</td>
                        <td style="padding:15px; color:#ddd">${r.uid}</td>
                        <td style="padding:15px; text-align:right; font-family:var(--font-heading); font-size:1.5rem; color:var(--color-primary)">${r.kills}</td>
                    </tr>
                `).join('')}
            </table>
        </div>
    `;
    container.innerHTML = html;
}

async function renderLobby(container, tournament) {
    const registrations = await db.getRegistrations(tournament.id);
    const user = db.getCurrentUser();
    const isRegistered = registrations.find(r => r.userEmail === user.email);

    // Room Details Section
    let roomSection = '';

    if (tournament.trackingState === 'live' && isRegistered) {
        roomSection = `
            <div class="card" style="border-color:var(--color-primary); box-shadow:var(--neon-glow); margin-bottom:30px; text-align:center">
                <h2 style="color:var(--color-primary)">DEPLOYMENT AUTHORIZED</h2>
                <div class="grid grid-2" style="margin-top:20px; text-align:left">
                    <div>
                        <div style="font-size:0.8rem; color:#aaa">CUSTOM ROOM ID</div>
                        <div style="font-size:3rem; font-family:var(--font-heading); color:white">${tournament.roomId}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem; color:#aaa">PASSWORD</div>
                        <div style="font-size:3rem; font-family:var(--font-heading); color:var(--color-secondary)">${tournament.roomPass}</div>
                    </div>
                </div>
                <p style="margin-top:20px; color:#aaa">Copy these details and join the custom room in Free Fire immediately.</p>
            </div>
        `;
    } else if (tournament.trackingState === 'live' && !isRegistered) {
        roomSection = `<div class="card" style="margin-bottom:30px"><h3 style="color:red">LIVE MATCH IN PROGRESS - ACCESS DENIED (NOT REGISTERED)</h3></div>`;
    } else {
        roomSection = `
            <div class="card" style="margin-bottom:30px; text-align:center; border:1px dashed var(--glass-border)">
                <h3 style="color:var(--color-text-muted)">WAITING FOR DEPLOYMENT ORDERS</h3>
                <p>Room details will be encrypted and transmitted here 5 minutes before start.</p>
            </div>
         `;
    }

    // Player List
    container.innerHTML = `
        ${roomSection}
        <div class="card">
            <h3>ROSTER (${registrations.length})</h3>
            <div class="grid grid-3" style="gap:10px; margin-top:15px">
                ${registrations.map(r => `
                    <div style="padding:10px; background:rgba(255,255,255,0.05); border-left:2px solid ${r.userEmail === user.email ? 'var(--color-primary)' : 'transparent'}">
                        ${r.userIgn}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
