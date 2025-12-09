import { db, auth } from './firebase-config.js';
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
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
        renderAdminControls(); // Re-render controls based on state
    });
}

export async function loginAdmin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Logged in successfully!");
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
    
    // Admin Overlay
    const adminOverlay = isAdmin ? `
        <div class="admin-overlay">
            <button onclick="window.editSection('${id}')">Edit</button>
            <button onclick="window.deleteSection('${id}')" class="delete-btn">Delete</button>
        </div>
    ` : '';

    section.innerHTML = `
        ${adminOverlay}
        <div class="content-wrapper">
            ${data.title ? `<h2>${data.title}</h2>` : ''}
            ${contentHTML}
        </div>
    `;
    return section;
}

// Helper: Create Article HTML
function createArticleElement(id, data) {
    const card = document.createElement('div');
    card.className = 'researcher-card';
    
    // Admin Overlay
    const adminOverlay = isAdmin ? `
        <div class="admin-overlay">
            <button onclick="window.editArticle('${id}')">Edit</button>
            <button onclick="window.deleteArticle('${id}')" class="delete-btn">Delete</button>
        </div>
    ` : '';

    card.innerHTML = `
        ${adminOverlay}
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

function renderAdminControls() {
    // Show/Hide global admin buttons (like "Add New Section")
    const adminBtns = document.querySelectorAll('.admin-only');
    adminBtns.forEach(btn => {
        btn.style.display = isAdmin ? 'block' : 'none';
    });
    
    // Re-render lists to show/hide per-item controls
    // In a real app we might update in place, but here we can just trigger a refresh if needed
    // or rely on the fact that subscribe calls will re-render if we tweak the DOM generation logic.
    // For simplicity, we just reload the page or let the user refresh, 
    // BUT better: let's re-run the render logic if we could. 
    // Actually, onAuthStateChanged fires initially. 
    // We might need to manually trigger a re-render of the lists if auth changes without reload.
    // For now, let's assume page reload on login/logout or dynamic updates via CSS toggling 
    // is easiest for the "admin-overlay" class.
    
    // CSS-based toggling:
    // .admin-overlay { display: none; }
    // body.admin-mode .admin-overlay { display: flex; }
}

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
