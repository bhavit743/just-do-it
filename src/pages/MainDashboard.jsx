// src/pages/MainDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig'; 
import { doc, onSnapshot } from 'firebase/firestore'; 
import { StatusBar, Style } from '@capacitor/status-bar';

// Accept the 'user' (Auth object) as a prop from App.jsx
function MainDashboard({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Create state for the full user profile (from Firestore)
  const [userProfile, setUserProfile] = useState(null);

  // Add useEffect to listen for profile changes
  useEffect(() => {
    if (user?.uid) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        } else {
          console.log("User document not yet created...");
        }
      });
      return () => unsubscribe(); // Cleanup listener
    }
  }, [user]);

  useEffect(() => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  }, []);

  const isActive = (path) => location.pathname.startsWith(path);
  const tabClasses = "py-3 px-2 text-lg font-semibold border-b-4 whitespace-nowrap transition-colors flex justify-center items-center space-x-2"; 
  const activeClass = "border-blue-600 active-text";
  const inactiveClass = "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300";

  return (
    <div className="min-h-screen">
      
      {/* Header */}
      <header className="bg-white shadow-md">
        <div style={{ height: 'env(safe-area-inset-top)' }}></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">       
            <h1 className="text-2xl font-bold text-gray-900">JUST DO IT</h1>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => navigate('/tutorial')} 
                className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-lg shadow-sm hover:bg-blue-200 transition"
              >
                <i className="fas fa-question-circle mr-1"></i>
                How to?
              </button>
              <button 
                onClick={() => navigate('/profile')} 
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg shadow hover:bg-red-700 transition"
              >
                Profile
              </button>
            </div>
        </div>
      </header>

      {/* --- THIS IS THE TAB NAVIGATION YOU WERE MISSING --- */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 justify-center w-full"> 
            
            {/* Activity Tracker Tab */}
            <button
              onClick={() => navigate('/')}
              className={`${tabClasses} ${!isActive('/expense') ? activeClass : inactiveClass} flex-1`}
            >
              <i className="fas fa-running"></i>
              <span>Activity Tracker</span>
            </button>

            {/* Expense Tracker Tab */}
            <button
              onClick={() => navigate('/expense')}
              className={`${tabClasses} ${isActive('/expense') ? activeClass : inactiveClass} flex-1`}
            >
              <i className="fas fa-credit-card"></i>
              <span>Expense Tracker</span>
            </button>
          </div>
        </div>
      </nav>
      {/* --- END OF TAB NAVIGATION --- */}


      {/* Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-[env(safe-area-inset-bottom)]">
        <div className="bg-white shadow-xl rounded-xl p-4 sm:p-6">
          {/* Pass the auth user and the firestore profile to all children */}
          <Outlet context={{ user, userProfile }} /> 
        </div>
      </main>
    </div>
  );
}

export default MainDashboard;