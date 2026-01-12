
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";
import { getDatabase, ref, onValue, push, set, remove, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// --- FIREBASE CONFIGURATION ---
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
const analytics = getAnalytics(app);
const db = getDatabase(app);
const auth = getAuth(app);

// State Management
let documents = [];
let categories = [];
let currentCategory = 'all';
let editingCategoryId = null;
let selectedFile = null;
let selectedFiles = []; // For folder upload
let thumbnailData = null;
let fullFileContent = null;
let uploadMode = 'file'; // 'file' or 'folder'

// DOM Elements
const docGrid = document.getElementById('document-grid');
const categoryList = document.getElementById('category-list');
const uploadModal = document.getElementById('upload-modal');
const categoryModal = document.getElementById('category-modal');
const searchInput = document.getElementById('search-input');
const emptyState = document.getElementById('empty-state');
const pageTitle = document.getElementById('page-title');
const previewModal = document.getElementById('preview-modal');

// Initialize
function init(user) {
    updateUserProfile(user);
    saveUserProfile(user);
    setupRealtimeListeners(user);
    setupEventListeners();

    // Check Drive Connection
    const token = sessionStorage.getItem('googleAccessToken');
    if (!token) {
        document.getElementById('drive-connect-btn').style.display = 'flex';
        // Optional: Alert user
        console.log("Drive token missing");
    } else {
        document.getElementById('drive-connect-btn').style.display = 'none';
        updateStorageUsage();
    }
}

window.connectGoogleDrive = async function () {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential.accessToken;
        sessionStorage.setItem('googleAccessToken', token);

        // Hide button, update state
        document.getElementById('drive-connect-btn').style.display = 'none';
        alert("Google Drive Connected Successfully!");
        updateStorageUsage();
    } catch (error) {
        console.error(error);
        alert("Failed to connect Drive: " + error.message);
    }
}

function updateStorageUsage() {
    // 5GB Limit
    const limitBytes = 5 * 1024 * 1024 * 1024;

    // Calculate total usage from documents
    const totalUsedBytes = documents.reduce((total, doc) => {
        // Use saved bytes if available, otherwise parse string (legacy support)
        let bytes = doc.sizeBytes;
        if (typeof bytes === 'undefined' || bytes === null) {
            bytes = parseSizeString(doc.size);
        }
        return total + bytes;
    }, 0);

    const percent = Math.min(100, Math.round((totalUsedBytes / limitBytes) * 100));
    const remainingBytes = Math.max(0, limitBytes - totalUsedBytes);

    const percentEl = document.getElementById('storage-percent');
    const fillEl = document.getElementById('storage-fill');
    const detailEl = document.getElementById('storage-detail');

    if (percentEl) percentEl.innerText = percent + '%';
    if (fillEl) {
        fillEl.style.width = percent + '%';
        // Color warning
        if (percent > 90) fillEl.style.background = '#ef4444';
        else fillEl.style.background = 'linear-gradient(90deg, var(--primary), #a855f7)';
    }

    if (detailEl) {
        detailEl.innerText = `${formatBytes(totalUsedBytes)} used • ${formatBytes(remainingBytes)} free`;
    }
}

function parseSizeString(sizeStr) {
    if (!sizeStr) return 0;
    const parts = sizeStr.split(' ');
    if (parts.length < 2) return 0;

    const value = parseFloat(parts[0]);
    const unit = parts[1].toUpperCase();

    const k = 1024;
    // Basic approximate parsing
    if (unit.startsWith('KB')) return value * k;
    if (unit.startsWith('MB')) return value * k * k;
    if (unit.startsWith('GB')) return value * k * k * k;
    if (unit.startsWith('BYTES')) return value;
    return 0;
}

async function saveUserProfile(user) {
    try {
        const profileRef = ref(db, `users/${user.uid}/profile`);
        await update(profileRef, {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            lastSeen: new Date().toISOString()
        });
    } catch (e) {
        console.error("Error saving profile:", e);
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        init(user);
    } else {
        window.location.href = 'login.html';
    }
});

function updateUserProfile(user) {
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    const welcomeMsg = document.getElementById('welcome-msg');

    if (user) {
        const displayName = user.displayName || user.email.split('@')[0];
        if (avatarEl) avatarEl.innerText = displayName[0].toUpperCase();
        if (nameEl) nameEl.innerText = displayName;
        if (welcomeMsg) welcomeMsg.innerText = "Welcome, " + displayName;
    }
}

window.toggleSidebar = function (e) {
    if (e) e.stopPropagation();
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

async function setupRealtimeListeners(user) {
    const userPath = `users/${user.uid}`;

    // Categories components
    const categoriesRef = ref(db, `${userPath}/categories`);
    onValue(categoriesRef, (snapshot) => {
        const data = snapshot.val();
        categories = data ? Object.entries(data).map(([key, value]) => ({ id: key, ...value })) : [];
        renderCategories();
        // Re-render docs in case categories changed (needed for colors/names match)
        renderDocuments();
    }, (error) => {
        console.error("Error reading categories:", error);
    });

    // Documents components
    const documentsRef = ref(db, `${userPath}/documents`);
    onValue(documentsRef, (snapshot) => {
        const data = snapshot.val();
        documents = data ? Object.entries(data).map(([key, value]) => ({ id: key, ...value })) : [];
        // Client-side sort by date descending
        documents.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderDocuments();
        updateStorageUsage();
    }, (error) => {
        console.error("Error reading documents:", error);
    });
}

// Render Functions
function renderCategories() {
    if (!categoryList) return;

    categoryList.innerHTML = categories.map(cat => `
        <div class="nav-group ${currentCategory === cat.id ? 'active' : ''}">
            <button class="nav-item-content" onclick="filterCategory('${cat.id}')">
                <i class="fa-solid fa-folder" style="color: ${cat.color}"></i>
                <span>${cat.name}</span>
            </button>
            <button class="nav-item-action" onclick="openEditCategoryModal('${cat.id}', '${cat.name}', '${cat.color}')" title="Edit Category">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="nav-item-action delete" onclick="deleteCategory('${cat.id}', event)" title="Delete Category">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');

    // Also update selector in upload modal
    const docCategorySelect = document.getElementById('doc-category');
    if (docCategorySelect) {
        docCategorySelect.innerHTML = categories.map(cat =>
            `<option value="${cat.id}">${cat.name}</option>`
        ).join('');
    }
}

function renderDocuments() {
    if (!docGrid) return;

    let filteredDocs = documents;

    // Category Filter
    if (currentCategory !== 'all') {
        filteredDocs = filteredDocs.filter(doc => doc.categoryId === currentCategory);
    }

    // Search Filter
    if (searchInput) {
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filteredDocs = filteredDocs.filter(doc =>
                doc.name.toLowerCase().includes(searchTerm)
            );
        }
    }

    // Toggle Empty State
    if (filteredDocs.length === 0) {
        docGrid.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        docGrid.innerHTML = filteredDocs.map(doc => {
            const category = categories.find(c => c.id === doc.categoryId) || { name: 'Uncategorized', color: '#ccc' };
            return `
                <div class="document-card" onclick="openDoc('${doc.id}')">
                    <div class="card-icon">
                        <i class="fa-solid ${getFileIcon(doc.type || 'file')}"></i>
                    </div>
                    <div class="card-info">
                        <h3>${doc.name}</h3>
                        <p>${formatDate(doc.date)} • ${doc.size || '0 KB'}</p>
                    </div>
                    <div class="card-meta">
                        <span class="tag-badge" style="background: ${category.color}20; color: ${category.color}">
                            ${category.name}
                        </span>
                        <button class="doc-menu-btn" onclick="deleteDoc('${doc.id}', event)">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Helper Functions
function getFileIcon(type) {
    if (!type) return 'fa-file';
    if (type.includes('pdf')) return 'fa-file-pdf';
    if (type.includes('image')) return 'fa-file-image';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'fa-file-excel';
    if (type.includes('word') || type.includes('doc')) return 'fa-file-word';
    return 'fa-file';
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // fallback
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Actions - Attached to Window for HTML access
window.filterCategory = function (catId) {
    currentCategory = catId;

    // Update ZIP Button Visibility
    const zipBtn = document.getElementById('zip-download-btn');
    if (zipBtn) {
        if (catId === 'all') {
            zipBtn.classList.add('hidden');
        } else {
            zipBtn.classList.remove('hidden');
        }
    }

    // Update active class
    document.querySelectorAll('.nav-group').forEach(btn => btn.classList.remove('active'));
    if (catId === 'all') {
        const allBtn = document.querySelector('[data-category="all"]');
        if (allBtn) allBtn.classList.add('active');
        if (pageTitle) pageTitle.innerText = 'All Documents';
    } else {
        const catName = categories.find(c => c.id === catId)?.name || 'Documents';
        if (pageTitle) pageTitle.innerText = catName;
    }

    renderCategories();
    renderDocuments();

    // Auto-close sidebar on mobile
    if (window.innerWidth <= 992) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('active');
    }
}
window.saveDocument = async function () {
    const nameInput = document.getElementById('doc-name');
    const categorySelect = document.getElementById('doc-category');

    // Folder Upload Logic
    if (uploadMode === 'folder') {
        if (selectedFiles.length === 0) {
            alert('Please select a folder');
            return;
        }

        // Get folder name from path or fallback to property
        let folderName = 'New Upload';
        if (selectedFiles[0].explicitPath) {
            folderName = selectedFiles[0].explicitPath.split('/')[0];
        } else if (selectedFiles[0].webkitRelativePath) {
            folderName = selectedFiles[0].webkitRelativePath.split('/')[0];
        } else if (selectedFiles.folderName) {
            folderName = selectedFiles.folderName;
        }

        if (!folderName || folderName === "") folderName = "Uploaded Folder";

        // Create new Category
        const newCatId = await createCategoryFromName(folderName);

        const zipBtn = document.querySelector('.primary-btn span');
        const originalBtnText = zipBtn.innerText;
        zipBtn.innerText = `Uploading ${selectedFiles.length} files...`;

        try {
            const user = auth.currentUser;
            const accessToken = sessionStorage.getItem('googleAccessToken');

            if (!accessToken) {
                alert('Please login with Google to enable Drive storage.');
                return;
            }

            for (const file of selectedFiles) {
                // Skip system files
                if (file.name.startsWith('.')) continue;

                // 1. Upload to Drive
                const driveFileId = await uploadToGoogleDrive(file, accessToken);

                // 2. Save metadata
                const newDocRef = push(ref(db, `users/${user.uid}/documents`));
                await set(newDocRef, {
                    name: file.name,
                    categoryId: newCatId,
                    type: file.type || 'application/octet-stream',
                    size: formatBytes(file.size),
                    sizeBytes: file.size,
                    date: new Date().toISOString(),
                    thumbnail: null, // No thumbnails for batch yet to save speed
                    driveFileId: driveFileId
                });
            }

            window.closeUploadModal();
            zipBtn.innerText = originalBtnText;
            updateStorageUsage();
            return;
        } catch (e) {
            console.error("Batch upload error", e);
            alert("Upload failed: " + e.message);
            zipBtn.innerText = originalBtnText;
        }
        return;
    }

    // Single File Logic
    if (!selectedFile && !nameInput.value) {
        alert('Please select a file or enter a name');
        return;
    }

    try {
        const user = auth.currentUser;
        const accessToken = sessionStorage.getItem('googleAccessToken');

        if (!accessToken) {
            alert('Please login with Google to enable Drive storage.');
            return;
        }

        const zipBtn = document.querySelector('.primary-btn span');
        const originalBtnText = zipBtn.innerText;
        zipBtn.innerText = 'Uploading to Drive...';

        // 1. Upload to Google Drive
        const driveFileId = await uploadToGoogleDrive(selectedFile, accessToken);

        // 2. Save metadata to Firebase
        const newDocRef = push(ref(db, `users/${user.uid}/documents`));
        await set(newDocRef, {
            name: nameInput.value || selectedFile.name,
            categoryId: categorySelect.value,
            type: selectedFile ? selectedFile.type : 'application/pdf',
            size: selectedFile ? formatBytes(selectedFile.size) : '0 KB',
            sizeBytes: selectedFile ? selectedFile.size : 0,
            date: new Date().toISOString(),
            thumbnail: thumbnailData || null,
            driveFileId: driveFileId
        });

        window.closeUploadModal();
        zipBtn.innerText = originalBtnText;
        thumbnailData = null;
        fullFileContent = null;
        // updateStorageUsage(); // Handled automatically by listener
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Error saving document: " + e.message);
    }
}

async function uploadToGoogleDrive(file, token) {
    const metadata = {
        name: file.name,
        mimeType: file.type
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + token }),
        body: formData
    });

    if (!response.ok) throw new Error('Drive Upload Failed');
    const result = await response.json();
    return result.id;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// DRAG AND DROP RECURSIVE SCANNER
async function scanFiles(items) {
    const files = [];
    let rootName = null;

    // Get all entries
    const entries = [];
    for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : items[i].getAsEntry();
        if (entry) {
            if (!rootName) rootName = entry.name; // Assume first item is root
            entries.push(entry);
        }
    }

    for (const entry of entries) {
        await traverseFileTree(entry, '', files);
    }

    return { files, rootName };
}

function traverseFileTree(item, path, fileList) {
    return new Promise((resolve) => {
        if (item.isFile) {
            item.file((file) => {
                // Determine full path
                // Note: file.webkitRelativePath is often empty in drop, so we manually attach path
                if (path) file.explicitPath = path + item.name;
                else file.explicitPath = item.name;

                fileList.push(file);
                resolve();
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            const readEntries = () => {
                dirReader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve();
                    } else {
                        const promises = entries.map(entry => traverseFileTree(entry, path + item.name + "/", fileList));
                        await Promise.all(promises);
                        // Continue reading (dirReader returns batch of entries)
                        readEntries();
                    }
                });
            };
            readEntries();
        } else {
            resolve();
        }
    });
}

window.setUploadMode = function (mode) {
    uploadMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');

    // Reset inputs
    window.resetFileSelection();

    const dropText = document.getElementById('drop-text');
    if (mode === 'folder') {
        dropText.innerHTML = "Drag & Drop a <b>Folder</b> here or <span>Browse</span>";
        document.getElementById('doc-category').closest('.form-group').classList.add('hidden');
    } else {
        dropText.innerHTML = "Drag & Drop files here or <span>Browse</span>";
        document.getElementById('doc-category').closest('.form-group').classList.remove('hidden');
    }
    // Always show name input but maybe disable it for folder mode? 
    // Actually user requirement implies folder name = category name, so maybe hide doc name entirely in folder mode
    if (mode === 'folder') {
        document.getElementById('doc-name').closest('.form-group').classList.add('hidden');
    } else {
        document.getElementById('doc-name').closest('.form-group').classList.remove('hidden');
    }
}

async function createCategoryFromName(name) {
    // Check duplication
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    // Create new
    const user = auth.currentUser;
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newCatRef = push(ref(db, `users/${user.uid}/categories`));
    await set(newCatRef, {
        name: name,
        color: randomColor
    });
    return newCatRef.key;
}

function handleFileSelect(input, dropFiles = null, droppedFolderName = null) {
    // 1. Handle Dropped Files (from scanFiles)
    if (dropFiles) {
        if (uploadMode === 'folder') {
            selectedFiles = dropFiles;
            selectedFiles.folderName = droppedFolderName; // Store root folder name
            updatePreviewForFolder(droppedFolderName || "Uploaded Folder", selectedFiles.length);
            return;
        } else {
            // If dropped in file mode, just take the first file
            if (dropFiles.length > 0) handleSingleFile(dropFiles[0]);
            return;
        }
    }

    if (!input) return;

    // 2. Handle File Input (e.target.files)
    if (input instanceof FileList || (input.length && input[0] instanceof File)) {
        if (uploadMode === 'folder') {
            selectedFiles = Array.from(input); // Store all files
            // Robust check for folder name
            let folderName = "New Folder";
            if (selectedFiles.length > 0) {
                if (selectedFiles[0].webkitRelativePath) {
                    folderName = selectedFiles[0].webkitRelativePath.split('/')[0];
                }
            }

            updatePreviewForFolder(folderName, selectedFiles.length);
            return;
        } else {
            // Fallback to single file logic for first file
            handleSingleFile(input[0]);
        }
    } else {
        handleSingleFile(input);
    }
}

function updatePreviewForFolder(name, count) {
    const previewContainer = document.getElementById('file-preview');
    const dropZone = document.getElementById('drop-zone');

    previewContainer.classList.remove('hidden');
    dropZone.classList.add('hidden');

    previewContainer.innerHTML = `
        <div class="preview-thumb"><i class="fa-solid fa-folder-open"></i></div>
        <div class="file-meta-info">
            <div class="file-name">${name}</div>
            <div class="file-details">${count} files found</div>
        </div>
        <button class="icon-btn" onclick="resetFileSelection()" title="Remove"><i class="fa-solid fa-xmark"></i></button>
    `;
}

function handleSingleFile(file) {
    selectedFile = file;

    const previewContainer = document.getElementById('file-preview');
    const dropZone = document.getElementById('drop-zone');
    const nameInput = document.getElementById('doc-name');

    // Analyze Format
    const format = file.name.split('.').pop().toUpperCase();
    const size = formatBytes(file.size);

    // Predetermine name if empty
    if (!nameInput.value) nameInput.value = file.name;

    // Show Preview UI
    previewContainer.classList.remove('hidden');
    dropZone.classList.add('hidden'); // Hide dropzone while previewing

    // Generate Full File Data for Download
    const fullReader = new FileReader();
    fullReader.onload = (e) => {
        fullFileContent = e.target.result; // Base64 full file
    };
    fullReader.readAsDataURL(file);

    let previewContent = '';
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            thumbnailData = e.target.result;
            const thumbEl = document.getElementById('thumb-preview');
            if (thumbEl) thumbEl.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
        previewContent = `<div class="preview-thumb" id="thumb-preview"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
    } else {
        thumbnailData = null;
        previewContent = `
            <div class="preview-thumb">
                <i class="fa-solid ${getFileIcon(file.type)}"></i>
            </div>
        `;
    }

    previewContainer.innerHTML = `
        ${previewContent}
        <div class="file-meta-info">
            <div class="file-name">${file.name} <span class="badge-format">${format}</span></div>
            <div class="file-details">${size} • Analyzed Format</div>
        </div>
        <button class="icon-btn" onclick="resetFileSelection()" title="Remove file"><i class="fa-solid fa-xmark"></i></button>
    `;
}

window.resetFileSelection = function () {
    selectedFile = null;
    selectedFiles = [];
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('drop-zone').classList.remove('hidden');
    document.getElementById('file-input').value = '';
    document.getElementById('folder-input').value = '';
}

window.deleteDoc = async function (id, event) {
    if (event) event.stopPropagation();
    if (confirm('Are you sure you want to delete this document?')) {
        try {
            const user = auth.currentUser;
            await remove(ref(db, `users/${user.uid}/documents/${id}`));
        } catch (e) {
            console.error("Error deleting document: ", e);
            alert("Error deleting: " + e.message);
        }
    }
}

window.saveCategory = async function () {
    const nameInput = document.getElementById('cat-name');
    const selectedColorEl = document.querySelector('.color-option.selected');
    const selectedColor = selectedColorEl ? selectedColorEl.dataset.color : '#6366f1';

    if (!nameInput.value) {
        alert('Please enter a category name');
        return;
    }

    try {
        const user = auth.currentUser;
        if (editingCategoryId) {
            // Update existing
            await update(ref(db, `users/${user.uid}/categories/${editingCategoryId}`), {
                name: nameInput.value,
                color: selectedColor
            });
        } else {
            // Create new
            const newCatRef = push(ref(db, `users/${user.uid}/categories`));
            await set(newCatRef, {
                name: nameInput.value,
                color: selectedColor
            });
        }

        window.closeCategoryModal();
        nameInput.value = '';
        editingCategoryId = null;
    } catch (e) {
        console.error("Error saving category: ", e);
        alert("Error saving category: " + e.message);
    }
}

window.openEditCategoryModal = function (id, name, color) {
    editingCategoryId = id;
    const nameInput = document.getElementById('cat-name');
    const modalTitle = document.querySelector('#category-modal .modal-header h2');
    const submitBtn = document.querySelector('#category-modal .primary-btn');

    if (nameInput) nameInput.value = name;
    if (modalTitle) modalTitle.innerText = "Edit Category";
    if (submitBtn) submitBtn.innerText = "Update";

    // Set color
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(o => {
        o.classList.remove('selected');
        if (o.dataset.color === color) o.classList.add('selected');
    });

    window.openCategoryModal();
}

window.openNewCategoryModal = function () {
    editingCategoryId = null;
    const nameInput = document.getElementById('cat-name');
    const modalTitle = document.querySelector('#category-modal .modal-header h2');
    const submitBtn = document.querySelector('#category-modal .primary-btn');
    if (nameInput) nameInput.value = '';
    if (modalTitle) modalTitle.innerText = "New Category";
    if (submitBtn) submitBtn.innerText = "Create";

    window.openCategoryModal();
}

window.openDoc = function (id) {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    const category = categories.find(c => c.id === doc.categoryId) || { name: 'Uncategorized', color: '#ccc' };

    // Set UI elements
    document.getElementById('view-name').innerText = doc.name;
    document.getElementById('view-category').innerHTML = `
        <span class="badge" style="background: ${category.color}20; color: ${category.color}">
            ${category.name}
        </span>
    `;
    document.getElementById('view-format').innerText = doc.type.split('/').pop().toUpperCase();
    document.getElementById('view-size').innerText = doc.size;
    document.getElementById('view-date').innerText = formatDate(doc.date);

    // Set Visual
    const visualContainer = document.getElementById('preview-visual');
    if (doc.thumbnail) {
        visualContainer.innerHTML = `<img src="${doc.thumbnail}" alt="Preview" style="max-height: 100%; border-radius: 20px;">`;
    } else {
        visualContainer.innerHTML = `<i class="fa-solid ${getFileIcon(doc.type)}"></i>`;
    }

    window.openPreviewModal();
}

window.openPreviewModal = function () {
    if (previewModal) previewModal.classList.remove('hidden');
}

window.closePreviewModal = function () {
    if (previewModal) previewModal.classList.add('hidden');
}

window.downloadCategoryAsZip = async function () {
    const zip = new JSZip();
    const catName = categories.find(c => c.id === currentCategory)?.name || 'category';

    const categoryDocs = documents.filter(doc => doc.categoryId === currentCategory);

    if (categoryDocs.length === 0) {
        alert('This category is empty.');
        return;
    }

    const zipBtn = document.getElementById('zip-download-btn');
    const originalText = zipBtn.innerHTML;
    zipBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching from Drive...';
    zipBtn.disabled = true;

    try {
        const accessToken = sessionStorage.getItem('googleAccessToken');
        if (!accessToken) throw new Error('Google access token missing. Please re-login with Google.');

        const fetchPromises = categoryDocs.map(async (doc) => {
            if (doc.driveFileId) {
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.driveFileId}?alt=media`, {
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                });
                if (!response.ok) throw new Error(`Failed to download ${doc.name}`);
                const blob = await response.blob();
                zip.file(doc.name, blob);
            }
        });

        await Promise.all(fetchPromises);

        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${catName}_documents.zip`;
        link.click();
    } catch (e) {
        console.error("ZIP Error:", e);
        alert("Error creating ZIP: " + e.message);
    } finally {
        zipBtn.innerHTML = originalText;
        zipBtn.disabled = false;
    }
}

window.deleteCategory = async function (id, event) {
    if (event) event.stopPropagation();
    if (confirm('Are you sure? This will not delete documents inside but the category will be gone.')) {
        try {
            const user = auth.currentUser;
            await remove(ref(db, `users/${user.uid}/categories/${id}`));
            if (currentCategory === id) window.filterCategory('all');
        } catch (e) {
            console.error("Error deleting category: ", e);
            alert("Error: " + e.message);
        }
    }
}

window.logout = async function () {
    try {
        sessionStorage.removeItem('googleAccessToken');
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed", error);
    }
}

// Modal Toggle
window.openUploadModal = function () {
    if (uploadModal) uploadModal.classList.remove('hidden');
}
window.closeUploadModal = function () {
    if (uploadModal) uploadModal.classList.add('hidden');
    window.resetFileSelection();
    document.getElementById('doc-name').value = '';
}
window.openCategoryModal = function () {
    if (categoryModal) categoryModal.classList.remove('hidden');
}
window.closeCategoryModal = function () {
    if (categoryModal) categoryModal.classList.add('hidden');
    editingCategoryId = null;
}

// Event Listeners
function setupEventListeners() {
    if (searchInput) searchInput.addEventListener('input', renderDocuments);

    // Color picker
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            colorOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });

    // File Drop Zone - Visual only for now
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');

            // Handle Items for Folder Drop support
            const items = e.dataTransfer.items;
            if (items && items.length > 0 && uploadMode === 'folder') {
                try {
                    const { files, rootName } = await scanFiles(items);
                    if (files.length > 0) {
                        handleFileSelect(null, files, rootName);
                        return;
                    }
                } catch (err) {
                    console.error("Scan failed", err);
                }
            }

            // Fallback for simple files
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // Convert FileList to Array
                if (uploadMode === 'folder') {
                    // This case is rare if items API works, but just in case
                    handleFileSelect(files);
                } else {
                    handleFileSelect(files[0]);
                }
            }
        });

        dropZone.addEventListener('click', () => {
            if (uploadMode === 'folder') {
                document.getElementById('folder-input').click();
            } else {
                document.getElementById('file-input').click();
            }
        });
    }

    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files);
            }
        });
    }

    const folderInput = document.getElementById('folder-input');
    if (folderInput) {
        folderInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files);
            }
        });
    }

    // Category Buttons
    const allBtn = document.querySelector('[data-category="all"]');
    if (allBtn) allBtn.onclick = () => window.filterCategory('all');

    // New Category Button
    const addCatBtn = document.querySelector('.add-category-btn');
    if (addCatBtn) addCatBtn.onclick = () => window.openNewCategoryModal();

    // Close sidebar on click outside (mobile)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.addEventListener('click', () => {
            if (window.innerWidth <= 992) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.classList.remove('active');
            }
        });
    }
}

// Run
init();
