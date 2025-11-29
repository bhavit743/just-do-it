import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import GroupList from './Grouplist';
import GroupDetail from './GroupDetail';
import CreateGroupModal from './CreateGroupModal';

const formatMoney = (amount) => `₹${Math.abs(amount).toFixed(2)}`;

function SplitwiseDashboard() {
  const { user } = useOutletContext(); 
  const userId = user?.uid;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Groups (Moved up here so we can calculate Grand Total)
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'groups'), where('members', 'array-contains', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroups(groupData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching groups:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  // 2. Calculate Grand Total
  const grandTotal = groups.reduce((acc, group) => {
      return acc + (group.balances?.[userId] || 0);
  }, 0);

  if (selectedGroup) {
    return <GroupDetail group={selectedGroup} currentUser={user} onBack={() => setSelectedGroup(null)} />;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-end border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Friends & Groups</h2>
          <p className="text-gray-500 text-sm">Track shared expenses</p>
        </div>
      </div>

      {/* NEW: Grand Total Card */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <p className="text-sm text-gray-400 font-medium uppercase tracking-wider">Total Balance</p>
          <div className="flex items-baseline mt-1 space-x-3 relative z-10">
             <span className={`text-4xl font-bold ${grandTotal > 0 ? 'text-green-400' : grandTotal < 0 ? 'text-orange-400' : 'text-white'}`}>
                 {grandTotal > 0 ? '+' : grandTotal < 0 ? '-' : ''}{formatMoney(grandTotal)}
             </span>
             <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wide ${grandTotal > 0 ? 'bg-green-500/20 text-green-300' : grandTotal < 0 ? 'bg-orange-500/20 text-orange-300' : 'bg-gray-700 text-gray-300'}`}>
                 {grandTotal > 0 ? 'You are owed' : grandTotal < 0 ? 'You owe' : 'Settled'}
             </span>
          </div>
      </div>

      <GroupList 
        userId={userId}
        groups={groups}
        onSelectGroup={(group) => setSelectedGroup(group)}
        onCreateGroup={() => setIsCreateModalOpen(true)}
      />

      {isCreateModalOpen && (
        <CreateGroupModal 
          userId={userId} 
          onClose={() => setIsCreateModalOpen(false)} 
        />
      )}
    </div>
  );
}

export default SplitwiseDashboard;