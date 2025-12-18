/**
 * api.js
 * Free Fire API with CORS Proxy Support
 * 
 * ✅ Uses CORS proxies to bypass browser restrictions
 * ✅ Multiple fallback backends
 * ✅ Multi-region support
 */

class FreeFireAPI {

    constructor() {
        this.regions = ['IND', 'SG', 'PK', 'BD', 'BR', 'ID', 'TW', 'VN', 'TH', 'ME'];
        // CORS proxies to try (some may be rate-limited)
        this.corsProxies = [
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url=',
        ];
    }

    /**
     * Fetch with CORS proxy fallback
     */
    async fetchWithProxy(url, timeoutMs = 20000) {
        // First try direct (in case CORS is enabled)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) return res;
        } catch (e) {
            console.log("[Direct] Failed, trying proxies...");
        }

        // Try each CORS proxy
        for (const proxy of this.corsProxies) {
            try {
                const proxyUrl = proxy + encodeURIComponent(url);
                console.log(`[Proxy] Trying: ${proxy.split('?')[0]}...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const res = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) return res;
            } catch (e) {
                console.log(`[Proxy] ${proxy.split('?')[0]} failed:`, e.message);
            }
        }

        throw new Error("All fetch attempts failed");
    }

    /**
     * Fetch player profile - tries multiple backends with CORS proxy
     */
    async fetchUserProfile(uid) {
        console.log("🎮 Fetching profile for UID:", uid);

        // Try TSun backend
        try {
            console.log("[TSun] Attempting via proxy...");
            const url = `https://fffinfo.tsunstudio.pw/get?uid=${uid}`;

            const res = await this.fetchWithProxy(url, 25000);
            const data = await res.json();

            if (data?.AccountInfo?.AccountName) {
                console.log(`[TSun] ✅ Found: ${data.AccountInfo.AccountName}`);
                return {
                    AccountName: data.AccountInfo.AccountName,
                    AccountLevel: data.AccountInfo.AccountLevel || '?',
                    AccountRegion: data.AccountInfo.AccountRegion || 'Unknown'
                };
            }
        } catch (err) {
            console.warn("[TSun] ❌ Failed:", err.message);
        }

        // Try Vercel API across multiple regions
        for (const region of this.regions) {
            try {
                console.log(`[Vercel/${region}] Attempting...`);
                const url = `https://freefire-api-six.vercel.app/get_player_personal_show?server=${region}&uid=${uid}`;

                const res = await this.fetchWithProxy(url, 15000);
                const data = await res.json();

                // Check basicinfo format
                if (data?.basicinfo?.nickname) {
                    console.log(`[Vercel/${region}] ✅ Found: ${data.basicinfo.nickname}`);
                    return {
                        AccountName: data.basicinfo.nickname,
                        AccountLevel: data.basicinfo.level || '?',
                        AccountRegion: data.basicinfo.region || region
                    };
                }

                // Check AccountInfo format
                if (data?.AccountInfo?.AccountName) {
                    console.log(`[Vercel/${region}] ✅ Found: ${data.AccountInfo.AccountName}`);
                    return {
                        AccountName: data.AccountInfo.AccountName,
                        AccountLevel: data.AccountInfo.AccountLevel || '?',
                        AccountRegion: data.AccountInfo.AccountRegion || region
                    };
                }
            } catch (err) {
                console.warn(`[Vercel/${region}] ❌ Failed:`, err.message);
            }
        }

        console.error("❌ All backends failed for UID:", uid);
        return null;
    }

    /**
     * Fetch player stats
     */
    async fetchPlayerStats(uid, region = 'IND') {
        try {
            const url = `https://fffinfo.tsunstudio.pw/get?uid=${uid}`;
            const res = await this.fetchWithProxy(url);
            const data = await res.json();
            const profile = data?.AccountProfileInfo;

            if (profile) {
                return {
                    brRank: profile.BrMaxRank,
                    csRank: profile.CsMaxRank,
                    brPoints: profile.BrRankPoint,
                    csPoints: profile.CsRankPoint
                };
            }
            return null;
        } catch (err) {
            console.error("Stats fetch failed:", err);
            return null;
        }
    }

    async fetchBatchStats(uids) {
        const snapshot = {};
        for (const uid of uids) {
            try {
                const stats = await this.fetchPlayerStats(uid);
                snapshot[uid] = stats?.brPoints || 0;
            } catch {
                snapshot[uid] = 0;
            }
        }
        return snapshot;
    }

    async mockSnapshot(uids, isEnd = false) {
        const snapshot = {};
        await new Promise(r => setTimeout(r, 800));
        uids.forEach(uid => {
            let baseKills = parseInt(localStorage.getItem(`mock_base_${uid}`)) || 1000;
            if (isEnd) {
                const newKills = Math.floor(Math.random() * 5);
                snapshot[uid] = baseKills + newKills;
                localStorage.removeItem(`mock_base_${uid}`);
            } else {
                localStorage.setItem(`mock_base_${uid}`, baseKills);
                snapshot[uid] = baseKills;
            }
        });
        return snapshot;
    }
}

const ffApi = new FreeFireAPI();
