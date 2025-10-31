// src/components/Expense/FullList.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, Timestamp } from 'firebase/firestore';

// Utility to get current month in YYYY-MM format
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// Utility to format currency (assuming INR, matches your previous logic)
const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(numAmount);
};

// Utility function to get the base Tailwind color for a category tag
const getCategoryColor = (categoryName) => {
    switch (categoryName.toUpperCase()) {
        case 'FOOD': return 'bg-yellow-100 text-yellow-800';
        case 'TRANSPORT': return 'bg-blue-100 text-blue-800';
        case 'RENT': return 'bg-purple-100 text-purple-800';
        case 'BILLS': return 'bg-red-100 text-red-800';
        case 'INCOME': return 'bg-green-100 text-green-800'; // For contrast, treating Income as a distinct color
        default: return 'bg-gray-200 text-gray-700';
    }
};

function FullList({ userId }) {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    
    // 1. Fetch Expenses in Real-Time
    useEffect(() => {
        if (!userId) return;

        const expensesQuery = query(
            collection(db, `users/${userId}/expenses`),
            orderBy("timestamp", "desc") // Newest first
        );

        const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
            const expenseList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setExpenses(expenseList);
            setLoading(false);
        }, (err) => {
            console.error("Expense Fetch Error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    // 2. Filter Expenses by Selected Month
    const filteredExpenses = expenses.filter(expense => {
        if (!expense.timestamp || typeof expense.timestamp.seconds !== 'number') return false;
        
        const date = new Date(expense.timestamp.seconds * 1000);
        const expenseMonth = date.toISOString().slice(0, 7); // Get YYYY-MM
        
        return expenseMonth === selectedMonth;
    });

    // 3. Handle Deletion
    const handleDeleteExpense = async (expenseId, payerName) => {
        if (!window.confirm(`Delete transaction for "${payerName}"? This cannot be undone.`)) return;
        try {
            const expenseDocRef = doc(db, `users/${userId}/expenses/${expenseId}`);
            await deleteDoc(expenseDocRef);
            // State will update automatically via the onSnapshot listener
        } catch (e) {
            console.error("Error deleting expense: ", e);
            alert("Failed to delete transaction.");
        }
    };


    if (loading) {
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Loading transactions...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            
            {/* Header and Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 md:mb-0">All Transactions</h3>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <label htmlFor="month-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Month:</label>
                    <input
                        type="month"
                        id="month-filter"
                        className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                </div>
            </div>

            {/* Transaction List */}
            {filteredExpenses.length === 0 ? (
                <div className="p-6 bg-yellow-50 text-yellow-800 rounded-lg shadow-md text-center">
                    <p className="font-semibold">No expenses found for {selectedMonth}.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredExpenses.map((expense) => {
                        const date = new Date(expense.timestamp.seconds * 1000);
                        const friendlyDate = date.toLocaleDateString(undefined, { dateStyle: 'medium' });
                        const categoryName = (expense.category || 'UNCATEGORIZED').toUpperCase();
                        const categoryColor = getCategoryColor(categoryName);
                        
                        return (
                            <div key={expense.id} className="flex justify-between items-center p-4 bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition">
                                
                                {/* Left Side: Payer, Date, Category */}
                                <div className="flex flex-col space-y-1 overflow-hidden pr-2">
                                    <p className="text-lg font-bold text-gray-900 truncate">{expense.payerName || 'Unknown Payer'}</p>
                                    <p className="text-sm text-gray-500">{friendlyDate}</p>
                                    <span className={`inline-flex self-start px-3 py-1 text-xs font-medium rounded-full ${categoryColor}`}>
                                        {categoryName}
                                    </span>
                                </div>
                                
                                {/* Right Side: Amount and Delete */}
                                <div className="flex items-center space-x-4">
                                    <span className={`text-xl font-extrabold ${categoryName === 'INCOME' ? 'text-green-600' : 'text-red-600'} whitespace-nowrap`}>
                                        {categoryName === 'INCOME' ? '+' : '-'}{formatCurrency(expense.amount)}
                                    </span>
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