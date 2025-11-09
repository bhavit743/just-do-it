// src/components/Expense/SavingsLogView.jsx
import React from 'react';
import { db } from '../../firebaseConfig';
import { doc, deleteDoc } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';

// Utility to format currency (needs to be available here for display)
const formatCurrency = (amount, currency = 'INR') => { /* ... */ };

function SavingsLogView({ userId, savingsLog, userCurrency }) {

    const handleDeleteLogEntry = async (logId, header) => {
        if (!window.confirm(`Delete log entry "${header}"? This will increase your available savings.`)) return;
        
        try {
            await deleteDoc(doc(db, `users/${userId}/savings_log`, logId));
            Toast.show({ text: 'Log entry deleted.', duration: 'short' });
        } catch (e) {
            console.error("Error deleting log entry:", e);
            Toast.show({ text: 'Failed to delete log entry.', duration: 'long' });
        }
    };
    
    return (
        <div className="space-y-4">
            <h4 className="text-xl font-semibold text-gray-800 mb-4">Savings Adjustment Log</h4>
            <p className="text-sm text-gray-600">This log tracks all manual adjustments and funds allocated to completed goals.</p>
            
            {savingsLog.length === 0 ? (
                <p className="text-gray-500 p-4 bg-gray-50 rounded-lg">No adjustments or completed goals logged yet.</p>
            ) : (
                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
                    {savingsLog.map(log => {
                        const isGoal = log.type === 'GOAL_COMPLETED';
                        const amount = log.amount;
                        const sign = amount < 0 ? '-' : '+';
                        const colorClass = isGoal ? 'text-green-600' : 'text-red-600';
                        const bgColor = isGoal ? 'bg-green-50' : 'bg-red-50';
                        
                        return (
                            <li key={log.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition">
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{log.header}</p>
                                    <p className="text-xs text-gray-500">
                                        {isGoal ? 'Goal Completion' : 'Manual Adjustment'} 
                                        {' | '}
                                        {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <span className={`font-bold ${colorClass}`}>
                                        {sign}{formatCurrency(Math.abs(amount), userCurrency)}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteLogEntry(log.id, log.header)}
                                        className="text-red-400 hover:text-red-600 p-1 rounded-full"
                                        title="Delete Log Entry"
                                    >
                                        <i className="fas fa-trash-alt text-sm"></i>
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default SavingsLogView;