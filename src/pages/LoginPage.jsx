// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebaseConfig'; 
import { signInWithEmailAndPassword, getRedirectResult } from 'firebase/auth'; // Using getRedirectResult for cleanup
import { collection, query, where, getDocs, doc, setDoc, Timestamp, getDoc } from 'firebase/firestore'; 


function LoginPage() {
  const [username, setUsername] = useState(''); 
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Use useEffect to handle any potential Firebase redirect result cleanup (from a previous failed Google attempt)
  useEffect(() => {
    const handleRedirectCleanup = async () => {
        try {
            await getRedirectResult(auth);
        } catch (err) {
            console.error("Redirect cleanup error:", err);
        }
    };
    handleRedirectCleanup();
  }, []); 

  // --- 1. Username/PIN Login Handler (Insecure Spark method) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !pin) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      // 1. Find the user doc in Firestore based on username
      // (This requires the INSECURE Firestore rule: allow list: if true on /users)
      const usersRef = collection(db, 'users');
      const lowerUsername = username.trim().toLowerCase();
      
      // Query Firestore to find the user's document
      const q = query(usersRef, where('username', '==', lowerUsername)); 
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Generic error message for security
        setError('Invalid username or PIN.'); 
        setLoading(false);
        return;
      }
      
      // 2. Get the user's email from the doc
      const userDoc = querySnapshot.docs[0];
      const userEmail = userDoc.data().email;
      
      // 3. Use email and PIN (as password) to authenticate with Firebase Auth
      const password = pin; 

      await signInWithEmailAndPassword(auth, userEmail, password);

      // onAuthStateChanged in App.jsx will handle the redirect
      
    } catch (error) {
      // Catch sign-in errors (e.g., wrong password/pin)
      setError('Invalid username or PIN.');
      console.error("Login error: ", error.code);
      setLoading(false);
    }
  };

  return (
    // Tailwind structural replacement
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-sm">
        
        <div className="bg-white shadow-xl rounded-xl p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Login</h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Notification */}
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            {/* Username Field */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="username">Username</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                type="text" 
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)} 
                required
              />
            </div>
            
            {/* PIN Field */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="pin">PIN</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                type="password"
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength="6"
                minLength="6"
                pattern="\d{6}"
                title="PIN must be 6 digits"
                required
              />
            </div>
            
            {/* Submit Button (Username/PIN) */}
            <div className="pt-4">
              <button 
                type="submit" 
                className={`w-full py-3 px-4 text-white font-bold bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 transition ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={loading}
              >
                {loading ? (
                    <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24"></svg>
                        Logging In...
                    </span>
                ) : (
                    'Login'
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account? {' '}
            <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;