/**
 * auth.js
 * Hybrid Authentication Logic
 */

const ADMIN_EMAIL = "aburafay132@gmail.com";
const ADMIN_PASS = "35633563"; // Only used for Local/Simulated Auth

// Global Auth State Observer for Firebase
document.addEventListener('DOMContentLoaded', () => {
    // ALWAYS check local session first (for admin and local users)
    const localUser = db.getCurrentUser();

    if (localUser) {
        // User is logged in locally - respect that
        console.log('Local session found:', localUser.email);
        redirectIfAuth(localUser);
        return; // Don't run Firebase observer
    }

    // No local session - check Firebase
    if (window.isFirebaseActive) {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                // Determine role from DB or Hardcoded
                let role = 'user';
                if (user.email === ADMIN_EMAIL) role = 'admin';

                // Get extended details from DB (ign, uid)
                const dbUser = await db.getUserByEmail(user.email);

                const sessionUser = {
                    email: user.email,
                    role: role,
                    uid: dbUser ? dbUser.uid : 'UNKNOWN',
                    ign: dbUser ? dbUser.ign : user.displayName,
                    fullName: user.displayName || dbUser?.fullName,
                    phone: dbUser?.phone
                };

                db.setCurrentUser(sessionUser);
                redirectIfAuth(sessionUser);
            } else {
                // No Firebase user AND no local user - redirect if on protected page
                const path = window.location.pathname;
                if (!path.includes('index.html') && !path.includes('register.html') && !path.endsWith('/')) {
                    window.location.href = 'index.html';
                }
            }
        });
    } else {
        // Firebase not active - use local auth guard
        checkAuthGuard();
    }
});

function checkAuthGuard() {
    const user = db.getCurrentUser();
    const path = window.location.pathname;

    if (!user && !path.includes('index.html') && !path.includes('register.html')) {
        window.location.href = 'index.html';
    }
    else if (user && (path.includes('index.html') || path.includes('register.html'))) {
        redirectIfAuth(user);
    }
}

function redirectIfAuth(user) {
    const path = window.location.pathname;
    if (path.includes('index.html') || path.includes('register.html')) {
        window.location.href = 'dashboard.html';
    }
}

// REGISTER (Hybrid)
async function handleRegister(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'PROCESSING...';
    btn.disabled = true;

    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const uid = document.getElementById('uid').value;
    const ign = document.getElementById('ign').value;
    const password = document.getElementById('password').value;

    try {
        if (window.isFirebaseActive) {
            // 1. Create Auth User
            const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
            // 2. Save Profile to Firestore
            await db.saveUser({
                email, fullName, phone, uid, ign,
                role: email === ADMIN_EMAIL ? 'admin' : 'user'
            });
            // Auth observer handles redirect
            alert('Registration Successful');
        } else {
            // Local Simulation
            const formData = { fullName, email, phone, uid, ign, password, role: 'user' };
            if (email === ADMIN_EMAIL) formData.role = 'admin';
            await db.saveUser(formData);
            await db.login(email, password); // Simulates session set
            window.location.href = 'dashboard.html';
        }
    } catch (err) {
        alert(err.message);
        btn.innerHTML = 'AUTHORIZE';
        btn.disabled = false;
    }
}

// LOGIN (Hybrid)
async function handleLogin(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]');
    btn.innerText = 'AUTHENTICATING...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        if (window.isFirebaseActive) {
            try {
                await firebase.auth().signInWithEmailAndPassword(email, password);
                return;
            } catch (firebaseErr) {
                console.log('Firebase auth failed, trying local:', firebaseErr.message);
            }
        }

        // Local Auth using API
        const user = await db.login(email, password);
        window.location.href = 'dashboard.html';

    } catch (err) {
        alert("ACCESS DENIED: " + err.message);
        btn.innerText = 'ESTABLISH UPLINK';
    }
}

// GOOGLE LOGIN (Firebase Only)
async function handleGoogleLogin() {
    if (!window.isFirebaseActive) {
        alert('Google Login requires Firebase Configuration. Please refer to firebase_setup_guide.md');
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        // Check if profile exists, if not, might need to prompt for UID/IGN
        const existing = await db.getUserByEmail(user.email);
        if (!existing) {
            const ign = prompt("First Time Login: Enter your Free Fire IGN:");
            const uid = prompt("Enter your Free Fire UID:");
            if (ign && uid) {
                await db.saveUser({
                    email: user.email,
                    fullName: user.displayName,
                    ign, uid,
                    phone: '',
                    role: 'user'
                });
            }
        }
    } catch (error) {
        alert(error.message);
    }
}

async function handleLogout() {
    await db.logout(); // Wait for promise
    window.location.href = 'index.html'; // Force redirect
}
