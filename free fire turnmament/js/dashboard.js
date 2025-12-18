/**
 * dashboard.js
 * Premium Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Premium Intro Animation could go here
    loadUserStats();
    loadDashboardTournaments();
});

function loadUserStats() {
    const user = db.getCurrentUser();
    if (user) {
        document.getElementById('user-welcome').innerHTML = `WELCOME BACK, <span style="color:var(--color-primary)">${user.ign}</span>`;
        // Mock stats for display
        document.getElementById('stat-kd').innerText = "3.42";
        document.getElementById('stat-matches').innerText = "12";
    }
}

async function loadDashboardTournaments() {
    const container = document.getElementById('tour-grid');
    const tournaments = await db.getTournaments();
    const user = db.getCurrentUser();
    const myRegs = JSON.parse(localStorage.getItem('ff_registrations') || '[]').filter(r => r.userEmail === user.email);

    if (tournaments.length === 0) {
        container.innerHTML = `
            <div class="card" style="grid-column: 1/-1; text-align:center; padding:50px">
                <h2 style="color:var(--color-text-muted)">NO SIGNAL DETECTED</h2>
                <p>No active tournament protocols found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tournaments.map(t => {
        const isJoined = myRegs.find(r => r.tournamentId === t.id);

        let statusBadge = '';
        if (t.status === 'completed') statusBadge = '<span class="badge">COMPLETED</span>';
        else if (t.trackingState === 'live') statusBadge = '<span class="badge live">LIVE COMBAT</span>';
        else statusBadge = '<span class="badge upcoming">UPCOMING</span>';

        let actionBtn = '';
        if (t.status === 'completed') {
            actionButtons = `<a href="tournament.html?id=${t.id}" class="btn" style="width:100%; display:block; text-align:center">VIEW INTEL</a>`;
        } else if (isJoined) {
            actionButtons = `<a href="tournament.html?id=${t.id}" class="btn btn-primary" style="width:100%; display:block; text-align:center; box-shadow:none; border:1px solid var(--color-primary);">ENTER LOBBY</a>`;
        } else {
            actionButtons = `<button onclick="joinTournament('${t.id}')" class="btn" style="width:100%">REGISTER</button>`;
        }

        return `
            <div class="card">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px">
                    ${statusBadge}
                    <div style="color:var(--color-secondary); font-weight:bold">${t.prize}</div>
                </div>
                
                <h3 style="margin-bottom:5px">${t.title}</h3>
                <div style="font-size:0.8rem; color:var(--color-text-muted); margin-bottom:15px">
                    ${new Date(t.date).toLocaleString()}
                </div>

                <div class="grid grid-3" style="gap:5px; margin-bottom:20px;">
                    <div class="badge text-center">${t.map || 'Any'}</div>
                    <div class="badge text-center">${t.mode || 'Solo'}</div>
                    <div class="badge text-center">${t.teamSize || '48'} Slots</div>
                </div>

                ${actionButtons}
            </div>
        `;
    }).join('');
}

async function joinTournament(id) {
    const user = db.getCurrentUser();
    if (confirm(`Confirm registration for ${user.ign}?`)) {
        await db.joinTournament(id, user);
        loadDashboardTournaments();
    }
}
