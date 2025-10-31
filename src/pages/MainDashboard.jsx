// src/pages/MainDashboard.jsx
import React, {useEffect} from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { StatusBar, Style } from '@capacitor/status-bar'

function MainDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;

  const isActive = (path) => location.pathname.startsWith(path);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  useEffect(() => {
    const setStatusBarStyle = async () => {
      try {
        // 1. Ensure content is visible (set to default/light theme)
        await StatusBar.setStyle({ style: Style.Default });
        
        // 2. Hide the native status bar overlay to fully control the screen area.
        await StatusBar.hide(); 
        
      } catch (e) {
        // Ignore if running on web
      }
    };
    setStatusBarStyle();
  }, []);

  // 💡 FIX: Reduced padding (px-4) and font size (text-lg) for mobile safety.
  const tabClasses = "py-3 px-2 text-lg font-semibold border-b-4 whitespace-nowrap transition-colors flex justify-center items-center space-x-2"; 
  const activeClass = "border-blue-600 text-blue-600";
  const inactiveClass = "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300";

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Header */}
      <header className="bg-white shadow-md" style={
        {paddingTop: "3.5rem"}
      }>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center" style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>       
          <h1 className="text-2xl font-bold text-gray-900">Just do it</h1>
          <button 
            onClick={handleSignOut} 
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg shadow hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Super Navigation (Tabs equivalent) */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 💡 FIX: Reduced spacing from space-x-8 to space-x-4 and added w-full/flex-grow for equal distribution */}
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

      {/* Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 **pb-safe-bottom**">
        <div className="bg-white shadow-xl rounded-xl p-4 sm:p-6">
          <Outlet /> 
        </div>
      </main>
    </div>
  );
}

export default MainDashboard;