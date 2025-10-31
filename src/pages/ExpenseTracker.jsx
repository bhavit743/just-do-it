// src/pages/ExpenseTracker.jsx
import React, { useState } from 'react';
import { auth } from '../firebaseConfig';

// Import all Expense components
import AddExpense from '../components/Expense/AddExpense';
import FullList from '../components/Expense/FullList';
import SummaryView from '../components/Expense/SummaryView';
import ManageCategories from '../components/Expense/ManageCategories';

function ExpenseTracker() {
  const [activeSubTab, setActiveSubTab] = useState('add');
  const userId = auth.currentUser ? auth.currentUser.uid : null;

  // Tailwind classes for sub-tabs (These were already optimized for mobile text size/padding)
  const tabClasses = "py-2 px-2 text-sm md:px-3 md:text-base font-medium border-b-2 transition-colors whitespace-nowrap";
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
      case 'add':
        return <AddExpense userId={userId} />;
      case 'list':
        return <FullList userId={userId} />;
      case 'summary':
        return <SummaryView userId={userId} />;
      case 'categories':
        return <ManageCategories userId={userId} />;
      default:
        return <div>Select a sub-tab.</div>;
    }
  };

  return (
    <>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Expense Tracker</h2>
      
      {/* Sub Navigation Container (THE FIX IS HERE) */}
      {/* We are removing the outer horizontal padding (px) where possible, or reducing it to px-1 */}
      <div className="flex justify-start border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex space-x-1 px-1"> {/* 💡 FIX: Added px-1 to the inner div for minimal edge clearance */}
          
          {/* Add Expense Tab */}
          <button
            onClick={() => setActiveSubTab('add')}
            className={`${tabClasses} ${activeSubTab === 'add' ? activeClass : inactiveClass}`}
          >
            Add Expense
          </button>

          {/* Full List Tab */}
          <button
            onClick={() => setActiveSubTab('list')}
            className={`${tabClasses} ${activeSubTab === 'list' ? activeClass : inactiveClass}`}
          >
            Full List
          </button>

          {/* Summary Tab */}
          <button
            onClick={() => setActiveSubTab('summary')}
            className={`${tabClasses} ${activeSubTab === 'summary' ? activeClass : inactiveClass}`}
          >
            Summary
          </button>

          {/* Categories Tab */}
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`${tabClasses} ${activeSubTab === 'categories' ? activeClass : inactiveClass}`}
          >
            Categories
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

export default ExpenseTracker;