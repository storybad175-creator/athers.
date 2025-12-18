/**
 * admin.js
 * Premium Admin Panel Logic with Snapshot System
 */

document.addEventListener('DOMContentLoaded', () => {
    loadTournaments();
    loadUsers();
});

// --- Tournament Management ---

async function handleCreateTournament(event) {
    event.preventDefault();
    const title = document.getElementById('tour-title').value;
    const date = document.getElementById('tour-date').value;
    const time = document.getElementById('tour-time').value;
    const prize = document.getElementById('tour-prize').value;

    // New Fields
    const map = document.getElementById('tour-map').value;
    const mode = document.getElementById('tour-mode').value;
    const teamSize = document.getElementById('tour-team').value;

    await db.createTournament({
        title,
        date: `${date}T${time}`,
        prize,
        map,
        mode,
        teamSize,
        status: 'upcoming',
        trackingState: 'idle' // idle -> live -> completed
    });

    alert('Tournament Protocol Initiated');
    loadTournaments();
    event.target.reset();
}

async function loadTournaments() {
    const list = document.getElementById('admin-tour-list');
    const tournaments = await db.getTournaments();

    if (tournaments.length === 0) {
        list.innerHTML = '<div class="card"><p class="text-center" style="color:var(--text-gray)">No Active Protocols.</p></div>';
        return;
    }

    list.innerHTML = tournaments.map(t => {
        let actionButtons = '';

        if (t.status === 'completed') {
            actionButtons = `<span class="badge">COMPLETED</span>`;
        } else if (t.trackingState === 'live') {
            actionButtons = `
                <button onclick="finalizeMatch('${t.id}')" class="btn btn-primary" style="font-size: 0.8rem;">FINALIZE MATCH</button>
                <span class="badge live" style="margin-left:10px">LIVE TRACKING</span>
            `;
        } else {
            actionButtons = `
                <button onclick="openRoomModal('${t.id}')" class="btn" style="font-size: 0.8rem;">START MATCH</button>
            `;
        }

        return `
            <div class="card" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h3 style="color: var(--color-primary); margin-bottom: 5px;">${t.title}</h3>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <span class="badge">${t.map}</span>
                            <span class="badge">${t.mode}</span>
                            <span class="badge">${t.teamSize}</span>
                        </div>
                        <p style="color: var(--color-text-muted); font-size: 0.9rem;">
                            ${new Date(t.date).toLocaleString()} | Prize: ${t.prize}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        ${actionButtons}
                        <div style="margin-top: 10px;">
                            <button onclick="deleteTournament('${t.id}')" class="btn" style="font-size: 0.7rem; border: none; color: #555;">DELETE</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- Live Match Management (Snapshot System) ---

let currentActiveTourId = null;

function openRoomModal(id) {
    currentActiveTourId = id;
    document.getElementById('room-modal').classList.add('active');
}

function closeRoomModal() {
    document.getElementById('room-modal').classList.remove('active');
}

async function startMatchTracking() {
    const roomId = document.getElementById('room-id').value;
    const roomPass = document.getElementById('room-pass').value;

    if (!roomId || !roomPass) {
        alert('Room ID and Password required to notify players.');
        return;
    }

    const btn = document.querySelector('#room-modal .btn-primary');
    btn.innerHTML = 'TAKING SNAPSHOT...';
    btn.disabled = true;

    try {
        // 1. Get all players
        const registrations = await db.getRegistrations(currentActiveTourId);
        const uids = registrations.map(r => r.userUid);

        // 2. Fetch API Snapshot (Current Totals)
        // const snapshot = await ffApi.fetchBatchStats(uids); // Real API
        const snapshot = await ffApi.mockSnapshot(uids); // Use Mock for Demo stability until Key valid

        // 3. Update Tournament
        await db.updateTournament(currentActiveTourId, {
            trackingState: 'live',
            roomId,
            roomPass, // Players will see this in their dashboard now
            snapshotStart: snapshot
        });

        alert('Match Started! Snapshot Taken. Players notified of Room ID.');
        closeRoomModal();
        loadTournaments();

    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.innerHTML = 'INITIATE LIVE TRACKING';
        btn.disabled = false;
    }
}

async function finalizeMatch(id) {
    if (!confirm('Are you sure the match is over? This will calculate final scores.')) return;

    try {
        const tournament = await db.getTournamentById(id);
        const registrations = await db.getRegistrations(id);
        const uids = registrations.map(r => r.userUid);

        // 1. Fetch End Snapshot
        // const endSnapshot = await ffApi.fetchBatchStats(uids);
        const endSnapshot = await ffApi.mockSnapshot(uids, true); // Mock Increment

        // 2. Calculate Difference
        const startSnapshot = tournament.snapshotStart || {};
        const results = uids.map(uid => {
            const startKills = startSnapshot[uid] || 0;
            const endKills = endSnapshot[uid] || 0;
            const matchKills = Math.max(0, endKills - startKills); // Avoid negatives

            return {
                uid: uid,
                kills: matchKills
                // Note: Rank is harder to get via this aggregate API method automatically
                // Usually admins manually input top 3 ranks, or we just rely on kills
            };
        });

        // 3. Save
        await db.updateTournament(id, {
            status: 'completed',
            trackingState: 'completed',
            results: results
        });

        alert('Match Finalized! Leaderboard Updated.');
        loadTournaments();

    } catch (err) {
        alert('Error finalizing: ' + err.message);
    }
}

async function deleteTournament(id) {
    if (confirm('Delete Protocol?')) {
        await db.deleteTournament(id);
        loadTournaments();
    }
}

// --- Data ---
async function loadUsers() {
    const list = document.getElementById('user-list');
    const users = db.getAllUsers();
    // ... same logic as before but maybe different styling ...
    list.innerHTML = users.map(u => `<div style='padding:10px; border-bottom:1px solid #333'>${u.fullName} (${u.uid})</div>`).join('');
}
