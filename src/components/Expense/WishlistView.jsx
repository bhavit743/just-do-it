// src/components/Expense/WishlistView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db } from '../../firebaseConfig';
// 1. IMPORT writeBatch
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy, getDocs, Timestamp, where, limit, writeBatch } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';

import Modal from '../common/Modal'; 
import AdjustSavingsModal from './AdjustSavingsModal';
import EditWishlistItemForm from './EditWishlistItemForm';
import SavingsLogView from './SavingsLogView';


const formatCurrency = (amount, currency = 'INR') => {
    const numAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: currency, 
        minimumFractionDigits: 2 
    }).format(numAmount);
};

function WishlistView() {
    const { user, userProfile } = useOutletContext();
    const userId = user?.uid;
    const userCurrency = userProfile?.currency || 'INR';
    const userDocRef = React.useMemo(() => doc(db, 'users', userId), [userId]); 
    
    const [wishlist, setWishlist] = useState([]);
    const [monthlyBudgets, setMonthlyBudgets] = useState({});
    const [savingsLog, setSavingsLog] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null); 
    
    // UI State
    const [activeTab, setActiveTab] = useState('goals'); 
    const [isAdding, setIsAdding] = useState(false); 
    const [openMenuId, setOpenMenuId] = useState(null); 

    // Input States
    const [itemName, setItemName] = useState('');
    const [itemCost, setItemCost] = useState('');
    const [priorityInput, setPriorityInput] = useState(1); 

    // --- 1. Fetch All Data ---
    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        
        let budgetsLoaded = false, wishlistLoaded = false, logLoaded = false;
        const checkLoaded = () => { if (budgetsLoaded && wishlistLoaded && logLoaded) setLoading(false); };

        const qWishlist = query(collection(db, `users/${userId}/wishlist`), orderBy('createdAt', 'asc'));
        const unsubWishlist = onSnapshot(qWishlist, (snapshot) => {
            setWishlist(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            wishlistLoaded = true; checkLoaded();
        });

        const qBudgets = query(collection(db, `users/${userId}/monthly_budgets`));
        const unsubBudgets = onSnapshot(qBudgets, (snapshot) => { // Now real-time
            const budgets = {};
            snapshot.docs.forEach(doc => budgets[doc.id] = doc.data());
            setMonthlyBudgets(budgets);
            budgetsLoaded = true; checkLoaded();
        }, (error) => { console.error("Error fetching budgets:", error); budgetsLoaded = true; checkLoaded(); });

        const qLog = query(collection(db, `users/${userId}/savings_log`), orderBy('timestamp', 'desc'));
        const unsubLog = onSnapshot(qLog, (snapshot) => {
            setSavingsLog(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            logLoaded = true; checkLoaded();
        });

        return () => { unsubWishlist(); unsubLog(); unsubBudgets(); };
    }, [userId]);

    // --- 2. Calculation Logic (FIXED) ---
    const { totalSavings, netSavings, currentGoals, pastGoals } = useMemo(() => {
        // Use the *saved* net savings from each month's budget doc
        const totalNetSavingsFromMonths = Object.values(monthlyBudgets).reduce((total, budget) => {
            return total + Number(budget.netMonthlySavings || 0);
        }, 0);
        
        const totalSpentFromLog = savingsLog.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const netSavings = totalNetSavingsFromMonths + totalSpentFromLog;

        // Priority-Based Distribution Logic
        const sortedWishlist = [...wishlist]
            .filter(item => !item.isCompleted) 
            .sort((a, b) => a.priority - b.priority); 
        
        let remainingFunds = netSavings;

        const distributedList = sortedWishlist.map(item => {
            const needed = item.cost;
            const allocated = Math.min(needed, remainingFunds);
            if (allocated > 0) remainingFunds -= allocated;
            const progress = (allocated / item.cost) * 100;
            return { ...item, allocated, progress: Math.min(100, progress) };
        });
        
        const currentGoals = distributedList;
        const pastGoals = wishlist.filter(item => item.isCompleted);

        return { totalSavings: totalNetSavingsFromMonths, netSavings, currentGoals, pastGoals };
    }, [wishlist, monthlyBudgets, savingsLog]);

    // --- 3. CRUD Handlers ---
    const handleAddItem = async (e) => {
        e.preventDefault();
        const cost = Number(itemCost);
        const priority = Number(priorityInput);
        
        if (!itemName || cost <= 0 || priority <= 0 || !userId) {
             Toast.show({ text: 'Please enter valid Name, Cost (>0), and Priority (>0).', duration: 'long' });
            return;
        }

        try {
            await addDoc(collection(db, `users/${userId}/wishlist`), {
                name: itemName, cost, priority, 
                createdAt: Timestamp.now(), isCompleted: false,
            });
            Toast.show({ text: 'Item added successfully!', duration: 'short' });
            setItemName(''); setItemCost(''); setPriorityInput(1);
            setIsAdding(false); 
        } catch (e) {
            console.error("Error adding item:", e);
            Toast.show({ text: 'Failed to add item.', duration: 'long' });
        }
    };
    
    const handleDeleteItem = (id) => {
        if (!userId) return;
        if (window.confirm("Are you sure you want to delete this wishlist item?")) {
            deleteDoc(doc(db, `users/${userId}/wishlist`, id));
        }
    };

    // --- 4. handleMarkComplete (FIXED) ---
    const handleMarkComplete = async (item) => {
        if (!userId || !window.confirm(`Mark "${item.name}" as completed? This will deduct its cost from your net savings.`)) return;
        try {
            const batch = writeBatch(db); // <-- 2. Use writeBatch from client SDK
            
            const itemRef = doc(db, `users/${userId}/wishlist`, item.id);
            batch.update(itemRef, { isCompleted: true, completedAt: Timestamp.now() });

            const logRef = doc(collection(db, `users/${userId}/savings_log`)); // Create new doc ref
            batch.set(logRef, {
                amount: -item.cost,
                header: `Goal Achieved: ${item.name}`,
                type: 'GOAL_COMPLETED',
                timestamp: Timestamp.now(),
                relatedGoalId: item.id,
            });

            await batch.commit(); // <-- 3. Commit the batch
            Toast.show({ text: `Goal ${item.name} archived!`, duration: 'short' });
        } catch (e) { Toast.show({ text: 'Failed to complete goal.', duration: 'long' }); }
    };
    
    // --- 5. handleRevertCompletion (FIXED) ---
    const handleRevertCompletion = async (itemId, itemName) => {
        if (!userId || !window.confirm(`Revert completion for "${itemName}"? This will move it back to active goals and return the funds to your savings.`)) return;
        try {
            const batch = writeBatch(db); // <-- Use batch for safety
            const logCollectionRef = collection(db, `users/${userId}/savings_log`);
            
            const q = query(logCollectionRef, where('relatedGoalId', '==', itemId), limit(1));
            const logSnapshot = await getDocs(q);

            if (!logSnapshot.empty) {
                const logDocRef = logSnapshot.docs[0].ref;
                batch.delete(logDocRef); // Delete the log entry
            }

            const itemRef = doc(db, `users/${userId}/wishlist`, itemId);
            batch.update(itemRef, { isCompleted: false, completedAt: null }); // Revert item

            await batch.commit();
            Toast.show({ text: `${itemName} reverted to active goals.`, duration: 'short' });
        } catch (e) { Toast.show({ text: 'Failed to revert goal status.', duration: 'long' }); }
    };


    if (loading) {
         return (
             <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Loading wishlist...</p>
            </div>
        );
    }

    // RENDER CONTENT based on active tab
    const renderContent = () => {
        if (activeTab === 'goals') {
            return (
                <div className="space-y-3">
                    {currentGoals.length === 0 ? (
                        <p className="text-gray-500 p-4 bg-gray-50 rounded-lg">No active goals. Time to dream big!</p>
                    ) : (
                        currentGoals.map(item => {
                            const remaining = item.cost - item.allocated;
                            return (
                                <div key={item.id} className="p-4 bg-white rounded-2xl shadow-lg border border-gray-100 relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex flex-col pr-3 min-w-0 flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <h4 className="text-lg font-bold text-gray-900 truncate">{item.name}</h4>
                                                <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full flex-shrink-0">
                                                    P{item.priority}
                                                </span>
                                            </div>
                                            <span className="text-lg font-extrabold text-blue-600 mt-1">{formatCurrency(item.cost, userCurrency)}</span>
                                        </div>
                                        <button 
                                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                            className="p-1 text-gray-500 hover:text-gray-900 flex-shrink-0"
                                            title="More Options"
                                        >
                                            <i className="fas fa-ellipsis-v"></i>
                                        </button>
                                    </div>
                                    
                                    {openMenuId === item.id && (
                                        <div className="absolute right-3 top-10 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-10 overflow-hidden">
                                            <button onClick={() => { setItemToEdit(item); setOpenMenuId(null); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-blue-600 hover:bg-gray-100">
                                                <i className="fas fa-pencil-alt mr-2 w-4"></i> Edit Item
                                            </button>
                                            <button onClick={() => { handleMarkComplete(item); setOpenMenuId(null); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-green-600 hover:bg-gray-100">
                                                <i className="fas fa-check-circle mr-2 w-4"></i> Mark Complete
                                            </button>
                                            <button onClick={() => { handleDeleteItem(item.id); setOpenMenuId(null); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 border-t">
                                                <i className="fas fa-trash-alt mr-2 w-4"></i> Delete Item
                                            </button>
                                        </div>
                                    )}

                                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                                            style={{ width: `${item.progress}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600 pt-1">
                                        <span className="font-semibold text-gray-900">{formatCurrency(item.allocated, userCurrency)} Allocated</span>
                                        {/* --- 6. FIX: Correctly show "Fully Funded" --- */}
                                        <span className={'font-semibold ' + (remaining > 0.01 ? 'text-orange-600' : 'text-green-600')}>
                                            {remaining > 0.01 ? `Needs: ${formatCurrency(remaining, userCurrency)}` : 'Fully Funded!'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            );
        } else if (activeTab === 'past') {
            return (
                <div className="space-y-3">
                    <h4 className="text-xl font-semibold text-gray-800 mb-4">Completed Goals</h4>
                    {pastGoals.length === 0 ? (
                        <p className="text-gray-500 p-4 bg-gray-50 rounded-lg">No completed goals have been achieved yet.</p>
                    ) : (
                        pastGoals.map(item => (
                            <div key={item.id} className="p-4 bg-white rounded-2xl shadow border border-gray-100 opacity-70">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-lg font-bold text-gray-900 line-through">{item.name}</p>
                                        <p className="text-sm text-green-700">Achieved: {item.completedAt ? new Date(item.completedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    <span className="text-lg font-bold text-gray-500 line-through">{formatCurrency(item.cost, userCurrency)}</span>
                                </div>
                                <div className="flex justify-end space-x-3 border-t pt-3 mt-3">
                                    <button 
                                        onClick={() => handleRevertCompletion(item.id, item.name)}
                                        className="text-blue-500 hover:text-blue-700 p-1 px-2 text-sm font-medium bg-blue-50 rounded-lg"
                                        title="Revert Status"
                                    >
                                        <i className="fas fa-undo mr-1"></i> Revert
                                    </button>
                                    <button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700 p-1 px-2 text-sm font-medium bg-red-50 rounded-lg" title="Delete item">
                                        <i className="fas fa-trash-alt mr-1"></i> Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            );
        } else if (activeTab === 'log') {
            return <SavingsLogView userId={userId} savingsLog={savingsLog} userCurrency={userCurrency} />;
        }
    };


    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900">Wishlist</h2>
            
            {/* --- Modals --- */}
            {itemToEdit && (
                <Modal title={`Edit ${itemToEdit.name}`} onClose={() => setItemToEdit(null)}>
                    <EditWishlistItemForm
                        userId={userId}
                        itemToEdit={itemToEdit}
                        onClose={() => setItemToEdit(null)}
                    />
                </Modal>
            )}
            {isAdjustModalOpen && (
                <Modal title="Adjust Savings Spent" onClose={() => setIsAdjustModalOpen(false)}>
                    <AdjustSavingsModal
                        userDocRef={userDocRef}
                        initialSpent={userProfile?.accumulatedSavingsSpent}
                        totalPotentialSavings={totalSavings}
                        userCurrency={userCurrency}
                        onClose={() => setIsAdjustModalOpen(false)}
                    />
                </Modal>
            )}

            {/* Total Savings Tracker (Header) */}
            <div className="bg-green-50 p-6 rounded-xl shadow-lg border border-green-200">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-green-700">Net Available Savings:</p>
                        <p className="text-4xl font-extrabold text-green-600 mt-1">
                            {formatCurrency(netSavings, userCurrency)}
                        </p>
                    </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 border-t pt-2">
                    Total Accumulated Net Savings: {formatCurrency(totalSavings, userCurrency)}
                </p>
            </div>
            
            {/* Warning if savings are zero */}
            {totalSavings <= 0 && !loading && (
                <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg shadow-md">
                    <p className="font-semibold">
                        ⚠️ Savings are currently {formatCurrency(totalSavings, userCurrency)}. 
                        Please set your Monthly Income/Fixed Expenses in the Budget tab to enable tracking.
                    </p>
                </div>
            )}

            {/* --- Action Bar (Buttons) above the list --- */}
            <div className="flex space-x-3">
                {/* Add Item Button (PURPLE) */}
                <button
                    onClick={() => setIsAdding(!isAdding)} // Toggle form visibility
                    className="flex-1 py-3 px-4 text-white font-bold rounded-lg shadow-md bg-blue-600 hover:bg-purple-700 transition flex items-center justify-center space-x-2"
                >
                    <i className="fas fa-plus-circle"></i>
                    <span>{isAdding ? 'Close Form' : 'Add New Goal'}</span>
                </button>

                {/* Adjust Savings Button (ORANGE) */}
                <button
                    onClick={() => setIsAdjustModalOpen(true)} // Open modal
                    className="flex-1 py-3 px-4 text-black font-bold rounded-lg shadow-md bg-white-600 hover:bg-orange-700 transition flex items-center justify-center space-x-2 border-blue-600"
                >
                    <i className="fas fa-sliders-h"></i>
                    <span>Adjust Savings</span>
                </button>
            </div>

            {/* --- Tab Navigation --- */}
            <nav className="flex justify-center space-x-4 pb-2">
                {['goals', 'past', 'log'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab 
                                ? 'border-blue-600 text-blue-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab === 'goals' ? 'Current Goals' : tab === 'past' ? 'Past Items' : 'Savings Log'}
                    </button>
                ))}
            </nav>

            {/* List & Content Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                
                {/* --- Conditional Add New Item Form --- */}
                {isAdding && (
                    <div className="p-4 mb-4 bg-gray-50 rounded-lg shadow-inner">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Add New Goal</h3>
                        <form onSubmit={handleAddItem} className="space-y-3">
                            <input type="text" placeholder="Goal Name" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
                            <div className="flex gap-3">
                                <input type="number" placeholder="Cost" value={itemCost} onChange={(e) => setItemCost(e.target.value)} className="w-1.2 px-3 py-2 border rounded-lg" min="1" required />
                                <input type="number" placeholder="Priority (1=High)" value={priorityInput} onChange={(e) => setPriorityInput(e.target.value)} className="w-full px-3 py-2 border rounded-lg" min="1" required />
                            </div>
                            <button type="submit" className="w-full py-2 text-white font-medium bg-blue-600 hover:bg-purple-700 transition rounded-lg">
                                Save New Goal
                            </button>
                        </form>
                        <hr className="my-6" />
                    </div>
                )}
                {/* --- END CONDITIONAL FORM --- */}

                {/* Content Rendered Here */}
                {renderContent()}

            </div>
        </div>
    );
}

export default WishlistView;