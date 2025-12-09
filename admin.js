import { db, auth, storage } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// --- State Management ---
let isAdmin = false;

// --- DOM Elements ---
const adminControls = document.getElementById('admin-controls');
const loginModal = document.getElementById('admin-login-modal');
const contentEditorModal = document.getElementById('content-editor-modal');

// --- Authentication ---

export function checkAuthState() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('User is signed in:', user.email);
            isAdmin = true;
            document.body.classList.add('admin-mode');
            if (loginModal) loginModal.style.display = 'none';
        } else {
            console.log('User is signed out');
            isAdmin = false;
            document.body.classList.remove('admin-mode');
        }
    });
}

export async function loginAdmin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Logged in successfully!");
        window.location.href = 'admin.html';
        closeModal('admin-login-modal');
    } catch (error) {
        console.error("Login failed", error);
        alert("Login failed: " + error.message);
    }
}

export async function logoutAdmin() {
    try {
        await signOut(auth);
        alert("Logged out!");
    } catch (error) {
        console.error("Logout failed", error);
    }
}

// --- Storage Operations ---

export async function uploadImage(file, path) {
    if (!file) return null;
    try {
        const storageRef = ref(storage, path + '/' + Date.now() + '_' + file.name);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
}

// --- Dynamic Content Rendering ---

// Render Sections (Home Page)
export function subscribeToSections(containerId) {
    const q = query(collection(db, "sections"), orderBy("order", "asc"));
    const container = document.getElementById(containerId);
    
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const sectionEl = createSectionElement(doc.id, data);
            container.appendChild(sectionEl);
        });
    });
}

// Render Articles (Blogs Page)
export function subscribeToArticles(containerId) {
    const q = query(collection(db, "articles"), orderBy("date", "desc"));
    const container = document.getElementById(containerId);

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const articleEl = createArticleElement(doc.id, data);
            container.appendChild(articleEl);
        });
    });
}

// Helper: Create Section HTML
function createSectionElement(id, data) {
    const section = document.createElement('section');
    section.className = 'section';
    section.id = `section-${id}`;
    
    let contentHTML = data.content || '';
    
    const imageHTML = data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.title}" style="max-width: 100%; height: auto; margin-bottom: 1rem; border-radius: 8px;">` : '';

    section.innerHTML = `
        <div class="content-wrapper">
            ${data.title ? `<h2>${data.title}</h2>` : ''}
            ${imageHTML}
            ${contentHTML}
        </div>
    `;
    return section;
}

// Helper: Create Article HTML
function createArticleElement(id, data) {
    const card = document.createElement('div');
    card.className = 'researcher-card';
    
    const imageHTML = data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0; margin-bottom: 1rem;">` : '';

    card.innerHTML = `
        ${imageHTML}
        <h3>${data.title}</h3>
        ${data.subtitle ? `<p class="subtitle">${data.subtitle}</p>` : ''}
        <p>${data.summary || data.content.substring(0, 150) + '...'}</p>
        <p style="color: #667eea; font-weight: 600; margin-top: 1rem; cursor: pointer;">Read More →</p>
    `;
    return card;
}


// --- CRUD Operations ---

export async function addSection(data) {
    if (!isAdmin) return;
    try {
        await addDoc(collection(db, "sections"), {
            ...data,
            order: Date.now() // Simple ordering
        });
        alert("Section added!");
    } catch (e) {
        console.error("Error adding section: ", e);
        alert("Error adding section");
    }
}

export async function deleteDocument(collectionName, id) {
    if (!isAdmin) return;
    if(!confirm("Are you sure you want to delete this?")) return;

    try {
        await deleteDoc(doc(db, collectionName, id));
        alert("Deleted successfully");
    } catch (e) {
        console.error("Error deleting: ", e);
        alert("Error deleting");
    }
}

export async function updateDocument(collectionName, id, data) {
    if (!isAdmin) return;
    try {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, data);
        alert("Updated successfully");
    } catch (e) {
        console.error("Error updating: ", e);
        alert("Error updating");
    }
}


// --- UI Helpers ---



export function openEditor(type, id = null) {
    // TODO: Implement a generic modal for editing content
    // Populates form fields and handles save
    console.log(`Opening editor for ${type} ${id}`);
    const modal = document.getElementById('editor-modal');
    if(modal) {
        modal.dataset.type = type;
        modal.dataset.id = id || '';
        modal.style.display = 'block';
    }
}

export function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
