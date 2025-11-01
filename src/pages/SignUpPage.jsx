// src/pages/SignupPage.jsx
import React, { useState, useRef } from 'react'; // --- ADDED useRef ---
import { Link } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, writeBatch, Timestamp } from 'firebase/firestore'; 

function SignUpPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState(new Array(6).fill('')); // --- UPDATED ---
  const [confirmPin, setConfirmPin] = useState(new Array(6).fill('')); // --- UPDATED ---
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- ADDED ---
  const [isPinVisible, setIsPinVisible] = useState(false);
  const [isConfirmPinVisible, setIsConfirmPinVisible] = useState(false);
  const pinInputRefs = useRef([]);
  const confirmPinInputRefs = useRef([]);
  // --- END ADDED ---

  // --- REUSABLE HANDLERS ---
  const handleChange = (e, index, type) => {
    const value = e.target.value;
    if (isNaN(value)) return; // Only allow numbers

    const state = (type === 'pin') ? pin : confirmPin;
    const setState = (type === 'pin') ? setPin : setConfirmPin;
    const refs = (type === 'pin') ? pinInputRefs : confirmPinInputRefs;

    const newPin = [...state];
    newPin[index] = value;
    setState(newPin);

    // Move focus to next input
    if (value && index < 5) {
      refs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index, type) => {
    const state = (type === 'pin') ? pin : confirmPin;
    const refs = (type === 'pin') ? pinInputRefs : confirmPinInputRefs;

    // Move focus to previous input on backspace
    if (e.key === 'Backspace' && !state[index] && index > 0) {
      refs.current[index - 1].focus();
    }
  };

  const handlePaste = (e, type) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    if (!/^\d{6}$/.test(paste)) return; // Only paste 6 digits

    const setState = (type === 'pin') ? setPin : setConfirmPin;
    const refs = (type === 'pin') ? pinInputRefs : confirmPinInputRefs;

    setState(paste.split(''));
    refs.current[5].focus();
  };
  
  const togglePinVisibility = () => setIsPinVisible(!isPinVisible);
  const toggleConfirmPinVisibility = () => setIsConfirmPinVisible(!isConfirmPinVisible);
  // --- END REUSABLE HANDLERS ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // --- UPDATED: Join arrays to strings for comparison ---
    const pinString = pin.join('');
    const confirmPinString = confirmPin.join('');

    if (pinString !== confirmPinString) {
      setError('PINs do not match.');
      setLoading(false);
      return;
    }
    
    const lowerUsername = username.trim().toLowerCase();
    
    if (lowerUsername.length < 3) {
      setError("Username must be at least 3 characters long.");
      setLoading(false);
      return;
    }
    if (pinString.length !== 6) { // --- UPDATED ---
        setError("PIN must be 6 digits.");
        setLoading(false);
        return;
    }
    
    const usernameDocRef = doc(db, 'usernames', lowerUsername);
    
    try {
      const usernameDoc = await getDoc(usernameDocRef);
      if (usernameDoc.exists()) {
        setError('Username is already taken. Please choose another.');
        setLoading(false);
        return;
      }

      const password = pinString; // --- UPDATED ---
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

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
        errorMessage = 'PIN is too weak. Firebase requires at least 6 characters.';
      } else {
        console.error("Sign up error:", error);
      }
      setError(errorMessage);
      setLoading(false);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6">
      
      {/* --- ADDED: Inline CSS for hiding PIN --- */}
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
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Create Account</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
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
            
            {/* --- REPLACED PIN Field --- */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">6-Digit PIN</label>
                <button
                  type="button" 
                  onClick={togglePinVisibility}
                  className="text-gray-500 hover:text-gray-700 p-1 -mr-1"
                  title={isPinVisible ? 'Hide PIN' : 'Show PIN'}
                >
                  {isPinVisible ? (
                    <i className="fas fa-eye text-xl"></i>
                  ) : (
                    <i className="fas fa-eye-slash text-xl"></i>
                  )}
                </button>
              </div>
              <div className="flex justify-between gap-2" onPaste={(e) => handlePaste(e, 'pin')}>
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (pinInputRefs.current[index] = el)}
                    className={`w-full h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                      !isPinVisible ? 'pin-hidden' : ''
                    }`}
                    type="tel"
                    maxLength="1"
                    pattern="[0-9]"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleChange(e, index, 'pin')}
                    onKeyDown={(e) => handleKeyDown(e, index, 'pin')}
                    required
                  />
                ))}
              </div>
            </div>

            {/* --- REPLACED Confirm PIN Field --- */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">Confirm 6-Digit PIN</label>
                 <button
                  type="button" 
                  onClick={toggleConfirmPinVisibility}
                  className="text-gray-500 hover:text-gray-700 p-1 -mr-1"
                  title={isConfirmPinVisible ? 'Hide PIN' : 'Show PIN'}
                >
                  {isConfirmPinVisible ? (
                    <i className="fas fa-eye text-xl"></i>
                  ) : (
                    <i className="fas fa-eye-slash text-xl"></i>
                  )}
                </button>
              </div>
              <div className="flex justify-between gap-2" onPaste={(e) => handlePaste(e, 'confirmPin')}>
                {confirmPin.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (confirmPinInputRefs.current[index] = el)}
                    className={`w-full h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                      !isConfirmPinVisible ? 'pin-hidden' : ''
                    }`}
                    type="tel"
                    maxLength="1"
                    pattern="[0-9]"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleChange(e, index, 'confirmPin')}
                    onKeyDown={(e) => handleKeyDown(e, index, 'confirmPin')}
                    required
                  />
                ))}
              </div>
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