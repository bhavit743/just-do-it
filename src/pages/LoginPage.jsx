// src/pages/LoginPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebaseConfig'; 
import { signInWithEmailAndPassword, getRedirectResult } from 'firebase/auth'; 
import { collection, query, where, getDocs } from 'firebase/firestore'; 


function LoginPage() {
  const [username, setUsername] = useState(''); 
  const [pin, setPin] = useState(new Array(6).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPinVisible, setIsPinVisible] = useState(false); 
  const inputRefs = useRef([]); 

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

  const togglePinVisibility = () => {
    setIsPinVisible(!isPinVisible);
  };

  const handleChange = (e, index) => {
    const value = e.target.value;
    if (isNaN(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    
    if (/^\d{6}$/.test(paste)) {
      const newPin = paste.split('');
      setPin(newPin);
      inputRefs.current[5].focus(); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const pinString = pin.join(''); 

    if (!username || pinString.length !== 6) { 
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const lowerUsername = username.trim().toLowerCase();
      
      const q = query(usersRef, where('username', '==', lowerUsername)); 
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('Invalid username or PIN.'); 
        setLoading(false);
        return;
      }
      
      const userDoc = querySnapshot.docs[0];
      const userEmail = userDoc.data().email;
      
      const password = pinString; 

      await signInWithEmailAndPassword(auth, userEmail, password);
      
    } catch (error) {
      setError('Invalid username or PIN.');
      console.error("Login error: ", error.code);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6">
      
      <style>
        {`
          .pin-hidden {
            -webkit-text-security: disc;
            text-security: disc;
          }
        `}
      </style>

      <div className="w-full max-w-sm">
        
        <div className="bg-white shadow-xl rounded-xl p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Login</h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            
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
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">PIN</label>
                <button
                  type="button" 
                  onClick={togglePinVisibility}
                  className="text-gray-500 hover:text-gray-700 p-1 -mr-1" // Adjusted padding/margin for better visual alignment
                  title={isPinVisible ? 'Hide PIN' : 'Show PIN'}
                >
                  {/* --- UPDATED: Font Awesome Icons --- */}
                  {isPinVisible ? (
                    <i className="fas fa-eye text-xl"></i> // Open eye
                  ) : (
                    <i className="fas fa-eye-slash text-xl"></i> // Closed eye
                  )}
                  {/* --- END UPDATED --- */}
                </button>
              </div>
              <div className="flex justify-between gap-2" onPaste={handlePaste}>
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    className={`w-full h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                      !isPinVisible ? 'pin-hidden' : ''
                    }`}
                    type="tel" 
                    maxLength="1"
                    pattern="[0-9]"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    required
                  />
                ))}
              </div>
            </div>

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
            <Link to="/signup" className="font-medium high-text hover:text-blue-500">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;