/**
 * payment.js
 * Multi-Gateway Payment System
 * Supports: Razorpay (India), SSLCommerz (Bangladesh), Stripe (Global)
 */

class PaymentSystem {
    constructor() {
        // Gateway configurations (keys should be loaded from server in production)
        this.config = {
            razorpay: {
                keyId: 'rzp_test_xxxxxxxxxx', // Replace with your test/live key
                currency: 'INR',
                name: 'FF Tournament',
                description: 'Wallet Top-up',
                theme: { color: '#ff0f0f' }
            },
            sslcommerz: {
                storeId: 'your_store_id',
                currency: 'BDT',
                successUrl: window.location.origin + '/payment-success.html',
                failUrl: window.location.origin + '/payment-fail.html',
                cancelUrl: window.location.origin + '/wallet.html'
            },
            stripe: {
                publicKey: 'pk_test_xxxxxxxxxx',
                currency: 'USD'
            }
        };

        // Currency conversion rates (should be fetched from API in production)
        this.exchangeRates = {
            INR: 1,
            BDT: 1.4,
            USD: 0.012
        };

        this.currentGateway = 'razorpay'; // Default
    }

    // Detect region and set appropriate gateway
    detectGateway() {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone.includes('Dhaka') || timezone.includes('Bangladesh')) {
            return 'sslcommerz';
        } else if (timezone.includes('Kolkata') || timezone.includes('India')) {
            return 'razorpay';
        }
        return 'razorpay'; // Default to Razorpay
    }

    // Convert amount between currencies
    convertCurrency(amount, from, to) {
        const inINR = amount / this.exchangeRates[from];
        return Math.round(inINR * this.exchangeRates[to]);
    }

    // ================= RAZORPAY (India) =================

    async initiateRazorpay(amount, userEmail, onSuccess, onError) {
        // Load Razorpay script if not loaded
        if (!window.Razorpay) {
            await this.loadScript('https://checkout.razorpay.com/v1/checkout.js');
        }

        const options = {
            key: this.config.razorpay.keyId,
            amount: amount * 100, // Razorpay expects amount in paise
            currency: this.config.razorpay.currency,
            name: this.config.razorpay.name,
            description: this.config.razorpay.description,
            prefill: { email: userEmail },
            theme: this.config.razorpay.theme,
            handler: async (response) => {
                // Payment successful
                try {
                    // In production, verify payment on server
                    await db.addFunds(userEmail, amount, 'razorpay_deposit', {
                        paymentId: response.razorpay_payment_id,
                        gateway: 'razorpay'
                    });
                    await db.logAnalytics('payment_success', { amount, gateway: 'razorpay', email: userEmail });
                    if (onSuccess) onSuccess(response);
                } catch (err) {
                    if (onError) onError(err);
                }
            },
            modal: {
                ondismiss: () => {
                    console.log('Payment cancelled');
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', (response) => {
            db.logAnalytics('payment_failed', { error: response.error, gateway: 'razorpay' });
            if (onError) onError(response.error);
        });
        rzp.open();
    }

    // ================= SSLCOMMERZ (Bangladesh) =================

    async initiateSSLCommerz(amount, userEmail, userName, userPhone) {
        // SSLCommerz requires server-side initiation
        // This creates the form data for redirection

        const tranId = 'FF' + Date.now();

        const formData = {
            store_id: this.config.sslcommerz.storeId,
            store_passwd: 'your_store_password', // Should be on server
            total_amount: amount,
            currency: 'BDT',
            tran_id: tranId,
            success_url: this.config.sslcommerz.successUrl + '?email=' + encodeURIComponent(userEmail) + '&amount=' + amount,
            fail_url: this.config.sslcommerz.failUrl,
            cancel_url: this.config.sslcommerz.cancelUrl,
            cus_name: userName || 'Customer',
            cus_email: userEmail,
            cus_phone: userPhone || '01700000000',
            cus_add1: 'Bangladesh',
            cus_city: 'Dhaka',
            cus_country: 'Bangladesh',
            shipping_method: 'NO',
            product_name: 'Wallet Top-up',
            product_category: 'Digital',
            product_profile: 'non-physical-goods'
        };

        // Store pending transaction
        localStorage.setItem('pending_ssl_payment', JSON.stringify({
            tranId,
            amount,
            email: userEmail
        }));

        // In production, submit to your backend which then calls SSLCommerz API
        // For demo, we'll simulate success
        alert('SSLCommerz integration requires server-side setup. Contact admin for bKash/Nagad payments.');
        return null;
    }

    // ================= STRIPE (Global) =================

    async initiateStripe(amount, userEmail, onSuccess, onError) {
        // Stripe requires server-side payment intent creation
        // This is a client-side placeholder

        if (!window.Stripe) {
            await this.loadScript('https://js.stripe.com/v3/');
        }

        alert('Stripe integration requires server-side setup for international payments.');
        return null;
    }

    // ================= UNIFIED PAYMENT INTERFACE =================

    async pay(amount, gateway = null) {
        const user = db.getCurrentUser();
        if (!user) {
            alert('Please login first');
            return;
        }

        const selectedGateway = gateway || this.detectGateway();

        return new Promise((resolve, reject) => {
            switch (selectedGateway) {
                case 'razorpay':
                    this.initiateRazorpay(amount, user.email, resolve, reject);
                    break;
                case 'sslcommerz':
                    this.initiateSSLCommerz(amount, user.email, user.fullName, user.phone)
                        .then(resolve).catch(reject);
                    break;
                case 'stripe':
                    this.initiateStripe(amount, user.email, resolve, reject);
                    break;
                default:
                    reject(new Error('Unknown gateway'));
            }
        });
    }

    // Demo mode - add funds without real payment (for testing)
    async demoAddFunds(amount) {
        const user = db.getCurrentUser();
        if (!user) {
            alert('Please login first');
            return false;
        }

        try {
            await db.addFunds(user.email, amount, 'demo_deposit', { gateway: 'demo' });
            await db.logAnalytics('demo_payment', { amount, email: user.email });
            return true;
        } catch (err) {
            console.error('Demo payment failed:', err);
            return false;
        }
    }

    // ================= TOURNAMENT ENTRY PAYMENT =================

    async payTournamentEntry(tournamentId, entryFee) {
        const user = db.getCurrentUser();
        if (!user) throw new Error('Please login first');

        const balance = await db.getWalletBalance(user.email);
        if (balance < entryFee) {
            throw new Error(`Insufficient balance. You have ₹${balance}, need ₹${entryFee}`);
        }

        // Deduct entry fee
        await db.deductFunds(user.email, entryFee, 'entry_fee', { tournamentId });
        await db.logAnalytics('tournament_entry_paid', { tournamentId, amount: entryFee, email: user.email });

        return true;
    }

    // ================= PRIZE DISTRIBUTION =================

    async distributePrizes(tournamentId, results, prizeConfig) {
        // prizeConfig: { first: 500, second: 300, third: 100, perKill: 5 }
        const distributions = [];

        for (let i = 0; i < results.length; i++) {
            const player = results[i];
            let prize = 0;

            // Position prize
            if (i === 0) prize += prizeConfig.first || 0;
            else if (i === 1) prize += prizeConfig.second || 0;
            else if (i === 2) prize += prizeConfig.third || 0;

            // Per-kill bonus
            prize += (player.kills || 0) * (prizeConfig.perKill || 0);

            if (prize > 0) {
                // Find player email from registrations
                const registrations = await db.getRegistrations(tournamentId);
                const reg = registrations.find(r => r.userUid === player.uid);
                if (reg) {
                    await db.addFunds(reg.userEmail, prize, 'prize', {
                        tournamentId,
                        position: i + 1,
                        kills: player.kills
                    });
                    distributions.push({ email: reg.userEmail, prize, position: i + 1, kills: player.kills });
                }
            }
        }

        await db.logAnalytics('prizes_distributed', { tournamentId, totalDistributed: distributions.reduce((sum, d) => sum + d.prize, 0) });
        return distributions;
    }

    // ================= HELPERS =================

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    formatCurrency(amount, currency = 'INR') {
        const symbols = { INR: '₹', BDT: '৳', USD: '$' };
        return `${symbols[currency] || ''}${amount}`;
    }
}

const paymentSystem = new PaymentSystem();
