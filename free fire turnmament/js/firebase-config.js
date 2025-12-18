/**
 * firebase-config.js
 * LIVE CONFIGURATION LINKED TO: freefire-tournament-saas
 */

const firebaseConfig = {
    apiKey: "AIzaSyDE0dae4ojUdZN7brM0rx8fE-jacHUljMY",
    authDomain: "freefire-tournament-saas.firebaseapp.com",
    projectId: "freefire-tournament-saas",
    storageBucket: "freefire-tournament-saas.firebasestorage.app",
    messagingSenderId: "152570834804",
    appId: "1:152570834804:web:6b5f4bcdc0f8e3f9e70621",
    measurementId: "G-JCHDWL3PY1"
};

// State to track if Firebase is actually active
window.isFirebaseActive = false;

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof firebase !== 'undefined') {
            // Check if already initialized to avoid "Duplicate App" error
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                // Analytics is optional for core logic, but we can init it if loaded
                if (firebase.analytics) firebase.analytics();
            }
            window.isFirebaseActive = true;
            console.log("🔥 FIREBASE ONLINE: Connected to freefire-tournament-saas");
        } else {
            console.warn("Firebase SDK not found. Running in Offline Mode.");
        }
    } catch (e) {
        console.error("Firebase Init Error:", e);
    }
});
