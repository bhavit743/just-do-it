// src/components/Expense/ManageCategories.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, orderBy, deleteDoc, doc, query, writeBatch, Timestamp } from 'firebase/firestore';

// Default categories for new users
const DEFAULT_CATEGORIES = [
    { name: "FOOD", keywords: ["SWIGGY", "ZOMATO", "RESTAURANT", "LUNCH"] },
    { name: "TRANSPORT", keywords: ["UBER", "OLA", "BUS", "METRO"] },
    { name: "GROCERY", keywords: ["GROCER", "VEGETABLES", "MILK"] },
    { name: "INCOME", keywords: ["SALARY", "FREELANCE", "REFUND"] },
    // Ensure UNCATEGORIZED is always present or handled
    { name: "UNCATEGORIZED", keywords: ["UNCATEGORIZED", "OTHER", "MISC"] } 
];

function ManageCategories({ userId }) {
    const [categoryName, setCategoryName] = useState('');
    const [keywordsInput, setKeywordsInput] = useState(''); // Comma-separated input
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // --- 1. Load Data ---
    useEffect(() => {
        if (!userId) return;

        const categoriesRef = collection(db, `users/${userId}/categories`);
        const q = query(categoriesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const catList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCategories(catList);
            setLoading(false);
        }, (err) => {
            console.error("Category Fetch Error:", err);
            setError("Failed to load categories.");
            setLoading(false);
        });

        // Cleanup subscription
        return () => unsubscribe();
    }, [userId]);

    // --- 2. Load Default Categories (Once on demand) ---
    // This function is manually triggered when the user clicks the button
    const loadDefaults = async () => {
        if (categories.length > 0) {
             setError("Categories already exist. Cannot load defaults.");
             return;
        }

        const batch = writeBatch(db);
        const categoriesRef = collection(db, `users/${userId}/categories`);

        DEFAULT_CATEGORIES.forEach((cat) => {
            const newDocRef = doc(categoriesRef);
            batch.set(newDocRef, {
                name: cat.name,
                keywords: cat.keywords,
                createdAt: Timestamp.now(),
            });
        });

        try {
            await batch.commit();
            setError("Default categories added successfully.");
        } catch (e) {
            console.error("Error loading defaults:", e);
            setError("Failed to load default categories.");
        }
    };

    // --- 3. Handle Add New Category ---
    const handleAddCategory = async (e) => {
        e.preventDefault();
        const name = categoryName.trim().toUpperCase();
        if (name === '') return;

        let keywordsArray = keywordsInput
            .split(',')
            .map(k => k.trim().toUpperCase())
            .filter(k => k.length > 0);
        
        if (!keywordsArray.includes(name)) {
            keywordsArray.push(name);
        }
        keywordsArray = [...new Set(keywordsArray)]; 

        if (categories.find(c => c.name === name)) {
             setError(`Category "${name}" already exists.`);
             return;
        }

        try {
            const categoriesRef = collection(db, `users/${userId}/categories`);
            await addDoc(categoriesRef, {
                name: name,
                keywords: keywordsArray,
                createdAt: Timestamp.now(),
            });
            setCategoryName('');
            setKeywordsInput('');
            setError('');
        } catch (e) {
            console.error("Error adding category: ", e);
            setError("Failed to add category.");
        }
    };

    // --- 4. Handle Delete Category ---
    const handleDeleteCategory = async (categoryId, categoryName) => {
        if (categoryName === 'UNCATEGORIZED') {
            alert("Cannot delete the default 'UNCATEGORIZED' category.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete the category: ${categoryName}?`)) return;
        
        try {
            const catDocRef = doc(db, `users/${userId}/categories/${categoryId}`);
            await deleteDoc(catDocRef);
        } catch (e) {
            console.error("Error deleting category: ", e);
            setError("Failed to delete category.");
        }
    };
    
    // Renders keywords as a single string
    const formatKeywords = (keywords) => keywords.join(', ');


    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">Manage Expense Categories</h3>
            
            {/* Error Notification */}
            {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            {/* 💡 FIX: Display Load Defaults Button if categories are empty and loading is done */}
            {categories.length === 0 && !loading && (
                 <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg shadow-md flex justify-between items-center">
                    <p className="font-semibold">No categories found! Click below to load defaults.</p>
                    <button 
                        className="px-3 py-1 text-sm font-medium text-yellow-900 bg-yellow-300 rounded-lg hover:bg-yellow-400 transition" 
                        onClick={loadDefaults}
                    >
                        Load Defaults
                    </button>
                </div>
            )}
            
            {/* Category Input Form */}
            <div className="bg-white p-6 rounded-xl shadow-xl">
                <p className="text-xl font-semibold mb-4">Add New Category</p>
                <form onSubmit={handleAddCategory} className="space-y-4">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700" htmlFor="category-name">Name (e.g., FOOD, RENT)</label>
                        <input
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            type="text"
                            id="category-name"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700" htmlFor="keywords-input">Keywords (Comma Separated)</label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                            id="keywords-input"
                            placeholder="e.g., ZOMATO, SWIGGY, LUNCH"
                            rows="3"
                            value={keywordsInput}
                            onChange={(e) => setKeywordsInput(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">These keywords help auto-categorize transactions.</p>
                    </div>

                    <div>
                        <button type="submit" className="w-full py-3 px-4 text-white font-bold bg-blue-600 rounded-lg shadow hover:bg-blue-700 transition">
                            Add Category
                        </button>
                    </div>
                </form>
            </div>


            <h4 className="text-xl font-semibold text-gray-800 pt-3">Existing Categories</h4>
            
            {/* Category List */}
            {loading ? (
                <div className="text-center py-4">
                    <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                    <p className="text-gray-500 mt-2">Loading categories...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {categories.map((cat) => (
                        <div 
                            key={cat.id} 
                            className="p-4 bg-white shadow-md rounded-xl border border-gray-100 flex flex-col space-y-3"
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-900">{cat.name}</span>
                                <button
                                    className="p-2 text-red-600 bg-red-100 rounded-full hover:bg-red-200 transition"
                                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                    title={`Delete ${cat.name}`}
                                    // Protect the default UNCATEGORIZED entry
                                    disabled={cat.name === 'UNCATEGORIZED'} 
                                >
                                    <i className="fas fa-trash-alt text-sm"></i>
                                </button>
                            </div>
                            
                            {/* Keywords Display */}
                            <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                                {(cat.keywords || []).map((kw, index) => (
                                    <span key={index} className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ManageCategories;