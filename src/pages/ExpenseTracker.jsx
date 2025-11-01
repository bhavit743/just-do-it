import React, { useState } from 'react';

// Import all Expense components
import AddExpense from '../components/Expense/AddExpense';
import FullList from '../components/Expense/FullList';
import SummaryView from '../components/Expense/SummaryView';
import ManageCategories from '../components/Expense/ManageCategories';

// Accept { userId } prop from App.jsx
function ExpenseTracker({ userId }) {
  const [activeSubTab, setActiveSubTab] = useState('add');

  // Tailwind classes
  const tabClasses = "py-2 px-2 text-sm md:px-3 md:text-base font-medium border-b-2 transition-colors whitespace-nowrap";
  const activeClass = "border-blue-600 active-text bg-blue-50";
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
        // Pass a simple onDone prop to switch tabs after saving
        return <AddExpense userId={userId} onDone={() => setActiveSubTab('list')} />;
      case 'list':
        // No special props needed. FullList handles its own editing.
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
      
      <div className="flex justify-center border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex space-x-1 px-1">
          
          {/* We just need the simple onClick again */}
          <button
            onClick={() => setActiveSubTab('add')}
            className={`${tabClasses} ${activeSubTab === 'add' ? activeClass : inactiveClass}`}
          >
            Add Expense {/* Text is simple again */}
          </button>

          <button
            onClick={() => setActiveSubTab('list')}
            className={`${tabClasses} ${activeSubTab === 'list' ? activeClass : inactiveClass}`}
          >
            Full List
          </button>

          <button
            onClick={() => setActiveSubTab('summary')}
            className={`${tabClasses} ${activeSubTab === 'summary' ? activeClass : inactiveClass}`}
          >
            Summary
          </button>

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