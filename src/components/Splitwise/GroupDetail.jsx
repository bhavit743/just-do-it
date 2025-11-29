import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { 
  collection, doc, query, orderBy, onSnapshot, where, documentId, getDocs 
} from 'firebase/firestore';
import AddSharedExpenseModal from './AddSharedExpenseModal';
import EditGroupModal from './EditGroupModal';
import SharedExpenseDetailModal from './SharedExpenseDetailModal';
import SettleUpModal from './SettleUpModal';
import Accordion from '../common/Accordion';

// Helper to format currency
const formatMoney = (amount) => {
  return `₹${Math.abs(amount).toFixed(2)}`;
};

function GroupDetail({ group: initialGroup, currentUser, onBack }) {
  const [groupData, setGroupData] = useState(initialGroup);
  // Renamed to allActivities because it now holds Expenses + Settlements
  const [allActivities, setAllActivities] = useState([]); 
  const [memberNames, setMemberNames] = useState({}); // Store UID -> Name mapping
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expenses'); 
  
  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  
  // Settle Up State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleData, setSettleData] = useState(null);

  // 1. LISTEN TO GROUP METADATA
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'groups', initialGroup.id), (doc) => {
      if (doc.exists()) {
        setGroupData({ id: doc.id, ...doc.data() });
      }
    });
    return () => unsub();
  }, [initialGroup.id]);

  // 2. FETCH MEMBER NAMES (Real Names)
  useEffect(() => {
    const fetchMembers = async () => {
      if (!groupData.members || groupData.members.length === 0) return;
      
      try {
        const membersToFetch = groupData.members.slice(0, 10); 
        const q = query(collection(db, 'users'), where(documentId(), 'in', membersToFetch));
        const snapshot = await getDocs(q);
        
        const names = {};
        snapshot.docs.forEach(doc => {
          names[doc.id] = doc.data().username || 'Unknown';
        });
        setMemberNames(names);
      } catch (e) {
        console.error("Error fetching names:", e);
      }
    };
    fetchMembers();
  }, [groupData.members]);

  // 3. LISTEN TO ALL ACTIVITIES (Expenses + Settlements)
  useEffect(() => {
    const q = query(
      collection(db, 'groups', initialGroup.id, 'expenses'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllActivities(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [initialGroup.id]);

  // 4. SEPARATE LISTS (Expenses vs Settlements)
  const { expensesList, settlementsLog } = useMemo(() => {
    return {
        expensesList: allActivities.filter(a => a.type !== 'SETTLEMENT'),
        settlementsLog: allActivities.filter(a => a.type === 'SETTLEMENT')
    };
  }, [allActivities]);

  // 5. CALCULATE BALANCES & SETTLEMENT PLAN
  const { memberBalances, myNetBalance, settlementPlan } = useMemo(() => {
    const balances = {};
    
    // A. Initialize
    groupData.members.forEach(uid => balances[uid] = 0);

    // B. Process ALL Activities (Expenses AND Settlements)
    allActivities.forEach(item => {
      const paidBy = item.paidBy;
      const amount = parseFloat(item.amount);

      // Credit payer
      if (balances[paidBy] !== undefined) balances[paidBy] += amount;

      // Debit consumers (or receiver of settlement)
      if (item.splitMap) {
        Object.entries(item.splitMap).forEach(([uid, share]) => {
          if (balances[uid] !== undefined) balances[uid] -= parseFloat(share);
        });
      }
    });

    // C. Calculate Settlement Graph (Who pays whom based on CURRENT net balance)
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([uid, amount]) => {
      if (amount < -0.01) debtors.push({ uid, amount });
      if (amount > 0.01) creditors.push({ uid, amount });
    });

    debtors.sort((a, b) => a.amount - b.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const plan = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      let debtor = debtors[i];
      let creditor = creditors[j];

      let amount = Math.min(Math.abs(debtor.amount), creditor.amount);

      if (amount > 0.01) {
        plan.push({
          from: debtor.uid,
          to: creditor.uid,
          amount
        });
      }

      debtor.amount += amount;
      creditor.amount -= amount;

      if (Math.abs(debtor.amount) < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return { 
      memberBalances: balances, 
      myNetBalance: balances[currentUser.uid] || 0,
      settlementPlan: plan 
    };
  }, [allActivities, groupData.members, currentUser.uid]);


  // --- HELPERS ---
  const getMyExpenseImpact = (expense) => {
    const myShare = expense.splitMap?.[currentUser.uid] || 0;
    const paidByMe = expense.paidBy === currentUser.uid;
    return (paidByMe ? expense.amount : 0) - myShare;
  };

  const getName = (uid) => {
    if (uid === currentUser.uid) return 'You';
    return memberNames[uid] || 'Loading...';
  };

  const openSettleModal = (debtorId, creditorId, amount) => {
    setSettleData({
        debtor: { uid: debtorId, username: getName(debtorId) },
        creditor: { uid: creditorId, username: getName(creditorId) },
        amount: amount.toFixed(2)
    });
    setSettleModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-white md:rounded-2xl shadow-sm overflow-hidden relative">
      
      {/* --- HEADER --- */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white shadow-md">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full transition">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg backdrop-blur-sm">
            {groupData.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold truncate">{groupData.name}</h2>
            <p className="text-xs text-blue-100 opacity-90">
              {groupData.members?.length} members
            </p>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-white/20 rounded-full"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>

        {/* --- SUMMARY CARD --- */}
        <div className="mt-6 bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/10 transition-all">
          <p className="text-sm text-blue-50 font-medium">Your Net Balance</p>
          <div className="flex items-baseline mt-1 space-x-2">
            {Math.abs(myNetBalance) < 0.01 ? (
              <p className="text-2xl font-bold text-white">
                {formatMoney(0)} <span className="text-sm font-normal opacity-80 ml-1">Settled up</span>
              </p>
            ) : myNetBalance > 0 ? (
              <>
                <p className="text-3xl font-bold text-green-300">+{formatMoney(myNetBalance)}</p>
                <span className="text-xs font-bold text-green-200 bg-green-900/30 px-2 py-1 rounded uppercase tracking-wide">
                   Gets back
                </span>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-orange-300">-{formatMoney(myNetBalance)}</p>
                <span className="text-xs font-bold text-orange-200 bg-orange-900/30 px-2 py-1 rounded uppercase tracking-wide">
                   Owes
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- TABS --- */}
      <div className="flex border-b border-gray-100">
        <button 
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'expenses' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Expenses
        </button>
        <button 
          onClick={() => setActiveTab('balances')}
          className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'balances' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
        >
          Balances
        </button>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 pb-24">
        
        {/* TAB: EXPENSES */}
        {activeTab === 'expenses' && (
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-gray-400 mt-10">Loading...</p>
            ) : expensesList.length === 0 ? (
              <div className="text-center mt-10 opacity-60">
                <i className="fas fa-receipt text-4xl text-gray-300 mb-2"></i>
                <p className="text-gray-500">No expenses yet.</p>
              </div>
            ) : (
              expensesList.map(expense => {
                const netImpact = getMyExpenseImpact(expense);
                const isLending = netImpact > 0.01;
                const isBorrowing = netImpact < -0.01;
                const payerName = getName(expense.paidBy);

                return (
                  <div 
                    key={expense.id} 
                    onClick={() => setSelectedExpense(expense)}
                    className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="text-gray-400 text-xs flex flex-col items-center w-10 shrink-0 bg-gray-50 p-1 rounded">
                          <span className="font-bold text-lg leading-none">{expense.date?.seconds ? new Date(expense.date.seconds * 1000).getDate() : '-'}</span>
                          <span className="uppercase text-[9px]">{expense.date?.seconds ? new Date(expense.date.seconds * 1000).toLocaleString('default', { month: 'short' }) : '-'}</span>
                      </div>
                      <div className="truncate">
                          <p className="font-bold text-gray-800 truncate">{expense.description}</p>
                          <p className="text-xs text-gray-500">
                              <span className="font-semibold text-gray-700">{payerName}</span> paid {formatMoney(expense.amount)}
                          </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 min-w-[80px]">
                        {isLending && (
                          <>
                            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wide">you lent</p>
                            <p className="text-sm font-bold text-green-600">{formatMoney(netImpact)}</p>
                          </>
                        )}
                        {isBorrowing && (
                          <>
                            <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wide">you borrowed</p>
                            <p className="text-sm font-bold text-orange-600">{formatMoney(netImpact)}</p>
                          </>
                        )}
                        {!isLending && !isBorrowing && (
                          <p className="text-xs text-gray-400">not involved</p>
                        )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB: BALANCES */}
        {activeTab === 'balances' && (
          <div className="space-y-6">
            
            {/* 1. Settlement Plan (Actionable) */}
            {settlementPlan.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">Settlement Plan</h3>
                    <div className="space-y-2">
                        {settlementPlan.map((plan, idx) => {
                            const iOwe = plan.from === currentUser.uid;
                            const owedToMe = plan.to === currentUser.uid;
                            
                            return (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-bold text-gray-800">{getName(plan.from)}</span>
                                            <i className="fas fa-long-arrow-alt-right text-gray-400"></i>
                                            <span className="font-bold text-gray-800">{getName(plan.to)}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 font-medium mt-0.5">{formatMoney(plan.amount)}</span>
                                    </div>
                                    
                                    {/* SETTLE BUTTON: Only show if I owe money */}
                                    {iOwe && (
                                        <button 
                                          onClick={() => openSettleModal(plan.from, plan.to, plan.amount)}
                                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded shadow hover:bg-green-700"
                                        >
                                          Settle
                                        </button>
                                    )}
                                    
                                    {owedToMe && <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">Receiving</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 2. Member Balances */}
            <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">Member Balances</h3>
               <div className="space-y-2">
                  {groupData.members.map(mid => {
                      const bal = memberBalances[mid] || 0;
                      const isMe = mid === currentUser.uid;
                      return (
                          <div key={mid} className={`flex justify-between items-center p-3 rounded-lg border ${isMe ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                              <span className={`text-sm font-medium ${isMe ? 'text-blue-900' : 'text-gray-700'}`}>{getName(mid)} {isMe && '(You)'}</span>
                              <span className={`text-sm font-bold ${bal > 0 ? 'text-green-600' : bal < 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                 {bal > 0 ? '+' : ''}{formatMoney(bal)}
                              </span>
                          </div>
                      )
                  })}
               </div>
            </div>

            {/* 3. SETTLEMENT HISTORY (Collapsible) */}
            {settlementsLog.length > 0 && (
                <div className="mt-4">
                    <Accordion title={`Settlement History (${settlementsLog.length})`}>
                        <div className="space-y-2 pt-2">
                            {settlementsLog.map(log => {
                                // For settlements, paidBy is Payer, splitMap key is Receiver
                                const receiverId = Object.keys(log.splitMap || {})[0];
                                return (
                                  <div key={log.id} className="flex justify-between items-center text-sm p-2 border-b border-gray-100 last:border-0">
                                      <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">
                                              <i className="fas fa-check"></i>
                                          </div>
                                          <span className="text-gray-600 text-xs">
                                              <span className="font-bold text-gray-800">{getName(log.paidBy)}</span> paid <span className="font-bold text-gray-800">{getName(receiverId)}</span>
                                          </span>
                                      </div>
                                      <div className="text-right">
                                         <span className="font-bold text-green-600 block">{formatMoney(log.amount)}</span>
                                         <span className="text-[10px] text-gray-400">{new Date(log.date?.seconds * 1000).toLocaleDateString()}</span>
                                      </div>
                                  </div>
                                );
                            })}
                        </div>
                    </Accordion>
                </div>
            )}

          </div>
        )}
      </div>

      {/* --- FLOATING ACTION BUTTON --- */}
      <div className="absolute bottom-6 right-6">
        <button 
            onClick={() => setIsAddExpenseOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition transform hover:scale-105 active:scale-95"
        >
            <i className="fas fa-plus text-2xl"></i>
        </button>
      </div>

      {/* --- MODALS --- */}
      {isAddExpenseOpen && (
        <AddSharedExpenseModal
          group={groupData}
          currentUser={currentUser}
          onClose={() => setIsAddExpenseOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <EditGroupModal
          group={groupData}
          currentUser={currentUser}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {selectedExpense && (
          <SharedExpenseDetailModal
            group={groupData}
            expense={selectedExpense}
            memberNames={memberNames}
            currentUser={currentUser}
            onClose={() => setSelectedExpense(null)}
          />
      )}

      {settleModalOpen && settleData && (
          <SettleUpModal 
             group={groupData}
             currentUser={currentUser}
             debtor={settleData.debtor}
             creditor={settleData.creditor}
             defaultAmount={settleData.amount}
             onClose={() => setSettleModalOpen(false)}
          />
      )}
    </div>
  );
}

export default GroupDetail;