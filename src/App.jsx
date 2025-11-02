// src/App.jsx
import React, { useState, useEffect } from 'react';
// 💡 Removed unused 'useNavigate'
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// --- Capacitor Imports ---
import { App as CapApp } from '@capacitor/app'; // For listening to app events
import { Capacitor } from '@capacitor/core'; // To check platform

// --- Page Imports ---
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage.JSX'; // 💡 Corrected file extension
import MainDashboard from './pages/MainDashboard';
import LoadingSpinner from './components/LoadingSpinner';
import ActivityTracker from './pages/ActivityTracker';
import ExpenseTracker from './pages/ExpenseTracker';
import BatchUploadPage from './components/Expense/BatchUploadPage'; // 💡 Corrected import path
import UploadSettingsPage from './pages/UploadSettingsPage';
import ProfilePage from './pages/ProfilePage';
import TutorialPage from './pages/TutorialPage';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
 
  // --- 1. Firebase Auth State Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Loading State ---
  if (loading) {
    return <LoadingSpinner />;
  }

  // --- Main Routing ---
  return (
    <Routes>
      {/* Protected Layout Route */}
      <Route 
        path="/" 
        // Pass the user prop to the layout component (for Navbar, etc.)
        element={currentUser ? <MainDashboard user={currentUser} /> : <Navigate to="/login" />} 
      >
        {/* Pass the userId as a prop to each nested route.
          MainDashboard's <Outlet> will render the correct component with this prop.
        */}
        <Route index element={<ActivityTracker userId={currentUser?.uid} />} /> 
        <Route path="expense" element={<ExpenseTracker userId={currentUser?.uid} />} /> 
        <Route 
          path="batch-upload" 
          element={<BatchUploadPage userId={currentUser?.uid} />} 
        />
      </Route>
    
      {/* Auth routes */}
      <Route 
        path="/login" 
        element={currentUser ? <Navigate to="/" /> : <LoginPage />} 
      />
      <Route 
        path="/signup" 
        element={currentUser ? <Navigate to="/" /> : <SignUpPage />} 
      />
      <Route 
          path="settings" 
          element={<UploadSettingsPage userId={currentUser?.uid} />} 
        />
        <Route 
          path="profile" 
          element={<ProfilePage userId={currentUser?.uid} />} 
        />
        <Route 
          path="tutorial"
          element={<TutorialPage />} 
        />
    </Routes>
  );
}

export default App;