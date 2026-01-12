
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

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
const db = getDatabase(app);
const auth = getAuth(app);

const jsonDisplay = document.getElementById('json-display');
const formattedDisplay = document.getElementById('formatted-display');

// Check authentication first
onAuthStateChanged(auth, (user) => {
    if (user) {
        startListening();
    } else {
        formattedDisplay.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-lock" style="font-size: 32px; margin-bottom: 20px;"></i>
                <p>Authentication Required</p>
                <a href="login.html" class="primary-btn" style="margin-top: 20px; text-decoration: none;">Login as Admin</a>
            </div>
        `;
    }
});

function startListening() {
    const dbRef = ref(db, '/');
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        renderRawJson(data);
        renderFormattedData(data);
    }, (error) => {
        console.error(error);
        formattedDisplay.innerHTML = `<p style="color: #ef4444;">Error syncing: ${error.message}</p>`;
    });
}

function renderRawJson(data) {
    if (!data) {
        jsonDisplay.innerText = "Database is empty.";
        return;
    }
    jsonDisplay.innerText = JSON.stringify(data, null, 2);
}

function renderFormattedData(data) {
    if (!data || !data.users) {
        formattedDisplay.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-user-slash" style="font-size: 32px; margin-bottom: 20px;"></i>
                <p>No user data found in the database.</p>
            </div>
        `;
        return;
    }

    const html = Object.entries(data.users).map(([uid, userData]) => {
        const profile = userData.profile || {};
        const categories = userData.categories || {};
        const documents = userData.documents || {};

        const userName = profile.displayName || profile.email || "Unknown User";
        const email = profile.email || "No email provided";

        const docList = Object.entries(documents).map(([docId, doc]) => {
            const category = categories[doc.categoryId] || { name: 'Uncategorized', color: '#999' };
            return `
                <tr>
                    <td><i class="fa-solid fa-file-lines" style="color: var(--text-muted);"></i></td>
                    <td><strong>${doc.name}</strong></td>
                    <td>
                        <span class="badge" style="background: ${category.color}20; color: ${category.color}">
                            ${category.name}
                        </span>
                    </td>
                    <td>${doc.size || '0 KB'}</td>
                    <td>${new Date(doc.date).toLocaleDateString()}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="user-data-card">
                <div class="user-header">
                    <div class="avatar" style="width: 32px; height: 32px; font-size: 14px;">${userName[0].toUpperCase()}</div>
                    <div>
                        <h4 style="margin-bottom: 2px;">${userName}</h4>
                        <p style="font-size: 12px; color: var(--text-muted);">${email} • UID: ${uid.substring(0, 8)}...</p>
                    </div>
                </div>
                
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th style="width: 30px;"></th>
                            <th>Document Name</th>
                            <th>Category</th>
                            <th>Size</th>
                            <th>Uploaded At</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${docList || '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No documents uploaded by this user.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }).join('');

    formattedDisplay.innerHTML = html;
}
