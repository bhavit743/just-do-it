import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { writeBatch, doc, collection, Timestamp, increment } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';
import Modal from '../common/Modal';

function SettleUpModal({ group, currentUser, debtor, creditor, defaultAmount, onClose }) {
  // Logic: If I am the debtor, I am paying. If I am the creditor, I am receiving.
  // We default to "I am paying" if debtor is me.
  const isPaying = currentUser.uid === debtor?.uid;
  
  const [amount, setAmount] = useState(defaultAmount || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSettle = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      await Toast.show({ text: 'Enter a valid amount' });
      return;
    }

    setIsSubmitting(true);
    const numericAmount = parseFloat(amount);

    try {
      const batch = writeBatch(db);
      
      // Timestamp logic
      const selectedDateObj = new Date(date);
      selectedDateObj.setHours(12, 0, 0, 0);
      const timestampDate = Timestamp.fromDate(selectedDateObj);

      // --- 1. CREATE SETTLEMENT RECORD IN GROUP ---
      const settlementRef = doc(collection(db, 'groups', group.id, 'expenses'));
      
      const payerId = isPaying ? currentUser.uid : debtor.uid;
      const receiverId = isPaying ? creditor.uid : currentUser.uid;

      batch.set(settlementRef, {
        description: 'Settlement',
        type: 'SETTLEMENT', 
        amount: numericAmount,
        paidBy: payerId,
        date: timestampDate,
        splitMap: { [receiverId]: numericAmount }, // The receiver "consumed" the full amount
        members: group.members
      });

      // --- 2. UPDATE GROUP BALANCES (CRITICAL UPDATE) ---
      const groupRef = doc(db, 'groups', group.id);
      
      // Payer gives money -> Balance increases (e.g. -500 + 500 = 0)
      batch.update(groupRef, { 
          [`balances.${payerId}`]: increment(numericAmount) 
      });
      
      // Receiver gets money -> Balance decreases (e.g. +500 - 500 = 0)
      batch.update(groupRef, { 
          [`balances.${receiverId}`]: increment(-numericAmount) 
      });

      // --- 3. SYNC TO PERSONAL TRACKER ---
      const personalRef = doc(collection(db, `users/${currentUser.uid}/expenses`));
      
      if (isPaying) {
        // Expense: I paid money out
        batch.set(personalRef, {
          amount: numericAmount,
          category: 'Settlement',
          description: `Paid ${creditor.username || 'friend'} in ${group.name}`,
          date: timestampDate,
          isShared: true,
          sharedGroupId: group.id,
          sharedExpenseId: settlementRef.id,
          recoverableAmount: 0 
        });
      } else {
        // Income: I received money
         batch.set(personalRef, {
          amount: -numericAmount, // Negative expense = Income
          category: 'Income',
          description: `Received from ${debtor.username || 'friend'} in ${group.name}`,
          date: timestampDate,
          isShared: true,
          sharedGroupId: group.id,
          sharedExpenseId: settlementRef.id,
          recoverableAmount: 0
        });
      }

      await batch.commit();
      await Toast.show({ text: 'Settled successfully!' });
      onClose();

    } catch (error) {
      console.error(error);
      await Toast.show({ text: 'Settlement failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetName = isPaying ? creditor?.username : debtor?.username;

  return (
    <Modal title="Settle Up" onClose={onClose}>
      <div className="space-y-6 text-center">
        
        <div className="bg-green-50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-green-600 mb-2">
            <i className="fas fa-handshake text-3xl"></i>
        </div>

        <div>
            <p className="text-gray-500 text-sm">
                {isPaying ? `You are paying` : `You are receiving from`}
            </p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{targetName}</h3>
        </div>

        {/* Amount Input (Editable) */}
        <div className="relative max-w-xs mx-auto">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold text-lg">₹</span>
            <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                className="block w-full pl-8 py-3 text-3xl font-bold text-gray-900 border-b-2 border-green-500 text-center focus:outline-none focus:border-green-600"
                placeholder="0.00"
                autoFocus
            />
        </div>

        {/* Date Input */}
        <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
            <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border rounded p-2 text-sm text-gray-600 bg-gray-50 w-full"
            />
        </div>

        {/* Action Button */}
        <button 
            onClick={handleSettle}
            disabled={isSubmitting}
            className="w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition transform active:scale-95 disabled:opacity-50"
        >
            {isSubmitting ? 'Processing...' : `Pay ₹${amount || '0'}`}
        </button>

      </div>
    </Modal>
  );
}

export default SettleUpModal;