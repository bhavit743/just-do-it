// src/pages/ActivityTracker.jsx
import React, { useState } from 'react';
import { auth } from '../firebaseConfig';

import TodayActivity from '../components/Activity/TodayActivity';
import CalendarView from '../components/Activity/CalendarView';
import ManageKPIs from '../components/Activity/ManageKPIs';
import StreaksView from '../components/Activity/StreaksView';

function ActivityTracker() {
  const [activeSubTab, setActiveSubTab] = useState('today');
  const userId = auth.currentUser ? auth.currentUser.uid : null;

  // 💡 FIX: Adjusted tab classes for better mobile fit.
  const tabClasses = "py-2 px-2 sm:px-3 text-sm md:text-base font-medium border-b-2 transition-colors whitespace-nowrap";
  const activeClass = "border-blue-600 text-blue-600 bg-blue-50";
  const inactiveClass = "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50";

  const renderContent = () => {
    if (!userId) {
      return (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          Error: User not logged in.
        </div>
      );
    }
    
    switch (activeSubTab) {
      case 'today':
        return <TodayActivity userId={userId} />;
      case 'calendar':
        return <CalendarView userId={userId} />;
      case 'streaks':
        return <StreaksView userId={userId} />;
      case 'manage':
        return <ManageKPIs userId={userId} />;
      default:
        return <div>Select a sub-tab.</div>;
    }
  };

  return (
    <>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Activity Tracker</h2>
      
      {/* Sub Navigation (The Fix is applied here) */}
      <div className="flex justify-center border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex space-x-1">
          {/* Today Tab */}
          <button
            onClick={() => setActiveSubTab('today')}
            className={`${tabClasses} ${activeSubTab === 'today' ? activeClass : inactiveClass}`}
          >
            Today
          </button>

          {/* Calendar Tab */}
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`${tabClasses} ${activeSubTab === 'calendar' ? activeClass : inactiveClass}`}
          >
            Calendar
          </button>

          {/* Streaks Tab */}
          <button
            onClick={() => setActiveSubTab('streaks')}
            className={`${tabClasses} ${activeSubTab === 'streaks' ? activeClass : inactiveClass}`}
          >
            Streaks
          </button>

          {/* Manage KPIs Tab */}
          <button
            onClick={() => setActiveSubTab('manage')}
            className={`${tabClasses} ${activeSubTab === 'manage' ? activeClass : inactiveClass}`}
          >
            Manage KPIs
          </button>
        </div>
      </div>

      {/* Content Box */}
      <div className="p-0">
        {renderContent()}
      </div>
    </>
  );
}

export default ActivityTracker;