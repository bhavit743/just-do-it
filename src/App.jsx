// src/App.jsx
import React, { useState, useEffect } from 'react';
// 💡 Corrected import to use useNavigate for navigation
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

// --- Capacitor Imports ---
import { App as CapApp } from '@capacitor/app'; // For listening to app events
import { Capacitor } from '@capacitor/core'; // To check platform

// --- Custom Plugin Import ---
// 💡 Make sure the path to your compiled plugin is correct

// --- Page Imports ---
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage.JSX'; // Corrected filename casing
import MainDashboard from './pages/MainDashboard';
import LoadingSpinner from './components/LoadingSpinner';
import ActivityTracker from './pages/ActivityTracker';
import ExpenseTracker from './pages/ExpenseTracker';


function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Hook for navigation
  
 
  // --- 1. Firebase Auth State Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Share Extension Listener ---

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
        element={currentUser ? <MainDashboard /> : <Navigate to="/login" />} 
      >
        {/* Nested Routes for Super Navigation */}
        <Route index element={<ActivityTracker />} /> 
        <Route path="expense" element={<ExpenseTracker />} /> 
        {/* Note: If ExpenseTracker uses nested routes, update path="expense/*" */}
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
    </Routes>
  );
}

export default App;