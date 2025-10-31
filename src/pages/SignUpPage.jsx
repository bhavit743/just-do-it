// src/pages/SignupPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, writeBatch, Timestamp } from 'firebase/firestore'; 

function SignUpPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      setLoading(false);
      return;
    }
    
    const lowerUsername = username.trim().toLowerCase();
    
    // Basic Input Validation
    if (lowerUsername.length < 3) {
      setError("Username must be at least 3 characters long.");
      setLoading(false);
      return;
    }
    if (pin.length !== 6) {
        setError("PIN must be 6 digits.");
        setLoading(false);
        return;
    }
    
    // Check if username is already taken
    const usernameDocRef = doc(db, 'usernames', lowerUsername);
    
    try {
      const usernameDoc = await getDoc(usernameDocRef);
      if (usernameDoc.exists()) {
        setError('Username is already taken. Please choose another.');
        setLoading(false);
        return;
      }

      // Create user in Firebase Auth. (This step also checks for email duplication)
      const password = pin; 
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user's info to Firestore in a batch
      const batch = writeBatch(db);
      const userDocRef = doc(db, 'users', user.uid);
      
      batch.set(userDocRef, {
        username: lowerUsername,
        email: user.email,
        createdAt: Timestamp.now()
      });
      batch.set(doc(db, 'usernames', lowerUsername), {
        email: user.email,
        uid: user.uid
      });

      await batch.commit();
      setLoading(false);

    } catch (error) {
      let errorMessage = 'Failed to create account.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already in use.';
      } else if (error.code === 'auth/weak-password') {
        // This is still a risk if the user sets a weak PIN
        errorMessage = 'PIN is too weak. Firebase requires at least 6 characters.';
      } else {
        console.error("Sign up error:", error);
      }
      setError(errorMessage);
      setLoading(false);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-sm">
        
        <div className="bg-white shadow-xl rounded-xl p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Create Account</h1>

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
            
            {/* Email Field */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="email">Email</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            {/* PIN Field */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="pin">6-Digit PIN</label>
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

            {/* Confirm PIN Field */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="confirmPin">Confirm 6-Digit PIN</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                type="password"
                id="confirmPin"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                maxLength="6"
                minLength="6"
                pattern="\d{6}"
                title="PIN must be 6 digits"
                required
              />
            </div>
            
            {/* Submit Button */}
            <div className="pt-4">
              <button 
                type="submit" 
                className={`w-full py-3 px-4 text-white font-bold bg-green-600 rounded-lg shadow-lg hover:bg-green-700 transition ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={loading}
              >
                {loading ? (
                    <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24"></svg>
                        Signing Up...
                    </span>
                ) : (
                    'Sign Up'
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account? {' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;