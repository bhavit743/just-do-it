import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';
// REMOVED: import { updateFriendBalance } from '../../utils/friendBalanceUtils'; // <-- REMOVED

// --- IST HELPER FUNCTIONS (Unchanged) ---
const IST_OFFSET = 19800000;
function formatToIST_YYYY_MM_DD(date) {
  const utcMillis = new Date(date).getTime();
  const istDate = new Date(utcMillis + IST_OFFSET);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function formatDateKey(date) { return formatToIST_YYYY_MM_DD(date); }
// ----------------------------------------

function EditExpenseForm({ userId, expenseToEdit, onDone }) {
    const [categories, setCategories] = useState([]);
    // REMOVED: [friends, setFriends]
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Initial state derived from the expense being edited (REVERTED to use headcount)
    const initialFormData = useMemo(() => {
        const expenseDate = expenseToEdit.timestamp 
            ? formatDateKey(new Date(expenseToEdit.timestamp.seconds * 1000)) 
            : formatDateKey(new Date());

        return {
            amount: expenseToEdit.amount || '',
            payerName: expenseToEdit.payerName || '',
            category: expenseToEdit.category || '',
            newCategory: '',
            date: expenseDate,
            note: expenseToEdit.note || '',
            frequency: expenseToEdit.frequency || 'Non-Recurring',
            headcount: expenseToEdit.headcount || 1, // <-- RESTORED HEADCOUNT
            // REMOVED: splitMethod, selectedFriends, paidBy, splitAmounts, oldSplitData
        };
    }, [expenseToEdit]);
    
    const [formData, setFormData] = useState(initialFormData);

    // --- EFFECT 1: Fetch Categories (REMOVED friends fetch) ---
    useEffect(() => {
        if (!userId) return;

        let categoriesLoaded = false;
        // let friendsLoaded = false; // REMOVED

        const checkLoadingDone = () => {
            if (categoriesLoaded) { // Check only categories
                setLoading(false);
            }
        };

        // Fetch Categories
        const catQuery = query(collection(db, `users/${userId}/categories`), orderBy("name"));
        const unsubscribeCategories = onSnapshot(catQuery, (snapshot) => {
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            categoriesLoaded = true;
            checkLoadingDone();
        }, (err) => { console.error("Category Fetch Error:", err); setLoading(false); });

        // REMOVED: Fetch Friends logic
        
        // Final check after a slight delay in case of empty friend list
        setTimeout(() => { if (!categoriesLoaded) setLoading(false); }, 100); 

        return () => {
            unsubscribeCategories();
            // unsubscribeFriends(); // REMOVED
        };
    }, [userId]);

    // --- Form Handlers (REVERTED to simple field change) ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // Removed all split/manual input logic
        
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'category' && value !== '--OTHER--') {
            setFormData(prev => ({ ...prev, newCategory: '' }));
        }
    };

    // --- CORE SAVE LOGIC (REVERTED TO HEADCOUNT) ---
    const handleSaveExpense = async (e) => {
        e.preventDefault();
        setSaveStatus(null);
        setIsSaving(true);

        const totalAmount = parseFloat(formData.amount);
        if (isNaN(totalAmount) || totalAmount <= 0) {
            alert("Please enter a valid amount.");
            setIsSaving(false);
            return;
        }

        let finalCategory = formData.category;
        
        if (finalCategory === '--OTHER--') {
            finalCategory = formData.newCategory.trim().toUpperCase();
            if (!finalCategory) { alert("Please enter a name for the new category."); setIsSaving(false); return; }
        }

        // --- SIMPLE SAVE DATA STRUCTURE ---
        const expenseDocRef = doc(db, `users/${userId}/expenses`, expenseToEdit.id);

        const expenseData = {
            amount: totalAmount,
            payerName: formData.payerName.trim(),
            category: finalCategory,
            timestamp: Timestamp.fromDate(new Date(formData.date + 'T00:00:00')), 
            userId: userId,
            headcount: Number(formData.headcount) || 1, // <-- RESTORED HEADCOUNT
            note: formData.note.trim(), 
            frequency: formData.frequency,
            // REMOVED: yourShare, split object, etc.
        };

        try {
            // 1. Save Primary Expense Record (Update existing document)
            await updateDoc(expenseDocRef, expenseData);

            // REMOVED: Debt reversal and update logic

            // 3. Save new category logic (Existing)
            if (finalCategory === formData.newCategory.trim().toUpperCase() && !categories.find(c => c.name === finalCategory)) {
                await addDoc(collection(db, `users/${userId}/categories`), {
                    name: finalCategory,
                    createdAt: Timestamp.now(),
                    color: '#6B7280'
                });
            }

            setSaveStatus('success');
            setTimeout(onDone, 1000); 

        } catch (error) {
            console.error("Error updating expense:", error);
            setSaveStatus('error');
            Toast.show({ text: `Failed to save changes: ${error.message}`, duration: 'long' });
            setTimeout(() => setSaveStatus(null), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Loading data...</p>
            </div>
        );
    }

    const categoryOptions = categories.map(cat => (
        <option key={cat.id} value={cat.name}>{cat.name}</option>
    ));

    // REMOVED: UI Validation for Manual Split

    return (
        <form onSubmit={handleSaveExpense} className="space-y-4">

            {/* --- Existing inputs: Amount & Headcount --- */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount (Total)</label>
                    <input
                        type="number" id="amount" name="amount" step="0.01"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={formData.amount} onChange={handleChange} required
                    />
                </div>
                <div className="w-1/3">
                    <label htmlFor="headcount" className="block text-sm font-medium text-gray-700">Split By</label>
                    <input
                        type="number" id="headcount" name="headcount" min="1" step="1"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={formData.headcount} onChange={handleChange} required
                    />
                </div>
            </div>
            
            {/* REMOVED: Payer Selection & SPLIT SECTION FIELDSET */}


            {/* --- Existing Inputs (PayerName, Frequency, Category, Date, Note) --- */}
            <div>
                <label htmlFor="payerName" className="block text-sm font-medium text-gray-700">Paid To (Merchant/Payer)</label>
                <input
                    type="text" id="payerName" name="payerName"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={formData.payerName} onChange={handleChange} required
                />
            </div>
            
            <div>
                <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">Type</label>
                <select
                    id="frequency" name="frequency"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                    value={formData.frequency} onChange={handleChange}
                >
                    <option value="Non-Recurring">Non-Recurring</option>
                    <option value="Recurring">Recurring</option>
                    <option value="Investment">Investment</option>
                </select>
            </div>

            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                <select
                    id="category" name="category"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                    value={formData.category} onChange={handleChange} required
                >
                    <option value="" disabled>-- Select Category --</option>
                    {categoryOptions}
                    <option value="--OTHER--">** Add New... **</option>
                </select>
            </div>

            {formData.category === '--OTHER--' && (
                <div>
                    <label htmlFor="newCategory" className="block text-sm font-medium text-gray-700">New Category Name</label>
                    <input
                        type="text" id="newCategory" name="newCategory"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={formData.newCategory} onChange={handleChange} required
                    />
                </div>
            )}

            <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                <input
                    type="date" id="date" name="date"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={formData.date} onChange={handleChange} required
                />
            </div>

            <div>
                <label htmlFor="note" className="block text-sm font-medium text-gray-700">Note (Optional)</label>
                <input
                    type="text" id="note" name="note"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={formData.note} onChange={handleChange}
                    placeholder="e.g., Dinner with team"
                />
            </div>


            <button
                type="submit"
                className={`w-full py-3 px-4 text-white font-bold rounded-lg shadow transition ${
                    isSaving
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700'
                }`}
                disabled={isSaving}
            >
                {isSaving ? (
                    <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24"></svg>
                        Saving Changes...
                    </span>
                ) : (
                    'Save Changes'
                )}
            </button>

            {saveStatus === 'success' && (
                <div className="p-3 text-center bg-green-100 text-green-700 rounded-lg">
                    Transaction saved successfully!
                </div>
            )}
            {saveStatus === 'error' && (
                <div className="p-3 text-center bg-red-100 text-red-700 rounded-lg">
                    Save failed. Please try again.
                </div>
            )}
        </form>
    );
}

export default EditExpenseForm;