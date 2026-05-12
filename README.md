# 📁 RexDocs

> A modern, cloud-powered document management web application built with vanilla HTML/CSS/JavaScript, Firebase, and Google Drive integration.

---

## 🚀 Overview

**DocuFlow** is a sleek, glassmorphism-styled document organizer that lets users securely upload, categorize, search, and download their files — all stored on Google Drive with metadata synced in real-time via Firebase.

The app supports both individual file uploads and full folder uploads, making it ideal for managing large sets of organized documents (e.g., NREGA work reports, legal files, personal records).

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Authentication | Email/Password & Google Sign-In via Firebase Auth |
| 📂 Category Management | Create, edit, delete color-coded categories |
| 📤 File Upload | Single file or full folder upload with drag & drop support |
| ☁️ Google Drive Storage | All files are stored in the user's own Google Drive |
| 🔍 Real-time Search | Instant search filtering across all documents |
| 🗂️ Grid / List View | Toggle between grid and list layouts |
| 📦 ZIP Download | Download all files in a category as a ZIP archive |
| 📊 Storage Tracker | Visual progress bar showing storage used (5 GB limit) |
| 👁️ Document Preview | Preview panel showing file metadata (name, type, size, date) |
| 🛡️ Admin Panel | Super Admin dashboard with live Firebase Realtime Database viewer |
| 📱 Responsive Design | Mobile-friendly with collapsible sidebar |

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Glassmorphism), Vanilla JavaScript (ES Modules)
- **Auth & Database:** Firebase Authentication + Firebase Realtime Database
- **Storage:** Google Drive API (via OAuth 2.0)
- **ZIP Generation:** [JSZip](https://stuk.github.io/jszip/)
- **Icons:** [Font Awesome 6](https://fontawesome.com/)
- **Fonts:** [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts)

---

## 📂 Project Structure

```
surepalli-vb-gramg/
├── index.html       # Main document dashboard (authenticated users)
├── login.html       # Login / Sign-up page (Email + Google OAuth)
├── admin.html       # Admin panel — live Firebase database viewer
├── script.js        # Core app logic (uploads, CRUD, Drive API, rendering)
├── admin.js         # Admin panel logic (reads all users' data)
├── auth.js          # Firebase Auth logic (login, signup, Google sign-in)
└── style.css        # Global styles (glassmorphism design system)
```

---

## 🔐 Authentication Flow

1. User visits the app → redirected to `login.html` if not signed in.
2. Supports **Google Sign-In** (also requests Google Drive file scope) and **Email/Password**.
3. On successful login, user is redirected to `index.html`.
4. Firebase `onAuthStateChanged` guards all protected pages.

---

## ☁️ Google Drive Integration

- Users must **connect Google Drive** from the sidebar to enable file uploads.
- Files are uploaded via the [Google Drive Multipart Upload API](https://developers.google.com/drive/api/guides/manage-uploads).
- The `driveFileId` is saved in Firebase alongside document metadata.
- ZIP downloads fetch files directly from Drive using the stored `driveFileId`.
- Google access tokens are stored in `sessionStorage` and validated on each session.

---

## 📊 Firebase Data Model

Each user's data is namespaced by their Firebase UID:

```
users/
  {uid}/
    profile/
      email, displayName, lastSeen
    categories/
      {catId}/
        name, color
    documents/
      {docId}/
        name, categoryId, type, size, sizeBytes, date, thumbnail, driveFileId
```

---

## 🖥️ Pages

### `index.html` — Main Dashboard
- Sidebar with category navigation and storage indicator
- Top bar with search and upload/ZIP controls
- Document grid with per-file delete and preview
- Modals for: Upload (file/folder), New/Edit Category, Document Preview

### `login.html` — Auth Page
- Tabbed Login / Sign-Up form
- Google Sign-In button
- Gradient background with glassmorphism card

### `admin.html` — Admin Panel
- Live view of all users' data from Firebase Realtime Database
- Formatted user cards with categories and documents tables
- Raw JSON toggle for debugging

---

## 🚦 Getting Started

### Prerequisites
- A Firebase project with **Authentication** and **Realtime Database** enabled
- A Google Cloud project with the **Google Drive API** enabled and OAuth configured

### Setup
1. Clone or copy the project files.
2. Update the Firebase config in `script.js` and `auth.js`:
   ```js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.firebasestorage.app",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID",
     databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com/"
   };
   ```
3. Serve the project using a static file server (e.g., `npx serve .`).
4. Open `http://localhost:3000` in your browser.

> ⚠️ **Note:** Firebase ES Module imports require the app to be served over HTTP/HTTPS — opening `index.html` directly as a file will not work.

---

## 📜 License

This project is private and intended for internal use by the **Surepalli Village/Block Grameen** administration.

---

*Built with ❤️ using Firebase + Google Drive API*
