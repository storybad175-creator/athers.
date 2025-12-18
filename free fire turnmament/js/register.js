/**
 * register.js
 * Smart Registration Logic with Auto-Fill
 */

async function handleUidBlur() {
    const uidInput = document.getElementById('uid');
    const uid = uidInput.value;
    const btn = document.getElementById('fetch-btn');
    const fetchStatus = document.getElementById('fetch-status');

    if (!uid || uid.length < 8) return;

    // UI Feedback
    btn.innerHTML = 'SCANNING...';
    btn.disabled = true;
    fetchStatus.innerHTML = '<span style="color:var(--color-secondary)">CONNECTING TO GARENA...</span>';

    try {
        const profile = await ffApi.fetchUserProfile(uid);

        if (profile) {
            // Auto-Fill
            document.getElementById('ign').value = profile.AccountName || '';
            document.getElementById('level').value = profile.AccountLevel || '';
            document.getElementById('region').value = profile.AccountRegion || 'IND';

            // Lock fields again if they were unlocked
            document.getElementById('ign').readOnly = true;
            document.getElementById('level').readOnly = true;
            document.getElementById('region').readOnly = true;

            // Visual Confirm
            fetchStatus.innerHTML = `<span style="color:#00ff00">IDENTITY VERIFIED: ${profile.AccountName} (LVL ${profile.AccountLevel})</span>`;
            uidInput.style.borderColor = '#00ff00';
        } else {
            // Fallback: Unlock fields for manual entry
            document.getElementById('ign').readOnly = false;
            document.getElementById('level').readOnly = false;
            document.getElementById('region').readOnly = false;
            document.getElementById('ign').focus(); // Focus on name field

            fetchStatus.innerHTML = '<span style="color:red">AUTO-FETCH FAILED. PLEASE ENTER DETAILS MANUALLY.</span>';
            uidInput.style.borderColor = '#ffa500'; // Orange warning
        }

    } catch (e) {
        console.error(e);
        fetchStatus.innerHTML = '<span style="color:red">CONNECTION ERROR</span>';
    } finally {
        btn.innerHTML = 'CHECK UID';
        btn.disabled = false;
    }
}



let generatedOTP = null;
let isEmailVerified = false;

function sendVerificationEmail() {
    const email = document.getElementById('email').value;
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address first.');
        return;
    }

    const btn = document.getElementById('verify-btn');
    btn.disabled = true;
    btn.textContent = 'SENDING...';

    // SIMULATION: In production, call backend api to send real email
    setTimeout(() => {
        generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        // For demo purposes, we show it in alert. In real app, it goes to email only.
        alert(`[SIMULATION] Email sent to ${email}.\n\nYOUR PIN CODE: ${generatedOTP}`);

        document.getElementById('otp-section').style.display = 'block';
        btn.textContent = 'RESEND';
        btn.disabled = false;
        document.getElementById('email').readOnly = true; // Lock email
    }, 1500);
}

async function handleRegister(event) {
    event.preventDefault();

    if (!generatedOTP) {
        alert('Please verify your email address first.');
        return;
    }

    const enteredOTP = document.getElementById('otp-code').value;
    if (enteredOTP !== generatedOTP) {
        alert('Invalid PIN Code. Please check your email.');
        return;
    }

    const btn = event.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'AUTHORIZING...';
    btn.disabled = true;

    try {
        const formData = {
            fullName: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            uid: document.getElementById('uid').value,
            ign: document.getElementById('ign').value,
            level: document.getElementById('level').value,
            region: document.getElementById('region').value,
            password: document.getElementById('password').value,
            role: 'user'
        };

        if (formData.email === 'aburafay132@gmail.com') formData.role = 'admin';

        await db.saveUser(formData);

        // SYNC TO GOOGLE SHEETS
        try {
            await fetch('http://localhost:5000/api/save_user_to_sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } catch (sheetErr) {
            console.warn('Google Sheet Sync Failed:', sheetErr);
        }

        // Auto Login Mock or Real
        try {
            if (window.isFirebaseActive) await firebase.auth().signInWithEmailAndPassword(formData.email, formData.password);
            else await db.login(formData.email, formData.password);
        } catch (e) { /* Ignore auto-login fail, redirect anyway if registered */ }

        window.location.href = 'dashboard.html';

    } catch (err) {
        alert(err.message);
        btn.innerHTML = 'AUTHORIZE REGISTRATION';
        btn.disabled = false;
    }
}
