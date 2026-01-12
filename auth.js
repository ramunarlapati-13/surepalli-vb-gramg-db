
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAPSwKBoQzQc0f4N1VtOs56dB_0haxtOkQ",
    authDomain: "nrega-media.firebaseapp.com",
    projectId: "nrega-media",
    storageBucket: "nrega-media.firebasestorage.app",
    messagingSenderId: "550522109679",
    appId: "1:550522109679:web:ac8d8bb132ae6937cd651a",
    measurementId: "G-S3WXVLSWN2",
    databaseURL: "https://nrega-media-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// DOM Elements
const authForm = document.getElementById('auth-form');
const googleBtn = document.getElementById('google-login');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMsg = document.getElementById('error-msg');
const submitBtn = document.getElementById('submit-btn');

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
    if (user && (sessionStorage.getItem('googleAccessToken') || user.providerData[0].providerId === 'password')) {
        window.location.href = 'index.html';
    }
});

// Email/Password Auth
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.innerText = '';
    const email = emailInput.value;
    const password = passwordInput.value;
    const isLogin = document.getElementById('tab-login').classList.contains('active');

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        console.error(error);
        errorMsg.innerText = formatError(error.code);
    }
});

// Google Auth
googleBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential.accessToken;
        // Store token for Drive API calls
        sessionStorage.setItem('googleAccessToken', token);
        window.location.href = 'index.html';
    } catch (error) {
        console.error(error);
        errorMsg.innerText = formatError(error.code);
    }
});

function formatError(code) {
    switch (code) {
        case 'auth/user-not-found': return 'User not found.';
        case 'auth/wrong-password': return 'Incorrect password.';
        case 'auth/email-already-in-use': return 'Email already registered.';
        case 'auth/weak-password': return 'Password should be at least 6 characters.';
        case 'auth/invalid-email': return 'Invalid email address.';
        case 'auth/popup-closed-by-user': return 'Login popup closed.';
        default: return 'An error occurred. Please try again.';
    }
}
