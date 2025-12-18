/**
 * database.js
 * Hybrid Database: Supports LocalStorage (Demo) & Firestore (Production)
 */

const DB_KEYS = {
    USERS: 'ff_users',
    TOURNAMENTS: 'ff_tournaments',
    REGISTRATIONS: 'ff_registrations',
    SESSION: 'ff_session'
};

const API_URL = 'http://localhost:5000/api/db';

class Database {
    constructor() { }

    async _fetch(endpoint, options = {}) {
        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            if (!res.ok) {
                // Try to parse error
                let errorMsg = res.statusText;
                try {
                    const json = await res.json();
                    errorMsg = json.error || errorMsg;
                } catch (e) { }
                throw new Error(errorMsg);
            }
            return await res.json();
        } catch (err) {
            console.error(`API Error (${endpoint}):`, err);
            throw err;
        }
    }

    // --- User Management ---

    async saveUser(user) {
        // Check if exists handled by backend or separate check?
        // Backend handles update/insert
        const res = await this._fetch('/users', {
            method: 'POST',
            body: JSON.stringify(user)
        });
        return res.user;
    }

    async getUserByEmail(email) {
        try {
            return await this._fetch(`/users?email=${email}`);
        } catch (e) {
            if (e.message === 'Not Found' || e.message.includes('404')) return null;
            return null;
        }
    }

    async login(email, password) {
        const user = await this.getUserByEmail(email);
        if (!user) throw new Error('User not found');
        if (user.password !== password) throw new Error('Invalid Password');
        this.setCurrentUser(user);
        return user;
    }

    // Session Management (Still LocalStorage for now)
    getCurrentUser() {
        return JSON.parse(localStorage.getItem('ff_session'));
    }

    setCurrentUser(user) {
        localStorage.setItem('ff_session', JSON.stringify(user));
    }

    async logout() {
        localStorage.removeItem('ff_session');
    }

    async getAllUsers() {
        return await this._fetch('/users');
    }

    // --- Tournament Management ---

    async createTournament(tournament) {
        const newTour = {
            ...tournament,
            id: Date.now().toString(),
            status: tournament.status || 'upcoming',
            trackingState: tournament.trackingState || 'idle',
            createdAt: new Date().toISOString()
        };
        const res = await this._fetch('/tournaments', {
            method: 'POST',
            body: JSON.stringify(newTour)
        });
        return res.tournament;
    }

    async getTournaments() {
        // API returns list
        const list = await this._fetch('/tournaments');
        // Sort DESC
        return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async getTournamentById(id) {
        try {
            return await this._fetch(`/tournaments?id=${id}`);
        } catch { return null; }
    }

    async updateTournament(id, updates) {
        // Fetch current first to merge? Or backend handles merge?
        // Our backend implementation replaces item if ID matches. 
        // So we should fetch, merge, save.
        const current = await this.getTournamentById(id);
        if (!current) throw new Error('Tournament not found');

        const updated = { ...current, ...updates };
        await this._fetch('/tournaments', {
            method: 'POST',
            body: JSON.stringify(updated)
        });
    }

    async deleteTournament(id) {
        await this._fetch(`/tournaments?id=${id}`, { method: 'DELETE' });
    }

    // --- Registration Management ---

    async joinTournament(tournamentId, user, paymentDetails = {}) {
        const registration = {
            id: Date.now().toString(),
            tournamentId,
            userEmail: user.email,
            userUid: user.uid,
            userIgn: user.ign,
            userPhone: user.phone,
            userBkash: paymentDetails.bkash || '',
            timestamp: new Date().toISOString()
        };
        await this._fetch('/registrations', {
            method: 'POST',
            body: JSON.stringify(registration)
        });
    }

    async getRegistrations(tournamentId) {
        return await this._fetch(`/registrations?tournamentId=${tournamentId}`);
    }

    // ================= CUSTOM ROOM & MATCH RESULTS =================

    async updateRoomDetails(tournamentId, roomId, password) {
        await this.updateTournament(tournamentId, {
            roomId: roomId,
            roomPass: password,
            trackingState: 'live'
        });
    }

    async submitMatchResult(tournamentId, user, screenshotData) {
        const result = {
            id: Date.now().toString(),
            tournamentId,
            userEmail: user.email,
            userIgn: user.ign,
            screenshot: screenshotData,
            status: 'pending',
            kills: 0,
            rank: 0,
            submittedAt: new Date().toISOString()
        };
        await this._fetch('/results', {
            method: 'POST',
            body: JSON.stringify(result)
        });
    }

    async getMatchResults(tournamentId) {
        return await this._fetch(`/results?tournamentId=${tournamentId}`);
    }

    async verifyMatchResult(resultId, kills, rank, isReject = false) {
        // Specific API PUT Logic
        const updateData = isReject ?
            { id: resultId, status: 'rejected' } :
            { id: resultId, status: 'verified', kills: parseInt(kills), rank: parseInt(rank) };

        await this._fetch('/results', { method: 'PUT', body: JSON.stringify(updateData) });
    }

    async distributePrizes(tournamentId) {
        const tournament = await this.getTournamentById(tournamentId);
        if (tournament.status === 'completed') throw new Error("Already completed");

        const results = await this.getMatchResults(tournamentId);
        const verified = results.filter(r => r.status === 'verified');

        const log = [];
        for (const player of verified) {
            let winnings = 0;
            const killPoints = player.kills * (tournament.perKillBonus || 0);
            let rankPoints = 0;
            if (player.rank === 1) rankPoints = tournament.prizeFirst || 0;
            else if (player.rank === 2) rankPoints = tournament.prizeSecond || 0;
            else if (player.rank === 3) rankPoints = tournament.prizeThird || 0;

            winnings = killPoints + rankPoints;
            if (winnings > 0) {
                await this.addFunds(player.userEmail, winnings, 'prize', {
                    tournamentId,
                    kills: player.kills,
                    rank: player.rank
                });
                log.push(`${player.userIgn}: ₹${winnings}`);
            }
        }

        await this.updateTournament(tournamentId, { status: 'completed' });
        return log;
    }

    // ================= WALLET MANAGEMENT =================

    async getWalletBalance(email) {
        const res = await this._fetch(`/wallet/${email}`);
        return res.balance || 0;
    }

    async getAdCoinBalance(email) {
        const res = await this._fetch(`/wallet/${email}`);
        return res.adCoinBalance || 0;
    }

    async addFunds(email, amount, source = 'deposit', metadata = {}, currency = 'money') {
        await this._fetch('/wallet/transaction', {
            method: 'POST',
            body: JSON.stringify({
                email,
                amount,
                type: 'credit',
                source,
                metadata,
                currency,
                timestamp: new Date().toISOString()
            })
        });
    }

    async deductFunds(email, amount, reason = 'entry_fee', metadata = {}, currency = 'money') {
        await this._fetch('/wallet/transaction', {
            method: 'POST',
            body: JSON.stringify({
                email,
                amount,
                type: 'debit',
                reason,
                metadata,
                currency,
                timestamp: new Date().toISOString()
            })
        });
    }

    async watchAd(email) {
        // 1 Ad = 1 AdCoin (Simulated)
        await this.addFunds(email, 1, 'ad_watch', {}, 'adcoin');
    }

    async getTransactionHistory(email) {
        const res = await this._fetch(`/wallet/${email}`);
        return (res.transactions || []).reverse();
    }

    // ================= WITHDRAWAL REQUESTS =================

    async requestWithdrawal(email, amount, paymentMethod, paymentDetails) {
        await this.deductFunds(email, amount, 'withdrawal_hold');

        const withdrawal = {
            id: Date.now().toString(),
            email,
            amount: parseFloat(amount),
            paymentMethod,
            paymentDetails,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        await this._fetch('/withdrawals', { method: 'POST', body: JSON.stringify(withdrawal) });
        return withdrawal;
    }

    async getWithdrawals(status = null) {
        let url = '/withdrawals';
        if (status) url += `?status=${status}`;
        const list = await this._fetch(url);
        return list.reverse();
    }

    async approveWithdrawal(id) {
        await this._fetch('/withdrawals', {
            method: 'PUT',
            body: JSON.stringify({ id, status: 'approved', approvedAt: new Date().toISOString() })
        });
    }

    async rejectWithdrawal(id, reason) {
        // Get details to refund
        // Optimistic approach: backend doesn't handle refund automatically yet in this simple implementation
        // So we fetch, then refund.
        const list = await this.getWithdrawals();
        const w = list.find(x => x.id === id);
        if (w) {
            await this.addFunds(w.email, w.amount, 'refund', { reason });
        }

        await this._fetch('/withdrawals', {
            method: 'PUT',
            body: JSON.stringify({ id, status: 'rejected', reason })
        });
    }

    // ================= REFERRAL SYSTEM =================

    async generateReferralCode(email) {
        // Check if exists
        const existing = await this._fetch(`/referrals?email=${email}`);
        if (existing) return existing.code;

        const code = 'FF' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await this._fetch('/referrals', {
            method: 'POST',
            body: JSON.stringify({
                email,
                data: { code, referredUsers: [], earnings: 0 }
            })
        });
        return code;
    }

    async getReferralCode(email) {
        const res = await this._fetch(`/referrals?email=${email}`);
        return res ? res.code : null;
    }

    async applyReferralCode(newUserEmail, referralCode) {
        const res = await this._fetch(`/referrals?code=${referralCode}`);
        if (!res || !res.email) throw new Error('Invalid Code');

        const referrerEmail = res.email;
        const bonus = 10; // Default

        await this.addFunds(referrerEmail, bonus, 'referral');
        await this.addFunds(newUserEmail, bonus, 'referral_signup');

        // Update referrer list
        // Complex object update not fully supported in simple PUT /referrals
        // We will just add funds for now. Tracking list needs more robust backend.
        return true;
    }

    // ================= SETTINGS & ANALYTICS =================

    async getSettings() {
        return await this._fetch('/settings');
    }

    async updateSettings(updates) {
        // Merge with existing
        const current = await this.getSettings();
        await this._fetch('/settings', { method: 'POST', body: JSON.stringify({ ...current, ...updates }) });
    }

    async logAnalytics(event, data) {
        await this._fetch('/analytics', {
            method: 'POST',
            body: JSON.stringify({ event, data, timestamp: new Date().toISOString() })
        });
    }
}

const db = new Database();
