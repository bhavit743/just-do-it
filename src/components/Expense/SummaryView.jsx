// src/components/Expense/SummaryView.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

// 1. Import necessary Chart.js components
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register Chart.js elements
ChartJS.register(ArcElement, Tooltip, Legend);

// --- 1. ADD IST HELPER FUNCTIONS ---
const IST_OFFSET = 19800000; // 5.5 * 3600 * 1000

function formatToIST_YYYY_MM(date) {
  const utcMillis = new Date(date).getTime();
  const istDate = new Date(utcMillis + IST_OFFSET);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
// --- END OF IST HELPERS ---


// Utility functions
const getCurrentMonth = () => formatToIST_YYYY_MM(new Date()); // Use IST for default month

// --- 2. UPDATE formatCurrency to accept currency ---
const formatCurrency = (amount, currency = 'INR') => {
    const numAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: currency, 
        minimumFractionDigits: 2 
    }).format(numAmount);
};

// --- 3. ACCEPT userCurrency prop ---
function SummaryView({ userId, userCurrency }) {
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [summary, setSummary] = useState({ total: 0, categories: [] });

    // --- 4. UPDATE useEffect to fetch BOTH collections ---
    useEffect(() => {
        if (!userId) return;
        setLoading(true);

        let expensesLoaded = false;
        let categoriesLoaded = false;

        const checkLoadingDone = () => {
            if (expensesLoaded && categoriesLoaded) {
                setLoading(false);
            }
        };

        // Fetch Expenses
        const expensesQuery = query(
            collection(db, `users/${userId}/expenses`),
            orderBy("timestamp", "desc")
        );
        const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
            const expenseList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                dateString: formatToIST_YYYY_MM(doc.data().timestamp.seconds * 1000) 
            }));
            setExpenses(expenseList);
            expensesLoaded = true;
            checkLoadingDone();
        }, (err) => {
            console.error("Summary Fetch Error:", err);
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

    // --- 5. UPDATE Calculate Summary to use dynamic colors ---
    useEffect(() => {
        if (loading) return; 

        const colorMap = Object.fromEntries(
            categories.map(cat => [cat.name, cat.color || '#6B7280'])
        );

        let totalSpending = 0;
        const categoriesMap = {};
        
        const filteredExpenses = expenses.filter(exp => exp.dateString === selectedMonth);

        filteredExpenses.forEach(exp => {
            const headcount = Number(exp.headcount) || 1;
            const userShare = (Number(exp.amount) || 0) / headcount;
            
            if (exp.category.toUpperCase() !== 'INCOME') {
                 totalSpending += userShare;
            }

            const catName = (exp.category || 'UNCATEGORIZED').toUpperCase();
            
            const color = colorMap[catName] || '#6B7280'; 

            if (!categoriesMap[catName]) {
                 categoriesMap[catName] = { amount: 0, color: color };
            }
            categoriesMap[catName].amount += userShare;
        });

        const categoriesArray = Object.entries(categoriesMap)
            .map(([name, data]) => ({ name, amount: data.amount, color: data.color }))
            .sort((a, b) => b.amount - a.amount);

        setSummary({ total: totalSpending, categories: categoriesArray });
    }, [expenses, categories, selectedMonth, loading]);

    // --- 6. Chart Configuration (UPDATED) ---
    const chartData = {
        labels: summary.categories.map(c => `${c.name} (${formatCurrency(c.amount, userCurrency)})`), // Pass currency
        datasets: [{
            data: summary.categories.map(c => c.amount),
            backgroundColor: summary.categories.map(c => c.color),
            hoverBackgroundColor: summary.categories.map(c => c.color),
            borderWidth: 1,
        }],
    };
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 15,
                    boxWidth: 12,
                }
            },
            tooltip: {
                callbacks: {
                    label: function({ label, raw, chart }) {
                        const total = chart.data.datasets[0].data.reduce((sum, val) => sum + val, 0);
                        const percentage = total > 0 ? ((raw / total) * 100).toFixed(1) : 0;
                        return `${label}: ${formatCurrency(raw, userCurrency)} (${percentage}%)`; // Pass currency
                    }
                }
            }
        },
    };
    
    // --- 7. Render Logic (Unchanged) ---
    const friendlyMonthName = new Date(`${selectedMonth}-01T00:00:00Z`).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric',
        timeZone: 'UTC' 
    });


    if (loading) {
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Calculating financial summary...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            
            {/* Header and Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 md:mb-0">Monthly Summary</h3>
                
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

            {/* Core Summary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Column 1: Total Expenses & Insights (Future AI Spot) */}
                <div className="lg:col-span-1 space-y-6">
                     <div className="p-6 bg-red-50 rounded-xl shadow-lg border border-red-200">
                        <p className="text-sm font-medium text-red-700">Total Spending in {friendlyMonthName}</p>
                        <p className="text-4xl font-extrabold text-red-600 mt-2">
                           {formatCurrency(summary.total, userCurrency)} {/* 8. Pass currency */}
                        </p>
                    </div>
                </div>

                {/* Column 2: Doughnut Chart */}
                <div className="lg:col-span-2 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 text-center">Spending Split by Category</h4>
                    
                    {summary.categories.filter(c => c.name !== 'INCOME').length > 0 ? (
                        <div className="relative h-64 md:h-80">
                            <Doughnut data={chartData} options={chartOptions} />
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-500">
                            No non-income spending recorded for this month.
                        </div>
                    )}
                </div>
            </div>

            {/* Category List Summary (Below the chart) */}
            <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Detailed Breakdown</h4>
                
                <div className="space-y-3">
                    {summary.categories.map(cat => (
                        <div key={cat.name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border-l-4" style={{ borderColor: cat.color }}>
                            <span className="text-base font-medium text-gray-900">{cat.name}</span>
                            <span className={`text-base font-bold ${cat.name === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                {cat.name === 'INCOME' ? '+' : ''}{formatCurrency(cat.amount, userCurrency)} {/* 9. Pass currency */}
                            </span>
                        </div>
                    ))}
                    
                    {summary.categories.length === 0 && (
                        <p className="text-center text-gray-500">No transactions for this month.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SummaryView;