// src/pages/ProfilePage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebaseConfig'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth'; 
import { Toast } from '@capacitor/toast';
import { StatusBar, Style } from '@capacitor/status-bar';

// PASTE YOUR CLOUD FUNCTION URL
const FUNCTION_URL = "https://httpscanreceipt-lqqjyqc6rq-uc.a.run.app/httpScanReceipt";

function ProfilePage({ userId }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('...');
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // --- 1. STATE FOR PREFERENCES ---
  const [currency, setCurrency] = useState('INR'); // Default to INR
  const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'success', 'error'

  const userDocRef = useMemo(() => {
    if (userId) {
      return doc(db, 'users', userId);
    }
    return null;
  }, [userId]);

  // Set Status Bar
  useEffect(() => {
    const setStatusBarStyle = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (e) {
        // Ignore if running on web
      }
    };
    setStatusBarStyle();
  }, []);

  // --- 2. UPDATED: Fetch username, token, AND currency ---
  useEffect(() => {
    const getData = async () => {
      if (!userDocRef) return; 
      setLoading(true);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        setLoading(false);
        return;
      }
      
      const data = docSnap.data();
      setUsername(data.username || 'User');
      setCurrency(data.currency || 'INR'); // <-- Load saved currency
      
      let secret = data.secretUploadToken;
      if (!secret) {
        secret = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
        await updateDoc(userDocRef, { secretUploadToken: secret });
      }
      setToken(secret);
      setLoading(false);
    };

    getData();
  }, [userId, userDocRef]); 

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };
  
  const fullUrl = `${FUNCTION_URL}?uid=${userId}&token=${token}`;

  // Copy handler
  const handleCopy = async () => {
    if (!navigator.clipboard) {
      Toast.show({ text: 'Copying is not supported on this browser.', duration: 'long' });
      return;
    }
    try {
      await navigator.clipboard.writeText(fullUrl);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      Toast.show({ text: 'Failed to copy link.', duration: 'long' });
    }
  };

  // Regenerate token handler
  const handleRegenerate = async () => {
    if (window.confirm("This will break your old shortcut. Are you sure?")) {
      setLoading(true);
      const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      await updateDoc(userDocRef, { secretUploadToken: newSecret });
      setToken(newSecret);
      setLoading(false);
      
      const newFullUrl = `${FUNCTION_URL}?uid=${userId}&token=${newSecret}`;
      await navigator.clipboard.writeText(newFullUrl);
      Toast.show({ text: 'New URL generated and copied!' });
    }
  };

  // --- 3. ADDED: Save Preferences Handler ---
  const handleSavePreferences = async () => {
    if (!userDocRef) return;
    setSaveStatus('saving');
    try {
      await updateDoc(userDocRef, {
        currency: currency // Save the selected currency
      });
      setSaveStatus('success');
      Toast.show({ text: 'Preferences saved!' });
      setTimeout(() => setSaveStatus(null), 2000); // Reset button text
    } catch (err) {
      console.error("Error saving settings: ", err);
      setSaveStatus('error');
      Toast.show({ text: 'Failed to save settings.', duration: 'long' });
    }
  };

  return (
      

        <div className="bg-white p-6 rounded-xl shadow-xl">
          <h2 className="text-3xl font-bold text-text-dark mb-2 capitalize">
            Welcome, {username}
          </h2>
          <p className="text-sm text-text-muted mb-6">
            Manage your account settings and background upload link.
          </p>

          {/* --- 4. ADDED: Preferences Section --- */}
          <hr className="my-6" />
          <h3 className="text-xl font-semibold text-text-dark mb-4">Preferences</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700">Your Currency</label>
              <select
                id="currency"
                name="currency"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                {/* Add more currencies as needed */}
              </select>
            </div>
            <button
              onClick={handleSavePreferences}
              disabled={saveStatus === 'saving'}
              className={`w-full py-3 px-4 text-white font-bold rounded-lg shadow transition ${
                saveStatus === 'saving' ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {saveStatus === 'saving' ? (
                <span className="flex items-center justify-center">
                  <i className="fas fa-spinner animate-spin mr-2"></i>
                  Saving...
                </span>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>

          <hr className="my-6" />

          {/* Background Upload Shortcut */}
          <h3 className="text-xl font-semibold text-text-dark mb-4">Background Upload Shortcut</h3>
          <p className="text-sm text-text-muted mb-4">
            Follow these steps to save receipts in the background from your share sheet.
          </p>
          <div className="space-y-2 mb-6">
            <h4 className="text-lg font-medium text-gray-800">Part A: Get the Shortcut</h4>
            <a 
              href="https://www.icloud.com/shortcuts/326201108de4429293c197dbd719d6e7" // <-- REPLACE THIS WITH YOUR LINK
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block w-full py-3 px-4 text-white font-bold bg-blue-600 rounded-lg shadow hover:bg-blue-700 transition text-center"
            >
              <i className="fas fa-plus-circle mr-2"></i>
              Add the iOS Shortcut
            </a>
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-800">Part B: Configure the Shortcut</h4>
            {loading ? (
              <p>Loading your secret link...</p>
            ) : (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                <label className="block text-sm font-medium text-gray-700">Your Secret URL</label>
                <input 
                  type="text"
                  readOnly
                  value={fullUrl}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 text-sm"
                />
                <button
                  onClick={handleCopy}
                  disabled={isCopied}
                  className={`w-full py-3 px-4 text-white font-bold rounded-lg shadow transition ${
                    isCopied
                      ? 'bg-green-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isCopied ? (
                    <span className="flex items-center justify-center">
                      <i className="fas fa-check mr-2"></i>
                      Copied!
                    </span>
                  ) : (
                    'Copy to Clipboard'
                  )}
                </button>
                <button
                  onClick={handleRegenerate}
                  className="w-full py-2 px-4 text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition"
                >
                  Regenerate (Breaks Old Shortcut)
                </button>
              </div>
            )}
            <div className="pt-4">
              <h4 className="text-lg font-medium text-gray-800">Editing Steps</h4>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700 mt-2">
                <li>After copying your URL, open the Shortcuts app on your iPhone.</li>
                <li>Find the "Scan" shortcut and tap the three dots (...) to edit it.</li>
                <li>Find the first action, which is a "Text" box.</li>
                <li>Delete the placeholder text in the box.</li>
                <li>Paste your secret URL.</li>
                <li>Tap "Done".</li>
              </ol>
            </div>
          </div>
          {/* --- END OF UPDATED SECTION --- */}

          <hr className="my-6" />
          <button
            onClick={handleSignOut}
            className="w-full py-3 px-4 text-white font-bold bg-red-600 rounded-lg shadow hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
  );
}

export default ProfilePage;