import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { GoogleAuthProvider } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDG8pO2KucJ6qDwb7Nu3EfjDP2VBPCZNSw",
    authDomain: "bachelors-vs-life.firebaseapp.com",
    projectId: "bachelors-vs-life",
    storageBucket: "bachelors-vs-life.firebasestorage.app",
    messagingSenderId: "90104795967",
    appId: "1:90104795967:web:ed43e643e160200245798a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services you'll use
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
export const googleProvider = new GoogleAuthProvider();