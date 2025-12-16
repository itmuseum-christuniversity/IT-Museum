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
const loginModal = document.getElementById('admin-login-modal');

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
        window.location.href = 'admin.html'; // Redirect to admin panel
    } catch (error) {
        console.error("Login failed", error);
        alert("Login failed: " + error.message);
    }
}

export async function logoutAdmin() {
    try {
        await signOut(auth);
        alert("Logged out!");
        window.location.href = 'index.html';
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
    
    if(!container) return;

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const sectionEl = createSectionElement(doc.id, data);
            container.appendChild(sectionEl);
        });
    });
}

// Render Collections (Was Articles)
export function subscribeToCollections(containerId) {
    const q = query(collection(db, "collections"), orderBy("date", "desc"));
    const container = document.getElementById(containerId);

    if(!container) return;

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: #666; padding: 2rem;">No collections added yet.</p>';
        }
        snapshot.forEach((doc) => {
            const data = doc.data();
            const el = createCollectionElement(doc.id, data);
            container.appendChild(el);
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
    
    const pdfHTML = data.pdfUrl ? `
        <div style="margin-top: 1rem;">
            <a href="${data.pdfUrl}" target="_blank" style="display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: #8E24AA; color: white; text-decoration: none; border-radius: 5px; font-weight: 500;">
                <span style="margin-right: 8px;">📄</span> View PDF Document
            </a>
        </div>
    ` : '';

    section.innerHTML = `
        <div class="content-wrapper">
            ${data.title ? `<h2>${data.title}</h2>` : ''}
            ${imageHTML}
            ${contentHTML}
            ${pdfHTML}
        </div>
    `;
    return section;
}

// Helper: Create Collection Element
function createCollectionElement(id, data) {
    const card = document.createElement('div');
    card.className = 'researcher-card';
    card.onclick = () => {
         // Optional: expand or show details
    };
    
    const imageHTML = data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.title}">` : '';
    
    const pdfHTML = data.pdfUrl ? `
        <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
            <a href="${data.pdfUrl}" target="_blank" style="color: #8E24AA; font-size: 0.9em; text-decoration: none; display: flex; align-items: center; font-weight: 600;">
                <span style="margin-right: 5px;">📄</span> View PDF
            </a>
        </div>
    ` : '';

    card.innerHTML = `
        ${imageHTML}
        <div class="card-content">
            <h3>${data.title}</h3>
            ${data.subtitle ? `<p class="subtitle">${data.subtitle}</p>` : ''}
            ${pdfHTML}
            <p>${data.summary || (data.content ? data.content.substring(0, 150) + '...' : '')}</p>
        </div>
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
