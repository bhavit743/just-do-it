import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { doc, updateDoc, collection, addDoc, Timestamp, runTransaction } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';

// --- IST HELPERS (Assuming these are the only external functions needed) ---
const IST_OFFSET = 19800000;
function formatToIST_YYYY_MM_DD(date) { 
    const utcMillis = new Date(date).getTime();
    const istDate = new Date(utcMillis + IST_OFFSET);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
// --------------------------------------------------------------------------

function AddGroupExpenseForm({ userId, groupId, groupMembers, onClose, userCurrency }) { 
    
    // --- Currency Helper (Defined Locally for Scope Fix) ---
    const formatCurrency = (amount, currency = 'INR') => {
        const numAmount = Number(amount) || 0;
        return new Intl.NumberFormat('en-IN', { 
            style: 'currency', currency: currency, minimumFractionDigits: 2 
        }).format(numAmount);
    };
    // -----------------------------------------------------

    const defaultFormData = {
        amount: '',
        description: '',
        date: formatToIST_YYYY_MM_DD(new Date()),
        paidBy: 'you',
        splitMethod: 'equal',
        splitAmounts: {},
    };
    
    const [formData, setFormData] = useState(defaultFormData);
    const [isSaving, setIsSaving] = useState(false);
    
    // Convert groupMembers map to an array for easy rendering/filtering
    const membersArray = useMemo(() => 
        Object.entries(groupMembers)
            .map(([docId, details]) => ({ id: docId, name: details.name, friendId: details.friendId }))
            .filter(m => m.id !== 'you'), 
    [groupMembers]);
    
    // Participants array including the current user
    const participants = useMemo(() => [
        'you', 
        ...membersArray.map(m => m.id)
    ], [membersArray]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name.startsWith('split_')) {
            const key = name.split('_')[1];
            const amountValue = parseFloat(value) || 0;
            setFormData(prev => ({
                ...prev,
                splitAmounts: { ...prev.splitAmounts, [key]: amountValue }
            }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSaveGroupExpense = async (e) => {
        e.preventDefault();
        const totalAmount = parseFloat(formData.amount);
        if (isNaN(totalAmount) || totalAmount <= 0) {
            Toast.show({ text: 'Enter a valid amount.', duration: 'short' });
            return;
        }
        
        setIsSaving(true);
        
        const { splitMethod, paidBy, splitAmounts } = formData;
        let shares = {}; 
        let yourShare = totalAmount;

        // --- 1. Calculate Shares and Validate Manual Split ---
        if (splitMethod === 'equal') {
            const equalShare = totalAmount / participants.length;
            shares = participants.reduce((acc, id) => ({ ...acc, [id]: equalShare }), {});
            yourShare = equalShare;
        } else if (splitMethod === 'manual') {
            let manualSum = 0;
            participants.forEach(id => { manualSum += splitAmounts[id] || 0; });
            
            if (Math.abs(manualSum - totalAmount) > 0.01) {
                Toast.show({ text: `Manual split (₹${manualSum.toFixed(2)}) must equal Total (₹${totalAmount.toFixed(2)}).`, duration: 'long' });
                setIsSaving(false);
                return;
            }
            shares = splitAmounts;
            yourShare = splitAmounts['you'];
        }

        // Determine if the expense is actually a split (required for transaction visibility)
        const isSplitExpense = participants.length > 1 && splitMethod !== 'none';

        const expenseData = {
            amount: totalAmount,
            description: formData.description,
            isSplit: isSplitExpense, // <-- Flag for display logic
            timestamp: Timestamp.fromDate(new Date(formData.date + 'T00:00:00')), 
            paidBy: paidBy,
            paidByName: groupMembers[paidBy].name,
            method: splitMethod,
            shares: shares, // Who owes what
        };
        
        try {
            // --- 2. Record Expense in Group Subcollection ---
            const groupExpenseRef = collection(db, `users/${userId}/groups/${groupId}/expenses`);
            await addDoc(groupExpenseRef, expenseData);
            
            // --- 3. Update Group Member Balances (Atomic Transaction) ---
            if (isSplitExpense) {
                await runTransaction(db, async (transaction) => {
                    const groupRef = doc(db, `users/${userId}/groups`, groupId);
                    const groupDoc = await transaction.get(groupRef);
                    const currentDetails = groupDoc.data().memberDetails || {};
                    
                    const finalBalanceUpdates = { ...currentDetails };

                    // Logic: Update Balances relative to the Payer P.
                    
                    participants.forEach(memberId => {
                        const memberShare = shares[memberId];
                        const currentBal = finalBalanceUpdates[memberId].balance || 0;
                        
                        let netChange = 0;

                        if (memberId === paidBy) {
                            // PAYER (P): P paid Total, P consumed P's share. P is owed (Total - P's share).
                            // This is the net amount P is owed by the rest of the group.
                            const netCredit = totalAmount - memberShare;
                            netChange = netCredit;
                        } else {
                            // CONSUMER (C): C owes P C's share. C's balance changes by -C's share.
                            netChange = -memberShare;
                        }
                        
                        finalBalanceUpdates[memberId].balance = currentBal + netChange;
                    });

                    transaction.update(groupRef, { memberDetails: finalBalanceUpdates });
                });
            }

            Toast.show({ text: 'Expense recorded and group balances updated!', duration: 'short' });
            onClose();
        } catch (error) {
            console.error("Error saving group expense:", error);
            Toast.show({ text: `Failed to save expense: ${error.message}`, duration: 'long' });
        } finally {
            setIsSaving(false);
        }
    };
    
    // UI Calculation for Manual Split Check
    const totalAmountFloat = parseFloat(formData.amount) || 0;
    let manualSplitRemainder = totalAmountFloat;
    let manualSplitValid = true;

    if (formData.splitMethod === 'manual') {
        let enteredSum = 0;
        participants.forEach(id => {
            enteredSum += formData.splitAmounts[id] || 0;
        });
        manualSplitRemainder = totalAmountFloat - enteredSum;
        manualSplitValid = Math.abs(manualSplitRemainder) < 0.02;
    }


    return (
        <form onSubmit={handleSaveGroupExpense} className="space-y-4">
            {/* Input fields for Amount, Description, Date, Paid By */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Amount (Total)</label>
                    <input type="number" name="amount" step="0.01" value={formData.amount} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Who Paid?</label>
                    <select name="paidBy" value={formData.paidBy} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border rounded-lg">
                        <option value="you">You (Me)</option>
                        {membersArray.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
            </div>
            
            {/* NEW: Date Input Field */}
            <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                <input
                    type="date"
                    id="date"
                    name="date"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={formData.date}
                    onChange={handleChange}
                    required
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input type="text" name="description" value={formData.description} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border rounded-lg" />
            </div>
            
            {/* Split Method Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700">Split Method</label>
                <select name="splitMethod" value={formData.splitMethod} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border rounded-lg">
                    <option value="equal">Split Equally</option>
                    <option value="manual">Manual Split</option>
                </select>
            </div>

            {/* Manual Split Inputs */}
            {formData.splitMethod === 'manual' && (
                <fieldset className="border p-3 rounded-lg space-y-2">
                    <legend className="px-2 text-sm font-bold text-gray-700">Enter Shares</legend>
                    {participants.map(memberId => {
                        const name = groupMembers[memberId].name;
                        return (
                            <div key={memberId} className="flex justify-between items-center space-x-2">
                                <label className="text-sm font-medium w-1/2">{name}:</label>
                                <input
                                    type="number"
                                    name={`split_${memberId}`}
                                    step="0.01"
                                    value={formData.splitAmounts[memberId] || ''}
                                    onChange={handleChange}
                                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg"
                                    placeholder="Share"
                                    
                                />
                            </div>
                        );
                    })}
                    <div className={`p-2 rounded-lg text-sm font-bold mt-2 ${manualSplitValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Remaining: {formatCurrency(manualSplitRemainder, userCurrency || 'INR')}
                    </div>
                </fieldset>
            )}

            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg" disabled={isSaving}>Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSaving || !manualSplitValid}
                    className="px-4 py-2 text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {isSaving ? 'Saving...' : 'Record Expense'}
                </button>
            </div>
        </form>
    );
}

export default AddGroupExpenseForm;