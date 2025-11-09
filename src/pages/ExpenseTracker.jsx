// src/pages/ExpenseTracker.jsx
import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom'; // 1. Import the hook

// Import all Expense components
import AddExpense from '../components/Expense/AddExpense';
import FullList from '../components/Expense/FullList';
import SummaryView from '../components/Expense/SummaryView';
import ManageCategories from '../components/Expense/ManageCategories';
import SavingsView from '../components/Expense/SavingsView';
import WishlistView from '../components/Expense/WishlistView';

function ExpenseTracker() {
  const [activeSubTab, setActiveSubTab] = useState('add');
  
  // 2. Get data from MainDashboard's context
  // 'user' is the auth object, 'userProfile' is the Firestore document
  const { user, userProfile } = useOutletContext(); 
  const userId = user?.uid;
  const userCurrency = userProfile?.currency || 'INR'; // Get currency

  // State for editing
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  // Tailwind classes
  const tabClasses = "py-2 px-2 text-sm md:px-3 md:text-base font-medium border-b-2 transition-colors whitespace-nowrap";
  const activeClass = "border-blue-600 active-text bg-blue-50";
  const inactiveClass = "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50";

  // Handler to open the modal (passed to FullList)
  const handleEdit = (expense) => {
    setExpenseToEdit(expense);
    // This model-based approach doesn't need to switch tabs
  };

  // Handler to close the modal (passed to EditExpenseForm)
  const handleDone = () => {
    setExpenseToEdit(null);
  };

  const renderContent = () => {
    if (!userId) {
      return (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          Error: User not logged in.
        </div>
      );
    }
    
    // 3. Pass the correct props down
    switch (activeSubTab) {
      case 'add':
        return <AddExpense userId={userId} onDone={() => setActiveSubTab('list')} />;
      case 'list':
        // FullList will now receive the userId and userCurrency
        return <FullList userId={userId} userCurrency={userCurrency} />;
      case 'summary':
         // SummaryView will now receive the userId and userCurrency
        return <SummaryView userId={userId} userCurrency={userCurrency} />;
      case 'categories':
        return <ManageCategories userId={userId} />;
        case 'savings': // <-- NEW CASE
        return <SavingsView />
        case 'wishlist': // <-- NEW CASE
        return <WishlistView />;
      default:
        return <div>Select a sub-tab.</div>;
    }
  };

  return (
    <>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Expense Tracker</h2>
      
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto" style={{paddingLeft: 0.5+'rem'}}>
        <div className="flex space-x-1 px-1">
          
          <button
            onClick={() => setActiveSubTab('add')}
            className={`${tabClasses} ${activeSubTab === 'add' ? activeClass : inactiveClass}`}
          >
            Add Expense
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
          <button
            onClick={() => setActiveSubTab('savings')}
            className={`${tabClasses} ${activeSubTab === 'savings' ? activeClass : inactiveClass}`}
          >
            Savings View
          </button>
          <button
            onClick={() => setActiveSubTab('wishlist')} // <-- NEW TAB
            className={`${tabClasses} ${activeSubTab === 'wishlist' ? activeClass : inactiveClass}`}
          >
            Wishlist
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