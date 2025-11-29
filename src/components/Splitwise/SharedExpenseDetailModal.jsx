import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { 
  doc, collection, query, where, getDocs, writeBatch, Timestamp 
} from 'firebase/firestore';
import { Toast } from '@capacitor/toast';
import Modal from '../common/Modal';

function SharedExpenseDetailModal({ group, expense, memberNames, currentUser, onClose }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FORM STATE (For Editing) ---
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount);
  const [paidBy, setPaidBy] = useState(expense.paidBy);
  
  // NEW: Date State (Initialize from expense date or today)
  const [date, setDate] = useState(
    expense.date 
      ? new Date(expense.date.seconds * 1000).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0]
  );

  const [splitType, setSplitType] = useState(expense.splitType || 'EQUAL');
  
  // Initialize splits based on existing data
  const [exactAmounts, setExactAmounts] = useState(expense.splitMap || {});
  const [splitMembers, setSplitMembers] = useState(
    expense.splitType === 'EQUAL' ? Object.keys(expense.splitMap || {}) : group.members
  );

  // --- HELPER: Get Name ---
  const getName = (uid) => uid === currentUser.uid ? 'You' : (memberNames[uid] || 'Unknown');

  // --- EDIT HANDLERS ---
  const handleExactChange = (uid, value) => {
    setExactAmounts(prev => ({ ...prev, [uid]: value }));
  };

  const handleToggleSplitMember = (uid) => {
    setSplitMembers(prev => {
      if (prev.includes(uid)) return prev.filter(id => id !== uid);
      return [...prev, uid];
    });
  };

  const getTotalSplit = () => {
    return Object.values(exactAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };
  
  const getRemaining = () => {
    return (parseFloat(amount) || 0) - getTotalSplit();
  };

  // --- SAVE CHANGES ---
  const handleSaveChanges = async () => {
    const totalAmount = parseFloat(amount);
    if (!description || !totalAmount || !date) return;

    // Validation
    if (splitType === 'EXACT' && Math.abs(getRemaining()) > 0.01) {
      await Toast.show({ text: `Splits must match total. Remaining: ₹${getRemaining()}` });
      return;
    }
    if (splitType === 'EQUAL' && splitMembers.length === 0) {
        await Toast.show({ text: 'Select at least one person.' });
        return;
    }

    setIsSubmitting(true);

    try {
      const batch = writeBatch(db);

      // Create Timestamp from selected date
      const selectedDateObj = new Date(date);
      selectedDateObj.setHours(12, 0, 0, 0); // Noon to avoid timezone shifts
      const timestampDate = Timestamp.fromDate(selectedDateObj);

      // 1. Calculate New Splits
      let newSplitMap = {};
      if (splitType === 'EQUAL') {
        const share = totalAmount / splitMembers.length;
        splitMembers.forEach(uid => newSplitMap[uid] = share);
      } else {
        group.members.forEach(uid => newSplitMap[uid] = parseFloat(exactAmounts[uid]) || 0);
      }

      // 2. Update Group Expense
      const groupExpenseRef = doc(db, 'groups', group.id, 'expenses', expense.id);
      batch.update(groupExpenseRef, {
        description,
        amount: totalAmount,
        paidBy,
        date: timestampDate, // Update Date
        splitType,
        splitMap: newSplitMap,
        updatedAt: Timestamp.now()
      });

      // 3. Update Personal Tracker (If it exists for ME)
      // We search for the personal expense linked to this group expense
      const personalRef = collection(db, `users/${currentUser.uid}/expenses`);
      const q = query(personalRef, where("sharedExpenseId", "==", expense.id));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const myShare = newSplitMap[currentUser.uid] || 0;
        const didIPay = paidBy === currentUser.uid;
        const personalDoc = snapshot.docs[0].ref;

        if (didIPay) {
          batch.update(personalDoc, {
            amount: totalAmount,
            description: `Paid for ${description} (${group.name})`,
            date: timestampDate, // Update Date
            recoverableAmount: totalAmount - myShare
          });
        } else {
           // If I previously paid but now don't, or vice versa
           if (myShare > 0) {
             batch.update(personalDoc, {
               amount: myShare,
               description: `Owe ${getName(paidBy)} for ${description}`,
               date: timestampDate, // Update Date
               recoverableAmount: 0
             });
           } else {
             // If my share is now 0, maybe delete the personal expense?
             batch.delete(personalDoc);
           }
        }
      }

      await batch.commit();
      await Toast.show({ text: 'Changes saved!' });
      setIsEditing(false);
      onClose(); // Close modal after save
    } catch (error) {
      console.error(error);
      await Toast.show({ text: 'Update failed' });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Modal title={isEditing ? "Edit Expense" : "Expense Details"} onClose={onClose}>
      <div className="space-y-6">
        
        {/* --- VIEW MODE --- */}
        {!isEditing && (
            <>
                <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{expense.description}</h2>
                        <p className="text-3xl font-extrabold text-blue-600 mt-1">₹{expense.amount}</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Paid by <span className="font-semibold text-gray-800">{getName(expense.paidBy)}</span> on {new Date(expense.date?.seconds * 1000).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl">
                        <i className="fas fa-receipt"></i>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Split Details</h4>
                    <ul className="space-y-2">
                        {group.members.map(uid => {
                            const share = expense.splitMap?.[uid] || 0;
                            if (share === 0) return null; // Skip if 0
                            return (
                                <li key={uid} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                            {getName(uid).charAt(0)}
                                        </div>
                                        <span>{getName(uid)}</span>
                                    </div>
                                    <span className="font-medium">owes ₹{share.toFixed(2)}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                    >
                        <i className="fas fa-pencil-alt"></i> Edit Expense
                    </button>
                </div>
            </>
        )}


        {/* --- EDIT MODE --- */}
        {isEditing && (
            <div className="space-y-4">
                {/* Form Fields */}
                <div>
                    <label className="block text-xs text-gray-500 uppercase">Description</label>
                    <input 
                        type="text" value={description} onChange={e => setDescription(e.target.value)} 
                        className="w-full border rounded p-2 mt-1"
                    />
                </div>
                
                {/* Amount and Date in one row */}
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 uppercase">Amount</label>
                        <input 
                            type="number" value={amount} onChange={e => setAmount(e.target.value)} 
                            className="w-full border rounded p-2 mt-1"
                        />
                    </div>
                    {/* DATE INPUT */}
                    <div className="w-1/3">
                        <label className="block text-xs text-gray-500 uppercase">Date</label>
                        <input 
                            type="date" value={date} onChange={e => setDate(e.target.value)} 
                            className="w-full border rounded p-2 mt-1 text-sm"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-gray-500 uppercase">Paid By</label>
                    <select 
                        value={paidBy} onChange={e => setPaidBy(e.target.value)} 
                        className="w-full border rounded p-2 mt-1"
                    >
                        {group.members.map(uid => (
                            <option key={uid} value={uid}>{getName(uid)}</option>
                        ))}
                    </select>
                </div>

                {/* Simplified Split Edit UI */}
                <div>
                    <label className="block text-xs text-gray-500 uppercase mb-2">Split</label>
                    <div className="flex bg-gray-100 p-1 rounded mb-2">
                        <button onClick={() => setSplitType('EQUAL')} className={`flex-1 py-1 text-xs rounded ${splitType === 'EQUAL' ? 'bg-white shadow' : ''}`}>Equal</button>
                        <button onClick={() => setSplitType('EXACT')} className={`flex-1 py-1 text-xs rounded ${splitType === 'EXACT' ? 'bg-white shadow' : ''}`}>Unequal</button>
                    </div>

                    {/* Equal Selection */}
                    {splitType === 'EQUAL' && (
                        <div className="max-h-32 overflow-y-auto border rounded p-2">
                            {group.members.map(uid => (
                                <label key={uid} className="flex items-center gap-2 p-1">
                                    <input type="checkbox" checked={splitMembers.includes(uid)} onChange={() => handleToggleSplitMember(uid)} />
                                    <span className="text-sm">{getName(uid)}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Exact Inputs */}
                    {splitType === 'EXACT' && (
                         <div className="space-y-2">
                             {group.members.map(uid => (
                                 <div key={uid} className="flex justify-between items-center">
                                     <span className="text-sm">{getName(uid)}</span>
                                     <input 
                                        type="number" 
                                        value={exactAmounts[uid] || ''} 
                                        onChange={e => handleExactChange(uid, e.target.value)}
                                        className="w-20 border rounded p-1 text-right text-sm"
                                        placeholder="0"
                                     />
                                 </div>
                             ))}
                             <div className={`text-xs text-right ${Math.abs(getRemaining()) > 0.01 ? 'text-red-500' : 'text-green-600'}`}>
                                {Math.abs(getRemaining()) > 0.01 ? `Remaining: ${getRemaining().toFixed(2)}` : 'Balanced'}
                             </div>
                         </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                    <button 
                        onClick={handleSaveChanges} 
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        )}

      </div>
    </Modal>
  );
}

export default SharedExpenseDetailModal;