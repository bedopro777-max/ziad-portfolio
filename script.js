import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocsFromServer, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ============================================
// إعدادات Firebase
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyAo8x8lD5uG-YraYNdVEv8o3jZW_5I",
    authDomain: "images-b1e77.firebaseapp.com",
    projectId: "images-b1e77",
    storageBucket: "images-b1e77.firebasestorage.app",
    messagingSenderId: "71800504718",
    appId: "1:71800504718:web:74e6e501430f21bcf64df",
    measurementId: "G-RY2Z2SHYR1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================
// الباسورد المشفر
// ============================================
// الباسورد الأصلي: Zizo@2026!
const ADMIN_PASSWORD_HASH = 'd3b07384d113edec49eaa6238ad5ff00'; 
let isAdmin = false;

// ============================================
// إعدادات Cloudinary (آمنة)
// ============================================
const CLOUD_NAME = 'eg2vzfar';
const UPLOAD_PRESET = 'my_uploads'; 

// ============================================
// إدارة حالة الدخول
// ============================================
const adminBtn = document.getElementById('adminBtn');
const loginModal = document.getElementById('loginModal');
const uploadSection = document.getElementById('upload');
const uploadNavLink = document.getElementById('uploadNavLink');
const deleteLightboxBtn = document.getElementById('deleteLightbox');
const deleteVideoBtn = document.getElementById('deleteVideo');

function updateAdminUI() {
    if (isAdmin) {
        uploadSection.style.display = 'block';
        uploadNavLink.style.display = 'block';
        if (adminBtn) { adminBtn.textContent = 'Logout'; adminBtn.style.color = 'var(--danger)'; }
        deleteLightboxBtn.style.display = 'inline-flex';
        deleteVideoBtn.style.display = 'inline-flex';
    } else {
        uploadSection.style.display = 'none';
        uploadNavLink.style.display = 'none';
        // نثبت الزرار يبقى ظاهر دايماً
        if (adminBtn) { adminBtn.style.display = 'block'; adminBtn.textContent = 'Admin'; adminBtn.style.color = 'var(--text-sec)'; }
        deleteLightboxBtn.style.display = 'none';
        deleteVideoBtn.style.display = 'none';
    }
    renderUnifiedFeed();
}

if (localStorage.getItem('zizo_admin_secure') === 'true') { isAdmin = true; }

adminBtn.addEventListener('click', () => {
    if (isAdmin) {
        if(confirm('Do you want to logout from admin mode?')) {
            isAdmin = false; localStorage.removeItem('zizo_admin_secure'); updateAdminUI(); showToast('Logged out');
        }
    } else { loginModal.classList.add('active'); }
});

document.getElementById('closeLogin').addEventListener('click', () => loginModal.classList.remove('active'));

// دالة تشفير الباسورد
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// تسجيل الدخول باستخدام الهاش
document.getElementById('loginSubmitBtn').addEventListener('click', async () => {
    const pass = document.getElementById('loginPassword').value;
    const hashedInput = await hashPassword(pass); // بنشفر اللي المستخدم كتبه
    
    if (hashedInput === ADMIN_PASSWORD_HASH) { 
        isAdmin = true;
        localStorage.setItem('zizo_admin_secure', 'true');
        document.getElementById('loginPassword').value = '';
        loginModal.classList.remove('active');
        updateAdminUI();
        showToast('Welcome, Admin!');
    } else {
        showToast('Wrong password!', 'error');
    }
});

// ============================================
// Toast Notification
// ============================================
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');

function showToast(msg, type = 'success') {
    toastMessage.textContent = msg; toast.classList.remove('error');
    if (type === 'error') { toast.classList.add('error'); toastIcon.textContent = '✕'; } else { toastIcon.textContent = '✓'; }
    toast.classList.add('show'); clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// الرفع الآمن لـ Cloudinary
// ============================================
async function uploadToCloudinary(file, folder, onProgress, onSuccess, onError) {
    try {
        const formData = new FormData();
        formData.append('file', file); formData.append('upload_preset', UPLOAD_PRESET);
        const isVideo = file.type.startsWith('video/');
        const resourceType = isVideo ? 'video' : 'image';
        const xhr = new XMLHttpRequest();
        const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
        xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); });
        xhr.addEventListener('load', () => { if (xhr.status === 200) onSuccess(JSON.parse(xhr.responseText), isVideo); else onError(xhr.responseText); });
        xhr.addEventListener('error', () => onError('Connection error'));
        xhr.open('POST', url); xhr.send(formData);
    } catch (err) { onError(err.message); }
}

// ============================================
// قاعدة البيانات (Firebase)
// ============================================
async function saveItem(key, data) {
    try { const docRef = await addDoc(collection(db, key), data); return { ...data, firestoreId: docRef.id }; } catch (e) { console.error("Firebase Error: ", e); return null; }
}

async function getItems(key) {
    const querySnapshot = await getDocsFromServer(collection(db, key));
    const items = []; querySnapshot.forEach((doc) => { items.push({ ...doc.data(), firestoreId: doc.id }); }); return items;
}

// دالة الحذف (بتمسح العنصر وكل النسخ المكررة)
async function deleteFromFirestore(collectionKey, itemToDelete) {
    try { 
        if (!itemToDelete || !itemToDelete.firestoreId) throw new Error("بيانات العنصر غير مكتملة!");
        const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collectionKey}/${itemToDelete.firestoreId}?key=${firebaseConfig.apiKey}`;
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) throw new Error("فشل حذف العنصر الأساسي");
        const collections = ['showcase', 'gallery', 'panorama']; let deletedCount = 0;
        for (const col of collections) {
            const allItems = await getItems(col); const matches = allItems.filter(i => i.name === itemToDelete.name);
            for (const match of matches) {
                const delUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${col}/${match.firestoreId}?key=${firebaseConfig.apiKey}`;
                await fetch(delUrl, { method: 'DELETE' }); deletedCount++;
            }
        }
        return true; 
    } catch (e) { console.error("❌ فشل الحذف: ", e); alert("فشل الحذف! السبب:\n" + e.message); return false; }
}

// ============================================
// تحميل الصور
// ============================================
async function downloadFile(url, filename) {
    try {
        showToast('Downloading...'); const response = await fetch(url); const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = blobUrl; a.download = filename || 'file'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl); showToast('Downloaded successfully!');
    } catch (err) { window.open(url, '_blank'); showToast('Opened in new tab'); }
}
window.downloadFile = downloadFile;

// ============================================
// الرفع الذكي
// ============================================
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

uploadBox.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => Array.from(e.target.files).forEach(handleSmartUpload));
['dragover', 'dragleave', 'drop'].forEach(evt => {
    uploadBox.addEventListener(evt, e => {
        e.preventDefault();
        if (evt === 'dragover') uploadBox.classList.add('dragover');
        else if (evt === 'dragleave') uploadBox.classList.remove('dragover');
        else { uploadBox.classList.remove('dragover'); Array.from(e.dataTransfer.files).forEach(handleSmartUpload); }
    });
});

function handleSmartUpload(file) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { showToast('Only images or videos allowed', 'error'); return; }
    if (file.type.startsWith('video/')) { processUpload(file, 'showcase', 'showcase', 'video'); } 
    else {
        const img = new Image();
        img.onload = function() {
            const ratio = img.width / img.height;
            if (ratio >= 1.9 && ratio <= 2.1) { processUpload(file, 'panorama', 'panorama', '360'); } 
            else { processUpload(file, 'gallery', 'gallery', 'image'); }
        };
        img.src = URL.createObjectURL(file);
    }
}

function processUpload(file, collectionName, folderName, itemType) {
    uploadProgress.style.display = 'block'; progressFill.style.width = '0%'; progressText.textContent = `Uploading ${file.name}...`;
    uploadToCloudinary(file, folderName, 
        p => { progressFill.style.width = p + '%'; progressText.textContent = `Uploading... ${p}%`; },
        async (res) => {
            progressText.textContent = '✓ Uploaded!';
            const data = { url: res.secure_url, publicId: res.public_id, type: itemType, uploadedAt: new Date().toISOString(), name: file.name.replace(/\.[^/.]+$/, '') };
            const savedData = await saveItem(collectionName, data);
            if (savedData) { renderUnifiedFeed(); showToast(`Added as ${itemType}!`); } else { showToast('Failed to save to database.', 'error'); }
            setTimeout(() => uploadProgress.style.display = 'none', 2000);
        },
        err => { progressText.textContent = '✕ Failed'; showToast('Upload failed: ' + err, 'error'); }
    );
}

// ============================================
// عرض الفيد
// ============================================
const unifiedFeed = document.getElementById('unifiedFeed');

async function renderUnifiedFeed() {
    unifiedFeed.innerHTML = '<div style="text-align:center; padding:50px; color:var(--text-sec);">Loading...</div>';
    const showcaseItems = await getItems('showcase');
    const galleryItems = await getItems('gallery');
    const panoramaItems = await getItems('panorama');
    let allItems = [...showcaseItems, ...galleryItems, ...panoramaItems];
    allItems.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    unifiedFeed.innerHTML = '';

    if (allItems.length === 0) {
        unifiedFeed.innerHTML = `<div class="empty-state"><div class="empty-icon">✦</div><h3>No items yet</h3><p>Upload images, videos, or 360° photos to see them here</p></div>`;
        return;
    }

    allItems.forEach((item, index) => {
        const el = document.createElement('div'); el.className = 'feed-item'; el.style.animationDelay = `${index * 0.1}s`;
        const dateStr = new Date(item.uploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        let mediaHTML = ''; let clickHandler = null;

        if (item.type === 'video') { mediaHTML = `<video class="feed-media" src="${item.url}" controls playsinline></video>`; clickHandler = () => openVideo(item); } 
        else if (item.type === '360') { mediaHTML = `<div style="position:relative;"><span style="position:absolute; top:15px; left:15px; background:rgba(6, 182, 212, 0.9); color:white; padding:5px 12px; border-radius:20px; font-size:0.8em; font-weight:bold; z-index:2; backdrop-filter:blur(5px);">360° VIEW</span><img class="feed-media" src="${item.url}" alt="${item.name}"></div>`; clickHandler = () => openViewer(item); } 
        else { mediaHTML = `<img class="feed-media" src="${item.url}" alt="${item.name}">`; clickHandler = () => openLightbox(item); }

        const collectionType = item.type === 'video' ? 'showcase' : item.type === '360' ? 'panorama' : 'gallery';

        el.innerHTML = `
            ${mediaHTML}
            <div class="feed-info">
                <div class="feed-text"><h4>${item.name || 'Untitled'}</h4><p>${item.type === 'video' ? 'Video' : item.type === '360' ? '360° Image' : 'Image'} • ${dateStr}</p></div>
                <div class="feed-actions">
                    <button type="button" class="action-btn download" data-url="${item.url}" data-name="${item.name || 'file'}" data-type="${item.type}">⬇ Download</button>
                    ${isAdmin ? `<button type="button" class="action-btn delete" data-id="${item.firestoreId}" data-collection="${collectionType}">🗑 Delete</button>` : ''}
                </div>
            </div>`;
        
        el.querySelector('.feed-media').addEventListener('click', clickHandler);
        const dlBtn = el.querySelector('.download');
        if (dlBtn) { dlBtn.addEventListener('click', (e) => { e.stopPropagation(); const ext = dlBtn.dataset.type === 'video' ? '.mp4' : '.jpg'; window.downloadFile(dlBtn.dataset.url, dlBtn.dataset.name + ext); }); }

        const deleteBtn = el.querySelector('.delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault(); e.stopPropagation();
                if(confirm('Are you sure you want to delete this item? (All copies will be deleted)')) {
                    deleteBtn.textContent = 'Deleting...'; deleteBtn.disabled = true;
                    const success = await deleteFromFirestore(collectionType, item);
                    if(success) {
                        showToast('Item deleted successfully'); el.style.transition = 'all 0.3s ease'; el.style.opacity = '0'; el.style.transform = 'scale(0.9)';
                        setTimeout(() => { el.remove(); renderUnifiedFeed(); }, 500);
                    } else { showToast('Delete failed! Check Alert.', 'error'); deleteBtn.textContent = '🗑 Delete'; deleteBtn.disabled = false; }
                }
            });
        }
        unifiedFeed.appendChild(el);
    });
}

// ============================================
// Modals (Lightbox, Video, 360)
// ============================================
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
let currentLightboxItem = null;
function openLightbox(item) { currentLightboxItem = item; lightboxImg.src = item.url; lightbox.classList.add('active'); }
document.getElementById('closeLightbox').addEventListener('click', () => lightbox.classList.remove('active'));
lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.classList.remove('active'); });
document.getElementById('downloadLightbox').addEventListener('click', e => { e.stopPropagation(); if (currentLightboxItem) downloadFile(currentLightboxItem.url, currentLightboxItem.name + '.jpg'); });
document.getElementById('deleteLightbox').addEventListener('click', async e => { 
    e.preventDefault(); e.stopPropagation(); if (!currentLightboxItem || !isAdmin) return; 
    const collectionKey = currentLightboxItem.type === '360' ? 'panorama' : 'gallery';
    const success = await deleteFromFirestore(collectionKey, currentLightboxItem);
    if(success) { lightbox.classList.remove('active'); showToast('Item deleted'); setTimeout(() => renderUnifiedFeed(), 500); }
});

const videoModal = document.getElementById('videoModal');
const videoPlayer = document.getElementById('videoPlayer');
let currentVideoItem = null;
function openVideo(item) { currentVideoItem = item; videoPlayer.src = item.url; videoModal.classList.add('active'); videoPlayer.play().catch(() => {}); }
document.getElementById('closeVideo').addEventListener('click', () => { videoModal.classList.remove('active'); videoPlayer.pause(); videoPlayer.src = ''; });
document.getElementById('downloadVideo').addEventListener('click', e => { e.stopPropagation(); if (currentVideoItem) downloadFile(currentVideoItem.url, currentVideoItem.name + '.mp4'); });
document.getElementById('deleteVideo').addEventListener('click', async e => { 
    e.preventDefault(); e.stopPropagation(); if (!currentVideoItem || !isAdmin) return; 
    const success = await deleteFromFirestore('showcase', currentVideoItem);
    if(success) { videoModal.classList.remove('active'); videoPlayer.pause(); videoPlayer.src = ''; showToast('Video deleted'); setTimeout(() => renderUnifiedFeed(), 500); }
});

let viewer = null;
const viewerModal = document.getElementById('viewerModal');
let currentViewerItem = null;
function openViewer(item) {
    currentViewerItem = item; viewerModal.classList.add('active');
    setTimeout(() => {
        if (viewer) { viewer.destroy(); viewer = null; }
        viewer = new PhotoSphereViewer.Viewer({
            container: document.getElementById('viewer'), panorama: item.url, defaultYaw: '0deg',
            navbar: ['autorotate', 'zoom', 'move', 'fullscreen', 'caption'], loadingText: 'Loading...',
            touchmoveTwoFingers: true, mousewheelCtrlKey: false, caption: 'Drag to explore • 360° Panorama'
        });
    }, 100);
}
document.getElementById('closeViewer').addEventListener('click', () => { viewerModal.classList.remove('active'); if (viewer) { viewer.destroy(); viewer = null; } });
document.getElementById('downloadViewer').addEventListener('click', () => { if (currentViewerItem) downloadFile(currentViewerItem.url, currentViewerItem.name + '.jpg'); });

// ============================================
// Gold Particles VFX (الغبار الذهبي)
// ============================================
function createGoldParticles() {
    const container = document.getElementById('goldParticles');
    if (!container) return;
    const count = 60;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'gold-particle';
        const size = Math.random() * 5 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 10 + 10}s`;
        particle.style.animationDelay = `${Math.random() * 10}s`;
        container.appendChild(particle);
    }
}

// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    updateAdminUI();
    createGoldParticles();
});
