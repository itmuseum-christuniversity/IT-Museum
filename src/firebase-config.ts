import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCHGoYNndFtq00JOKpdfBI8645uxwzrxVw",
    authDomain: "it-museum.firebaseapp.com",
    projectId: "it-museum",
    storageBucket: "it-museum.firebasestorage.app",
    messagingSenderId: "49569676822",
    appId: "1:49569676822:web:c85d338f174ae336493f37",
    measurementId: "G-4XX95MCY6D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage, analytics };
