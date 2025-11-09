import React, { useState, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';

// Props updated to include month and specific initial values
function FixedDataForm({ userId, initialIncome, initialFixedExpenses, month, onClose }) {
    
    const [fixedIncome, setFixedIncome] = useState(initialIncome);
    const [fixedExpenses, setFixedExpenses] = useState(initialFixedExpenses);
    const [isSaving, setIsSaving] = useState(false);
    
    // Reference to the MONTHLY specific document
    const docRef = useMemo(() => doc(db, `users/${userId}/monthly_budgets`, month), [userId, month]);

    const handleSaveFixedData = async (e) => {
        e.preventDefault();
        if (!userId) return;
        setIsSaving(true);
        try {
            await setDoc(docRef, {
                monthlyIncome: Number(fixedIncome),
                monthlyFixedExpenditure: Number(fixedExpenses),
            }, { merge: true }); // Use setDoc with merge to ensure no other fields are overwritten

            Toast.show({ text: `Budget saved for ${month}!`, duration: 'short' });
            onClose(); 
        } catch (error) {
            console.error("Error saving fixed data:", error);
            Toast.show({ text: 'Failed to save data.', duration: 'long' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSaveFixedData} className="space-y-4">
            <h4 className="text-md font-bold text-gray-800">Editing Budget for: {month}</h4>
            <div>
                <label htmlFor="income" className="block text-sm font-medium text-gray-700">Monthly Income (Gross)</label>
                <input
                    type="number"
                    id="income"
                    value={fixedIncome}
                    onChange={(e) => setFixedIncome(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm"
                    min="0"
                    required
                />
            </div>
            
            <div>
                <label htmlFor="fixed" className="block text-sm font-medium text-gray-700">Monthly Fixed Expenses (SIP/Stock/Rent)</label>
                <input
                    type="number"
                    id="fixed"
                    value={fixedExpenses}
                    onChange={(e) => setFixedExpenses(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm"
                    min="0"
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
                    disabled={isSaving}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow transition ${isSaving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {isSaving ? 'Saving...' : 'Save Data'}
                </button>
            </div>
        </form>
    );
}

export default FixedDataForm;