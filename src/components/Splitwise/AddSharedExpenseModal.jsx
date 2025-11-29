import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { 
  writeBatch, doc, collection, Timestamp, query, where, documentId, getDocs, increment 
} from 'firebase/firestore';
import { Toast } from '@capacitor/toast';
import Modal from '../common/Modal';

function AddSharedExpenseModal({ group, currentUser, onClose }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  // Date State (Defaults to Today)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Member Data
  const [memberProfiles, setMemberProfiles] = useState([]);
  const [paidBy, setPaidBy] = useState(currentUser.uid); // Default to Me
  
  // Split State
  const [splitType, setSplitType] = useState('EQUAL'); // 'EQUAL' or 'EXACT'
  const [exactAmounts, setExactAmounts] = useState({}); 
  
  // Track who is included in the "Equal" split
  const [splitMembers, setSplitMembers] = useState(group.members || []);

  // 1. Fetch Member Names
  useEffect(() => {
    const fetchMembers = async () => {
      if (!group?.members?.length) return;
      try {
        // Firestore 'in' query (max 10). 
        const q = query(collection(db, 'users'), where(documentId(), 'in', group.members.slice(0, 10)));
        const snapshot = await getDocs(q);
        const profiles = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
        setMemberProfiles(profiles);
        
        // Initialize Exact Amounts
        const initialSplits = {};
        group.members.forEach(m => initialSplits[m] = '');
        setExactAmounts(initialSplits);
        
        // Initialize Equal Split (Select All by default)
        setSplitMembers(group.members);

      } catch (err) {
        console.error("Error fetching members:", err);
      }
    };
    fetchMembers();
  }, [group.members]);

  // 2. Handlers
  const handleExactChange = (uid, value) => {
    setExactAmounts(prev => ({ ...prev, [uid]: value }));
  };

  const handleToggleSplitMember = (uid) => {
    setSplitMembers(prev => {
      if (prev.includes(uid)) {
        return prev.filter(id => id !== uid); // Remove
      } else {
        return [...prev, uid]; // Add
      }
    });
  };

  // 3. Validation Helpers
  const getTotalSplit = () => {
    return Object.values(exactAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };
  
  const getRemaining = () => {
    const total = parseFloat(amount) || 0;
    return total - getTotalSplit();
  };

  // 4. SAVE LOGIC
  const handleSave = async () => {
    const totalAmount = parseFloat(amount);
    if (!description || !totalAmount || !date) {
      await Toast.show({ text: 'Please fill all fields' });
      return;
    }

    // Validate Equal Split
    if (splitType === 'EQUAL' && splitMembers.length === 0) {
      await Toast.show({ text: 'Select at least one person to split with.' });
      return;
    }

    // Validate Exact Split
    if (splitType === 'EXACT') {
      const sum = getTotalSplit();
      if (Math.abs(sum - totalAmount) > 0.01) {
        await Toast.show({ text: `Splits must equal ₹${totalAmount}. Current: ₹${sum}` });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const batch = writeBatch(db);

      // Create Timestamp from selected date
      const selectedDateObj = new Date(date);
      selectedDateObj.setHours(12, 0, 0, 0); // Set to noon to avoid timezone shifts
      const timestampDate = Timestamp.fromDate(selectedDateObj);

      // --- A. CALCULATE SPLITS ---
      let splitMap = {};
      
      if (splitType === 'EQUAL') {
        // Only divide among selected members
        const share = totalAmount / splitMembers.length;
        splitMembers.forEach(uid => splitMap[uid] = share);
      } else {
        // Exact amounts
        group.members.forEach(uid => splitMap[uid] = parseFloat(exactAmounts[uid]) || 0);
      }

      // --- B. SHARED EXPENSE (Group Ledger) ---
      const groupExpenseRef = doc(collection(db, 'groups', group.id, 'expenses'));
      
      batch.set(groupExpenseRef, {
        description: description,
        amount: totalAmount,
        paidBy: paidBy,
        date: timestampDate, // Use the selected date
        splitType: splitType,
        splitMap: splitMap,
        members: group.members 
      });

      // --- C. UPDATE GROUP BALANCES (NEW LOGIC) ---
      // This updates the 'balances' map on the group document itself
      const groupRef = doc(db, 'groups', group.id);
      
      // 1. Credit the Payer (They paid, so their balance goes UP)
      batch.update(groupRef, {
          [`balances.${paidBy}`]: increment(totalAmount)
      });

      // 2. Debit the Consumers (They consumed, so their balance goes DOWN)
      Object.entries(splitMap).forEach(([uid, share]) => {
          if (share > 0) {
              batch.update(groupRef, {
                  [`balances.${uid}`]: increment(-share)
              });
          }
      });

      // --- D. PERSONAL TRACKER SYNC ---
      const myShare = splitMap[currentUser.uid] || 0;
      const didIPay = paidBy === currentUser.uid;

      const personalExpenseRef = doc(collection(db, `users/${currentUser.uid}/expenses`));

      if (didIPay) {
        // I PAID: Log full amount, mark recoverable
        batch.set(personalExpenseRef, {
            amount: totalAmount,
            category: 'Shared',
            description: `Paid for ${description} (${group.name})`,
            date: timestampDate, // Use the selected date
            isShared: true,
            sharedGroupId: group.id,
            sharedExpenseId: groupExpenseRef.id,
            recoverableAmount: totalAmount - myShare 
        });
      } else {
        // SOMEONE ELSE PAID: Log only my debt if I was involved
        if (myShare > 0) {
            batch.set(personalExpenseRef, {
                amount: myShare,
                category: 'Shared',
                description: `Owe ${memberProfiles.find(u=>u.uid === paidBy)?.username || 'friend'} for ${description}`,
                date: timestampDate, // Use the selected date
                isShared: true,
                sharedGroupId: group.id,
                sharedExpenseId: groupExpenseRef.id,
                recoverableAmount: 0 
            });
        }
      }

      await batch.commit();
      await Toast.show({ text: 'Expense added & synced!' });
      onClose();

    } catch (error) {
      console.error("Error adding expense:", error);
      await Toast.show({ text: 'Failed to save expense' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Add to ${group.name}`} onClose={onClose}>
      <div className="space-y-4">
        
        {/* Description Input */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
            placeholder="e.g. Dinner"
          />
        </div>

        {/* Amount & Date Row */}
        <div className="flex gap-3">
            <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 uppercase">Total Amount</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">₹</span>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="block w-full pl-8 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2 border"
                        placeholder="0.00"
                    />
                </div>
            </div>
            {/* NEW: Date Picker */}
            <div className="w-1/3">
                <label className="block text-xs font-medium text-gray-500 uppercase">Date</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
        </div>

        {/* WHO PAID */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Paid By</label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
          >
            {memberProfiles.map(member => (
              <option key={member.uid} value={member.uid}>
                {member.uid === currentUser.uid ? 'You' : member.username}
              </option>
            ))}
          </select>
        </div>

        {/* SPLIT TYPE TOGGLE */}
        <div>
           <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Split</label>
           <div className="flex bg-gray-100 p-1 rounded-lg">
             <button
                onClick={() => setSplitType('EQUAL')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${splitType === 'EQUAL' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
             >
               = Equally
             </button>
             <button
                onClick={() => setSplitType('EXACT')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${splitType === 'EXACT' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
             >
               1.23 Unequally
             </button>
           </div>
        </div>

        {/* SPLIT DETAILS UI */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
           
           {/* EQUAL MODE with SELECTION */}
           {splitType === 'EQUAL' && (
             <div className="space-y-3">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase">Split Amongst ({splitMembers.length})</p>
                    <div className="text-xs text-blue-600 font-medium">
                        {splitMembers.length > 0 ? `₹${(parseFloat(amount || 0) / splitMembers.length).toFixed(2)} / person` : '₹0.00'}
                    </div>
                </div>
                
                {/* Member Selection List */}
                <div className="max-h-40 overflow-y-auto space-y-2 border rounded p-2 bg-white">
                   {memberProfiles.map(member => {
                       const isSelected = splitMembers.includes(member.uid);
                       return (
                           <label key={member.uid} className="flex items-center space-x-3 cursor-pointer p-1 hover:bg-gray-50 rounded">
                               <input 
                                   type="checkbox"
                                   checked={isSelected}
                                   onChange={() => handleToggleSplitMember(member.uid)}
                                   className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                               />
                               <span className={`text-sm ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                   {member.uid === currentUser.uid ? 'You' : member.username}
                               </span>
                           </label>
                       );
                   })}
                </div>
                
                <div className="flex gap-2 mt-2 justify-end">
                    <button 
                        onClick={() => setSplitMembers(group.members)}
                        className="text-xs text-blue-600 hover:underline"
                    >
                        Select All
                    </button>
                    <button 
                        onClick={() => setSplitMembers([])}
                        className="text-xs text-gray-500 hover:underline"
                    >
                        Clear All
                    </button>
                </div>
             </div>
           )}

           {/* EXACT MODE */}
           {splitType === 'EXACT' && (
             <div className="space-y-2">
               {memberProfiles.map(member => (
                 <div key={member.uid} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 truncate w-1/2">
                        {member.uid === currentUser.uid ? 'You' : member.username}
                    </span>
                    <div className="relative w-1/2">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-gray-400 text-xs">₹</span>
                        <input 
                            type="number"
                            value={exactAmounts[member.uid]}
                            onChange={(e) => handleExactChange(member.uid, e.target.value)}
                            className="w-full pl-6 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                        />
                    </div>
                 </div>
               ))}
               
               {/* Math Check */}
               <div className={`mt-2 text-xs font-medium text-right ${Math.abs(getRemaining()) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
                  {Math.abs(getRemaining()) < 0.01 
                    ? "✓ Amounts match total" 
                    : `${getRemaining() > 0 ? 'Remaining' : 'Over'}: ₹${Math.abs(getRemaining()).toFixed(2)}`
                  }
               </div>
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting || (splitType === 'EXACT' && Math.abs(getRemaining()) > 0.01)}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default AddSharedExpenseModal;