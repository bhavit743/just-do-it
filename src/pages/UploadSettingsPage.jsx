// src/pages/UploadSettingsPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';

// 1. PASTE YOUR CLOUD FUNCTION URL (from Firebase Console)
const FUNCTION_URL = "https://httpscanreceipt-lqqjyqc6rq-uc.a.run.app";

function UploadSettingsPage({ userId }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const userDocRef = useMemo(() => doc(db, 'users', userId), [userId]);

  // 2. Fetch or generate the user's secret token
  const getToken = async () => {
    setLoading(true);
    const docSnap = await getDoc(userDocRef);
    let secret = docSnap.data()?.secretUploadToken;
    
    if (!secret) {
      // Generate a new 32-character random token
      secret = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      await updateDoc(userDocRef, { secretUploadToken: secret });
    }
    setToken(secret);
    setLoading(false);
  };

  useEffect(() => {
    if (userId) {
      getToken();
    }
  }, [userId]);

  // 3. Generate the full, secret URL
  const fullUrl = `${FUNCTION_URL}?uid=${userId}&token=${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    Toast.show({ text: 'Secret URL copied to clipboard!' });
  };

  const handleRegenerate = async () => {
    if (window.confirm("This will break your old shortcut. Are you sure?")) {
      setLoading(true);
      // Generate a new token
      const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      await updateDoc(userDocRef, { secretUploadToken: newSecret });
      setToken(newSecret); // Update state
      setLoading(false);
      
      const newFullUrl = `${FUNCTION_URL}?uid=${userId}&token=${newSecret}`;
      navigator.clipboard.writeText(newFullUrl);
      Toast.show({ text: 'New URL generated and copied!' });
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-xl max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-text-dark mb-4">Background Upload</h2>
      <p className="text-sm text-text-muted mb-6">
        To save receipts in the background, copy this secret URL and 
        use it to set up an iOS Shortcut.
      </p>

      {loading ? (
        <p>Loading your secret link...</p>
      ) : (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Your Secret URL</label>
          <input 
            type="text"
            readOnly
            value={fullUrl}
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
          />
          <button
            onClick={handleCopy}
            className="w-full py-3 px-4 text-white font-bold bg-blue-600 rounded-lg shadow hover:bg-blue-700 transition"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={handleRegenerate}
            className="w-full py-2 px-4 text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition"
          >
            Regenerate (Breaks Old Shortcut)
          </button>
        </div>
      )}
    </div>
  );
}

export default UploadSettingsPage;