import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, addDoc } from 'firebase/firestore';

// --- 1. ADD IST HELPER FUNCTIONS ---
const IST_OFFSET = 19800000; // 5.5 * 3600 * 1000

function formatToIST_YYYY_MM_DD(date) {
  const utcMillis = new Date(date).getTime();
  const istDate = new Date(utcMillis + IST_OFFSET);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
// --- END OF IST HELPERS ---


function EditExpenseForm({ userId, expenseToEdit, onDone }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState(null);
    // These keywords/color states are not used in this form, but were in your file.
    // I'll leave them in case you intended to use them later.
    const [keywordsInput, setKeywordsInput] = useState('');
    const [color, setColor] = useState('#6B7280');
    
    const [formData, setFormData] = useState({
        amount: '', payerName: '', category: '', newCategory: '', date: '', headcount: 1
    });

    // --- 2. UPDATE: Use the IST helper ---
    function formatDateKey(date) {
        return formatToIST_YYYY_MM_DD(date);
    }

    // 1. Fetch Categories
    useEffect(() => {
        if (!userId) return;
        const catQuery = query(collection(db, `users/${userId}/categories`), orderBy("name"));
        const unsubscribe = onSnapshot(catQuery, (snapshot) => {
            const catList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(catList);
            setLoading(false);
        }, (err) => {
            console.error("Category Fetch Error:", err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [userId]);

    // --- 3. UPDATE: This useEffect now correctly populates the date in IST ---
    useEffect(() => {
        if (expenseToEdit) {
            setFormData({
                amount: expenseToEdit.amount || '',
                payerName: expenseToEdit.payerName || '',
                category: expenseToEdit.category || '',
                newCategory: '',
                date: expenseToEdit.timestamp ? formatDateKey(new Date(expenseToEdit.timestamp.seconds * 1000)) : formatDateKey(new Date()),
                headcount: expenseToEdit.headcount || 1,
            });
            
            // This logic was in your file, but wasn't being used.
            // Kept for consistency.
            if (expenseToEdit.keywords) {
                setKeywordsInput(expenseToEdit.keywords.join(', '));
            }
            setColor(expenseToEdit.color || '#6B7280');
        }
    }, [expenseToEdit]);

    // 4. Form Handlers
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'category' && value !== '--OTHER--') {
            setFormData(prev => ({ ...prev, newCategory: '' }));
        }
    };

    // 5. Save Logic (This is for the form, not category)
    const handleSaveExpense = async (e) => {
        e.preventDefault();
        setSaveStatus(null);

        let finalCategory = formData.category;
        
        if (finalCategory === '--OTHER--') {
            finalCategory = formData.newCategory.trim().toUpperCase();
            if (!finalCategory) { alert("Please enter a name for the new category."); return; }
        }

        const expenseData = {
            amount: parseFloat(formData.amount),
            payerName: formData.payerName.trim(),
            category: finalCategory,
            timestamp: Timestamp.fromDate(new Date(formData.date + 'T00:00:00')), 
            userId: userId,
            headcount: Number(formData.headcount) || 1
        };

        try {
            const expenseDocRef = doc(db, `users/${userId}/expenses`, expenseToEdit.id);
            await updateDoc(expenseDocRef, expenseData);

            // Save new category if needed
            if (finalCategory === formData.newCategory.trim().toUpperCase() && !categories.find(c => c.name === finalCategory)) {
                await addDoc(collection(db, `users/${userId}/categories`), {
                    name: finalCategory,
                    keywords: [finalCategory], 
                    color: '#6B7280', // Default color
                    createdAt: Timestamp.now(),
                });
            }

            setSaveStatus('success');
            setTimeout(onDone, 1000); // Close modal on success

        } catch (error) {
            console.error("Error updating expense:", error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 5000);
            alert("Failed to save changes.");
        }
    };

    // --- 6. FIX: Return a loading spinner instead of an object ---
    if (loading) {
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Loading categories...</p>
            </div>
        );
    }
    // --- END OF FIX ---

    const categoryOptions = categories.map(cat => (
        <option key={cat.id} value={cat.name}>{cat.name}</option>
    ));

    // This is the form from EditCategoryForm, but for expenses
    return (
        <form onSubmit={handleSaveExpense} className="space-y-4">
            <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                    type="number"
                    id="amount"
                    name="amount"
                    step="0.01"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                />
            </div>

            <div className="w-1/3">
                    <label htmlFor="headcount" className="block text-sm font-medium text-gray-700">Split By</label>
                    <input
                        type="number"
                        id="headcount"
                        name="headcount"
                        min="1"
                        step="1"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={formData.headcount}
                        onChange={handleChange}
                        required
                    />
                </div>

            <div>
                <label htmlFor="payerName" className="block text-sm font-medium text-gray-700">Paid To (Merchant/Payer)</label>
                <input
                    type="text"
                    id="payerName"
                    name="payerName"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    value={formData.payerName}
                    onChange={handleChange}
                    required
                />
            </div>

            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                <select
                    id="category"
                    name="category"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                    value={formData.category}
                    onChange={handleChange}
                    required
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
                        type="text"
                        id="newCategory"
                        name="newCategory"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={formData.newCategory}
                        onChange={handleChange}
                        required
                    />
                </div>
            )}

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

            <button
                type="submit"
                className="w-full py-3 px-4 text-white font-bold bg-green-600 rounded-lg shadow hover:bg-green-700 transition"
            >
                Save Changes
            </button>

            {saveStatus === 'success' && (
                <div className="p-3 text-center bg-green-100 text-green-700 rounded-lg">
                    Changes saved!
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