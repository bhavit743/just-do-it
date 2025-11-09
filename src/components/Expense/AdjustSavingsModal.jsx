// src/components/Expense/AdjustSavingsModal.jsx
import React, { useState } from 'react';
import { updateDoc, doc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Toast } from '@capacitor/toast';

// Utility to format currency (needs to be available here for display)
const formatCurrency = (amount, currency = 'INR') => {
    const numAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: currency, 
        minimumFractionDigits: 2 
    }).format(numAmount);
};

function AdjustSavingsModal({ userDocRef, initialSpent, onClose, totalPotentialSavings, userCurrency }) {
    // Note: initialSpent is the *total* accumulated spent, which is read-only here
    const [headerInput, setHeaderInput] = useState('Manual Adjustment');
    const [amountInput, setAmountInput] = useState(0); 
    const [isSavingSpent, setIsSavingSpent] = useState(false);

    // Reference to the savings log collection (assuming userId is available, but the modal doesn't have it directly)
    // We will assume the parent (WishlistView) has imported 'db'
    const logCollectionRef = React.useMemo(() => collection(doc(db, 'users', userDocRef.id), 'savings_log'), [userDocRef]);


    const handleSaveFixedData = async (e) => {
        e.preventDefault();
        if (!userDocRef || !amountInput || amountInput <= 0) {
            Toast.show({ text: 'Please enter a valid amount.', duration: 'short' });
            return;
        }
        setIsSavingSpent(true);
        try {
            // Save the new adjustment as a NEGATIVE entry in the log
            await addDoc(logCollectionRef, {
                amount: -Number(amountInput), 
                header: headerInput.trim() || 'Manual Adjustment',
                type: 'MANUAL_SPEND',
                timestamp: Timestamp.now(),
            });
            
            // NOTE: The main userProfile document is no longer updated here.
            // The recalculation happens automatically by summing the savings_log.

            Toast.show({ text: 'Adjustment logged successfully!', duration: 'short' });
            onClose(); // Close the modal on success
        } catch (error) {
            console.error("Error saving adjustment:", error);
            Toast.show({ text: 'Failed to save adjustment.', duration: 'long' });
        } finally {
            setIsSavingSpent(false);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-700">
                Total Savings Potential: <strong>{formatCurrency(totalPotentialSavings, userCurrency)}</strong>
            </p>
            
            <form onSubmit={handleSaveFixedData} className="space-y-4">
                
                <div>
                    <label htmlFor="headerInput" className="block text-sm font-medium text-gray-700">Description</label>
                    <input
                        type="text"
                        id="headerInput"
                        value={headerInput}
                        onChange={(e) => setHeaderInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm"
                        placeholder="e.g., Bought new headphones"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="amountInput" className="block text-sm font-medium text-gray-700">Amount Spent</label>
                    <input
                        type="number"
                        id="amountInput"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm"
                        min="1"
                        required
                    />
                </div>

                <div className="flex justify-end pt-2 space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSavingSpent}
                        className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow transition bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400"
                    >
                        {isSavingSpent ? 'Logging...' : 'Log Spend'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AdjustSavingsModal;