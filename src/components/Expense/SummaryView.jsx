// src/components/Expense/SummaryView.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

// 1. Import necessary Chart.js components
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register Chart.js elements
ChartJS.register(ArcElement, Tooltip, Legend);

// Utility functions (repeated for self-contained component)
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);
const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(numAmount);
};
const getCategoryColor = (categoryName) => {
    switch (categoryName.toUpperCase()) {
        case 'FOOD': return '#f59e0b'; // Amber
        case 'TRANSPORT': return '#3b82f6'; // Blue
        case 'RENT': return '#8b5cf6'; // Violet
        case 'BILLS': return '#ef4444'; // Red
        case 'INCOME': return '#10b981'; // Green
        case 'SHOPPING': return '#ec4899'; // Pink
        default: return '#6b7280'; // Gray
    }
};

function SummaryView({ userId }) {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [summary, setSummary] = useState({ total: 0, categories: [] });

    // --- 1. Fetch ALL Expenses in Real-Time ---
    useEffect(() => {
        if (!userId) return;
        const expensesQuery = query(
            collection(db, `users/${userId}/expenses`),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
            const expenseList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                dateString: new Date(doc.data().timestamp.seconds * 1000).toISOString().slice(0, 7) // Add YYYY-MM
            }));
            setExpenses(expenseList);
            setLoading(false);
        }, (err) => {
            console.error("Summary Fetch Error:", err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [userId]);

    // --- 2. Calculate Summary and Chart Data on Filter/Data Change ---
    useEffect(() => {
        if (expenses.length === 0 && !loading) {
            setSummary({ total: 0, categories: [] });
            return;
        }

        let totalSpending = 0;
        const categoriesMap = {};
        
        const filteredExpenses = expenses.filter(exp => exp.dateString === selectedMonth);

        filteredExpenses.forEach(exp => {
            const amount = Number(exp.amount) || 0;
            // Only count non-income for the chart visualization
            if (exp.category.toUpperCase() !== 'INCOME') {
                 totalSpending += amount;
            }

            const catName = (exp.category || 'UNCATEGORIZED').toUpperCase();
            if (!categoriesMap[catName]) categoriesMap[catName] = { amount: 0, color: getCategoryColor(catName) };
            categoriesMap[catName].amount += amount;
        });

        // Convert map to sorted array (highest spending first)
        const categoriesArray = Object.entries(categoriesMap)
            .map(([name, data]) => ({ name, amount: data.amount, color: data.color }))
            .sort((a, b) => b.amount - a.amount);

        setSummary({ total: totalSpending, categories: categoriesArray });
    }, [expenses, selectedMonth, loading]);

    // --- 3. Chart Configuration ---
    const chartData = {
        labels: summary.categories.map(c => `${c.name} (${formatCurrency(c.amount)})`),
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
                        return `${label}: ${formatCurrency(raw)} (${percentage}%)`;
                    }
                }
            }
        },
    };
    
    // --- 4. Render Logic ---
    const friendlyMonthName = new Date(selectedMonth + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

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
                           {formatCurrency(summary.total)}
                        </p>
                    </div>

                    {/* Gemini Feature Placeholder Button */}
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
                                {cat.name === 'INCOME' ? '+' : ''}{formatCurrency(cat.amount)}
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