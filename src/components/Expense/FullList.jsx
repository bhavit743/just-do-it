import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { CSVLink } from 'react-csv';

// --- IMPORT Modal AND THE NEW EditExpenseForm ---
import Modal from '../Common/Modal';
import EditExpenseForm from './EditExpenseForm';

// --- IST HELPER FUNCTIONS (Unchanged) ---
const IST_OFFSET = 19800000; // 5.5 * 3600 * 1000

function formatToIST_YYYY_MM(date) {
  const utcMillis = new Date(date).getTime();
  const istDate = new Date(utcMillis + IST_OFFSET);
  
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  
  return `${year}-${month}`;
}

function formatToIST_YYYY_MM_DD(date) {
  const utcMillis = new Date(date).getTime();
  const istDate = new Date(utcMillis + IST_OFFSET);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
// --- END OF IST HELPERS ---

// Utility to get current month in YYYY-MM format
const getCurrentMonth = () => formatToIST_YYYY_MM(new Date());

// Utility to format currency
const formatCurrency = (amount, currency = 'INR') => {
    const numAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: currency, 
        minimumFractionDigits: 2 
    }).format(numAmount);
};

function FullList({ userId, userCurrency }) {
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [expenseToEdit, setExpenseToEdit] = useState(null);
    // REMOVED: const [splitFilter, setSplitFilter] = useState('all');

    // Handle Deletion (Unchanged)
    const handleDeleteExpense = async (expenseId, payerName) => {
        if (!window.confirm(`Delete transaction for "${payerName}"? This cannot be undone.`)) return;
        try {
            const expenseDocRef = doc(db, `users/${userId}/expenses/${expenseId}`);
            await deleteDoc(expenseDocRef);
        } catch (e) {
            console.error("Error deleting expense: ", e);
            alert("Failed to delete transaction.");
        }
    };

    // Handle Done Editing (Unchanged)
    const handleDoneEditing = () => {
        setExpenseToEdit(null);
    };

    // --- Data Fetching (Unchanged) ---
    useEffect(() => {
        if (!userId) return; 
        setLoading(true);

        let expensesLoaded = false;
        let categoriesLoaded = false;

        const checkLoadingDone = () => {
            if (expensesLoaded && categoriesLoaded) {
                setLoading(false);
            }
        }

        // Fetch Expenses
        const expensesQuery = query(
            collection(db, `users/${userId}/expenses`),
            orderBy("timestamp", "desc")
        );
        const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
            const expenseList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setExpenses(expenseList);
            expensesLoaded = true;
            checkLoadingDone();
        }, (err) => {
            console.error("Expense Fetch Error:", err);
            setLoading(false);
        });

        // Fetch Categories
        const categoriesQuery = query(collection(db, `users/${userId}/categories`));
        const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
            const catList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(catList);
            categoriesLoaded = true;
            checkLoadingDone();
        }, (err) => {
            console.error("Category Fetch Error:", err);
            setLoading(false);
        });

        return () => {
            unsubscribeExpenses();
            unsubscribeCategories();
        };
    }, [userId]);

    // Filter Expenses (REVERTED to only Month Filter)
    const filteredExpenses = expenses.filter(expense => {
        // Only Month Filter remains
        if (!expense.timestamp || typeof expense.timestamp.seconds !== 'number') return false;
        const expenseMonth = formatToIST_YYYY_MM(expense.timestamp.seconds * 1000);
        return expenseMonth === selectedMonth;
    });

    // --- Color lookup map (Unchanged) ---
    const categoriesMap = useMemo(() => {
        return Object.fromEntries(
            categories.map(cat => [cat.name, cat.color || '#6B7280'])
        );
    }, [categories]);
    
    // --- Prepare data for CSV export (REVERTED to Headcount/Simple Split) ---
    const csvData = useMemo(() => {
        // Revert headers to match the simple headcount model
        const headers = ["Date", "Merchant", "Category", "Total Amount", "Split By", "Your Share"];
        
        const data = filteredExpenses.map(expense => {
            const date = formatToIST_YYYY_MM_DD(expense.timestamp.seconds * 1000);
            
            // Revert back to headcount logic
            const headcount = Number(expense.headcount) || 1; 
            const userShare = (Number(expense.amount) || 0) / headcount;

            return [
                date,
                expense.payerName,
                expense.category,
                expense.amount,
                headcount, // Revert to using headcount
                userShare
            ];
        });
        
        return [headers, ...data];
    }, [filteredExpenses]);


    if (loading) {
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Loading transactions...</p>
            </div>
        );
    }

    // Helper function for button styling (REMOVED)

    return (
        <div className="space-y-6">
            
            {/* --- Header and Filter --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 md:mb-0">All Transactions</h3>
                
                {/* Right side container */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                    {/* Month Filter */}
                    <div className="flex items-center gap-2">
                        <label htmlFor="month-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">Month:</label>
                        <input
                            type="month"
                            id="month-filter"
                            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                    
                    {/* CSV Export Button */}
                    <CSVLink
                        data={csvData}
                        filename={`Expenses-${selectedMonth}.csv`}
                        className="px-4 py-2 text-sm text-center font-medium text-white bg-green-600 rounded-lg shadow hover:bg-green-700 transition"
                    >
                        <i className="fas fa-download mr-2"></i>
                        Export CSV
                    </CSVLink>
                </div>
            </div>
            
            {/* REMOVED: SPLIT TOGGLE FILTER */}


            {/* Modal (Unchanged) */}
            {expenseToEdit && (
                <Modal title="Edit Transaction" onClose={handleDoneEditing}>
                    <EditExpenseForm 
                        userId={userId}
                        expenseToEdit={expenseToEdit}
                        onDone={handleDoneEditing} 
                    />
                </Modal>
            )}

            {/* Transaction List (REVERTED to Headcount Logic) */}
            {filteredExpenses.length === 0 ? (
                <div className="p-6 bg-yellow-50 text-yellow-800 rounded-lg shadow-md text-center">
                    <p className="font-semibold">No expenses found for {selectedMonth}.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredExpenses.map((expense) => {
                        // Use basic headcount/yourShare calculation
                        const headcount = Number(expense.headcount) || 1;
                        // Determine if it was split for display
                        const isSplitExpense = headcount > 1; 
                        const userShare = (Number(expense.amount) || 0) / headcount;

                        const istDate = new Date(expense.timestamp.seconds * 1000 + IST_OFFSET);
                        const friendlyDate = istDate.toLocaleDateString('en-IN', { 
                            dateStyle: 'medium', 
                            timeZone: 'UTC' 
                        });
                        
                        const categoryName = (expense.category || 'UNCATEGORIZED').toUpperCase();
                        const categoryColor = categoriesMap[categoryName] || '#6B7280';
                        
                        return (
                            <div key={expense.id} className="flex justify-between items-center p-4 bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition">
                                
                                <div className="flex flex-col space-y-1 overflow-hidden pr-2">
                                    <p className="text-lg font-bold text-gray-900 truncate">{expense.payerName || 'Unknown Payer'}</p>
                                    <p className="text-sm text-gray-500">{friendlyDate}</p>
                                    
                                    <div className="flex items-center space-x-2">
                                        <span 
                                            className="inline-flex self-start px-3 py-1 text-xs font-medium rounded-full"
                                            style={{ 
                                                backgroundColor: `${categoryColor}20`,
                                                color: categoryColor,
                                                borderRadius:'0.3rem'
                                            }}
                                        >
                                            {categoryName}
                                        </span>
                                        {/* Re-add simple split flag for headcount > 1 */}
                                        {isSplitExpense && (
                                            <span className="text-xs font-bold text-gray-600 px-3 py-1 bg-gray-200 rounded-full">
                                                Split x{headcount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-2 sm:space-x-4">
                                <div className="flex flex-col items-end">
                                        <span className={`text-xl font-extrabold ${categoryName === 'INCOME' ? 'text-green-600' : 'text-red-600'} whitespace-nowrap`}>
                                            {categoryName === 'INCOME' ? '+' : '-'}{formatCurrency(userShare, userCurrency)}
                                        </span>
                                        {isSplitExpense && (
                                            <span className="text-xs text-gray-500 font-medium">
                                                (Total: {formatCurrency(expense.amount, userCurrency)})
                                            </span>
                                        )}
                                    </div>
                                    
                                    <button
                                        onClick={() => setExpenseToEdit(expense)} 
                                        className="p-2 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        title="Edit Transaction"
                                    >
                                        <i className="fas fa-pencil-alt text-sm"></i>
                                    </button>

                                    <button
                                        onClick={() => handleDeleteExpense(expense.id, expense.payerName)}
                                        className="p-2 text-red-500 bg-red-100 rounded-full hover:bg-red-200 transition focus:outline-none focus:ring-2 focus:ring-red-500"
                                        title="Delete Transaction"
                                    >
                                        <i className="fas fa-trash-alt text-sm"></i>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default FullList;