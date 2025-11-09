// src/components/Expense/SavingsView.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db } from '../../firebaseConfig';
// 1. ADD 'setDoc' to your imports
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import Modal from '../common/Modal'; 
import FixedDataForm from './FixedDataForm'; 

// --- IST HELPER FUNCTIONS ---
const IST_OFFSET = 19800000;

function formatToIST_YYYY_MM(date) {
  const utcMillis = new Date(date).getTime();
  const istDate = new Date(utcMillis + IST_OFFSET);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

const getCurrentMonth = () => formatToIST_YYYY_MM(new Date());

const getPreviousMonth = (dateString) => {
    const [year, month] = dateString.split('-').map(Number);
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
    }
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

const formatCurrency = (amount, currency = 'INR') => {
    const numAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: currency, 
        minimumFractionDigits: 2 
    }).format(numAmount);
};
// --- END HELPERS ---

function SavingsView() {
    const { user, userProfile } = useOutletContext();
    const userId = user?.uid;
    const userCurrency = userProfile?.currency || 'INR';

    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Monthly fixed budget state
    const [fixedBudget, setFixedBudget] = useState({ monthlyIncome: 0, monthlyFixedExpenditure: 0, netMonthlySavings: 0 });
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    
    // --- Core Data Fetch: Expenses ---
    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        const expensesQuery = query(collection(db, `users/${userId}/expenses`), orderBy("timestamp", "desc"));
        const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
            const expenseList = snapshot.docs.map(doc => ({
                ...doc.data(),
                dateString: formatToIST_YYYY_MM(doc.data().timestamp.seconds * 1000)
            }));
            setExpenses(expenseList);
            // This logic is slightly adjusted to ensure loading stops
            if (fixedBudget.fetched) setLoading(false); 
        }, (err) => { console.error("Expense Fetch Error:", err); setLoading(false); });
        
        return () => unsubExpenses();
    }, [userId]); // Removed fixedBudget from dependency array

    // --- Fixed Data Fetch: Monthly Budgets (with Fallback Logic) ---
    const fetchFixedBudget = useCallback(async (month) => {
        if (!userId) return;

        const docRef = doc(db, `users/${userId}/monthly_budgets`, month);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            setFixedBudget({ ...docSnap.data(), fetched: true });
        } else {
            const prevMonth = getPreviousMonth(month);
            const prevDocRef = doc(db, `users/${userId}/monthly_budgets`, prevMonth);
            const prevDocSnap = await getDoc(prevDocRef);

            if (prevDocSnap.exists()) {
                 const prevData = prevDocSnap.data();
                 await setDoc(docRef, prevData, { merge: true });
                 setFixedBudget({ ...prevData, fetched: true });
            } else {
                setFixedBudget({ monthlyIncome: 0, monthlyFixedExpenditure: 0, netMonthlySavings: 0, fetched: true });
            }
        }
        setLoading(false);

    }, [userId]);
    
    useEffect(() => {
        setLoading(true);
        fetchFixedBudget(selectedMonth);
    }, [selectedMonth, userId, fetchFixedBudget]);


    // --- Calculation Logic ---
    const { variableSpending, savingsPotential } = useMemo(() => {
        const filteredExpenses = expenses.filter(exp => exp.dateString === selectedMonth);
        let variableSpending = 0;
        
        filteredExpenses.forEach(exp => {
            const headcount = Number(exp.headcount) || 1;
            const userShare = (Number(exp.amount) || 0) / headcount;
            
            if (exp.category?.toUpperCase() !== 'INCOME') {
                 variableSpending += userShare;
            }
        });

        const income = Number(fixedBudget.monthlyIncome || 0);
        const fixed = Number(fixedBudget.monthlyFixedExpenditure || 0);
        const savingsPotential = income - fixed - variableSpending;

        return { variableSpending, savingsPotential };
    }, [expenses, selectedMonth, fixedBudget]);

    // --- 2. ADD THIS MISSING useEffect ---
    // This saves the calculated net savings to Firestore for the Wishlist to use
    useEffect(() => {
        // Only run if calculation is done AND the value is different from what's in DB
        if (!loading && fixedBudget.fetched && savingsPotential !== fixedBudget.netMonthlySavings) {
            const saveNetSavings = async () => {
                try {
                    const docRef = doc(db, `users/${userId}/monthly_budgets`, selectedMonth);
                    // Save the calculated net savings for this month
                    await setDoc(docRef, { 
                        netMonthlySavings: savingsPotential 
                    }, { merge: true });
                    // Update local state to prevent re-writing
                    setFixedBudget(prev => ({ ...prev, netMonthlySavings: savingsPotential }));
                } catch (e) {
                    console.error("Error saving net savings:", e);
                }
            };
            saveNetSavings();
        }
    }, [savingsPotential, fixedBudget, selectedMonth, userId, loading]);
    // --- END OF FIX ---


    if (loading) {
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Loading financial data...</p>
            </div>
        );
    }

    const isPositive = savingsPotential >= 0;
    const friendlyMonthName = new Date(`${selectedMonth}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });


    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            
            {isModalOpen && (
                <Modal title={`Set Budget for ${friendlyMonthName}`} onClose={() => setIsModalOpen(false)}>
                    <FixedDataForm
                        userId={userId}
                        initialIncome={fixedBudget.monthlyIncome}
                        initialFixedExpenses={fixedBudget.monthlyFixedExpenditure}
                        month={selectedMonth} 
                        onClose={() => {
                            fetchFixedBudget(selectedMonth); 
                            setIsModalOpen(false);
                        }}
                    />
                </Modal>
            )}

            <h2 className="text-2xl font-bold text-gray-900">Monthly Budget & Savings</h2>
            
            {/* --- Month Filter --- */}
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                <label htmlFor="month-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Month:</label>
                <input
                    type="month"
                    id="month-filter"
                    className=" sm:w-auto px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                />
            </div>

            {/* --- Calculation Summary (Your UI) --- */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <h3 className="text-xl font-semibold mb-4">Savings Summary</h3>
                <div className="space-y-3">
                    <div className="flex justify-between font-medium text-gray-700 border-b pb-2">
                        <span>Initial Budget (Income - Fixed):</span>
                        <span>{formatCurrency(fixedBudget.monthlyIncome - fixedBudget.monthlyFixedExpenditure, userCurrency)}</span>
                    </div>

                    <div className="flex justify-between text-base text-gray-600">
                        <span>(-) Variable Spending Used:</span>
                        <span className="text-red-500">{formatCurrency(variableSpending, userCurrency)}</span>
                    </div>
                    
                    <hr className="my-4" />

                    <div className={`flex justify-between font-extrabold pt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        <span>Net Monthly Savings Potential:</span>
                        <span>{formatCurrency(savingsPotential, userCurrency)}</span>
                    </div>
                </div>
            </div>

            {/* --- Budget Settings & Button (Your UI) --- */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Budget Settings for {friendlyMonthName}</h3>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 transition"
                    >
                        Set/Edit Fixed Data
                    </button>
                </div>
                
                <div className="space-y-2 border-t pt-4">
                    <div className="flex justify-between text-base text-gray-700">
                        <span>Monthly Income:</span>
                        <span className="font-semibold">{formatCurrency(fixedBudget.monthlyIncome, userCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-base text-gray-700">
                        <span>Fixed Expenses (SIP, etc.):</span>
                        <span className="font-semibold text-red-500">{formatCurrency(fixedBudget.monthlyFixedExpenditure, userCurrency)}</span>
                    </div>
                </div>
            </div>

            
        </div>
    );
}

export default SavingsView;