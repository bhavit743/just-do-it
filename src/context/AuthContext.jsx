import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; // Import from your firebase.js

// Create the context
const AuthContext = createContext();

// Create a hook to use the context
export function useAuth() {
  return useContext(AuthContext);
}

// Create the provider component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // To check if auth state is loaded

  // --- SIGN UP FUNCTION ---
  async function signUp(email, pin, username) {
    // 1. Check if username is already taken in Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new Error("Username is already taken.");
    }

    // 2. If username is unique, create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, pin);
    
    // 3. Create the user document in Firestore to store the username
    await setDoc(doc(db, "users", userCredential.user.uid), {
      username: username,
      email: email,
    });

    return userCredential;
  }

  // --- LOG IN FUNCTION ---
  async function logIn(username, pin) {
    // 1. Find the user's email from their username in Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("Invalid username or PIN.");
    }

    // 2. Get the user's email
    const userEmail = querySnapshot.docs[0].data().email;

    // 3. Sign in with the found email and the provided PIN
    try {
      return await signInWithEmailAndPassword(auth, userEmail, pin);
    } catch (error) {
      // Catch auth errors (like wrong password)
      throw new Error("Invalid username or PIN.");
    }
  }

  // --- LOG OUT FUNCTION ---
  function logOut() {
    return signOut(auth);
  }

  // --- AUTH STATE LISTENER ---
  useEffect(() => {
    // This listener runs when the component mounts and on auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false); // Auth state is now loaded
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  // Values to be provided by the context
  const value = {
    currentUser,
    loading, // So components can wait for auth state
    signUp,
    logIn,
    logOut,
  };

  // We only render the rest of the app once the auth state has been checked (loading is false)
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
