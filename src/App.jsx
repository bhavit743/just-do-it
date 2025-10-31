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
import { ShareReader } from '../share-reader'; 

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
  useEffect(() => {
    // Only run this listener on native platforms (iOS/Android)
    if (Capacitor.isNativePlatform()) {
      
      const listener = CapApp.addListener('appUrlOpen', async (event) => {
        console.log('App opened with URL:', event.url);
        
        // Check if the URL matches the one sent by your Share Extension
        // (Replace 'personaldash' with the actual URL scheme you defined in Xcode)
        if (event.url.startsWith('personaldash://shared-image-ready')) { 
            console.log('Share Extension URL detected. Reading images...');
            try {
                // Call your native ShareReader plugin to get image URLs
                const result = await ShareReader.getSharedImages();
                const imageUrls = result.imageUrls;
                
                if (imageUrls && imageUrls.length > 0) {
                    console.log("Received shared image URLs:", imageUrls);
                    
                    // Store the URLs temporarily for AddExpense page to read
                    // Using localStorage is simple for this cross-component communication
                    localStorage.setItem('sharedImageUrls', JSON.stringify(imageUrls));
                    
                    // Navigate to the Add Expense page
                    // Ensure the user is logged in before navigating
                    if (auth.currentUser) {
                        // Use React Router's navigate function
                        navigate('/expense', { state: { action: 'processShare', fromShare: true } }); 
                        // Optionally set activeSubTab state here if needed, or handle in ExpenseTracker
                    } else {
                        // Handle case where user isn't logged in but receives share
                        console.log("User not logged in, cannot process share yet.");
                        // Maybe store the URLs and redirect after login?
                    }

                } else {
                    console.log("No image URLs found in shared container.");
                }
            } catch (error) {
                console.error("Error reading shared images via plugin:", error);
            }
        }
      });
  
      // Cleanup listener on component unmount
      return () => {
        listener.remove();
      };
    }
  }, [navigate]); // Add navigate to dependency array

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