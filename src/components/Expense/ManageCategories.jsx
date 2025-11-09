import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, orderBy, deleteDoc, doc, query, writeBatch, Timestamp } from 'firebase/firestore';

// 1. Import the new components
import Modal from '../common/Modal';
import EditCategoryForm from './EditCategoryForm';
import ColorPalette from '../common/ColorPalette';// <-- NEW IMPORT

// 2. Add 'color' to default categories
const DEFAULT_CATEGORIES = [
    { name: "FOOD", keywords: ["SWIGGY", "ZOMATO", "RESTAURANT", "LUNCH"], color: "#F59E0B" },
    { name: "TRANSPORT", keywords: ["UBER", "OLA", "BUS", "METRO"], color: "#3B82F6" },
    { name: "GROCERY", keywords: ["GROCER", "VEGETABLES", "MILK"], color: "#10B981" },
    { name: "INCOME", keywords: ["SALARY", "FREELANCE", "REFUND"], color: "#059669" },
    { name: "UNCATEGORIZED", keywords: ["UNCATEGORIZED", "OTHER", "MISC"], color: "#6B7280" } 
];

function ManageCategories({ userId }) {
    const [categoryName, setCategoryName] = useState('');
    const [keywordsInput, setKeywordsInput] = useState('');
    const [color, setColor] = useState('#6B7280'); // State for the color input
    
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saveStatus, setSaveStatus] = useState(null);
    const [categoryToEdit, setCategoryToEdit] = useState(null);

    // Load Data
    useEffect(() => {
        if (!userId) return;
        const categoriesRef = collection(db, `users/${userId}/categories`);
        const q = query(categoriesRef, orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const catList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(catList);
            setLoading(false);
        }, (err) => {
            console.error("Category Fetch Error:", err);
            setError("Failed to load categories.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [userId]);

    // 3. Load Defaults (now includes color)
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
                color: cat.color, // <-- Add color
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

    // 4. Handle Add Category (now includes color)
    const handleAddCategory = async (e) => {
        e.preventDefault();
        setError('');
        setSaveStatus(null);
        
        const name = categoryName.trim().toUpperCase();
        if (name === '') return;
        let keywordsArray = keywordsInput.split(',').map(k => k.trim().toUpperCase()).filter(k => k.length > 0);
        if (!keywordsArray.includes(name)) keywordsArray.push(name);
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
                color: color, // <-- Add color
                createdAt: Timestamp.now(),
            });
            setCategoryName('');
            setKeywordsInput('');
            setColor('#6B7280'); // Reset color
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (e) {
            console.error("Error adding category: ", e);
            setError("Failed to add category.");
        }
    };

    // Handle Delete
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
    
    // Handle Done Editing
    const handleDoneEditing = () => setCategoryToEdit(null);

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">Manage Expense Categories</h3>
            
            {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

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
            
            {/* 5. Category Input Form with ColorPalette */}
            <div className="bg-white p-6 rounded-xl shadow-xl">
                <p className="text-xl font-semibold mb-4">Add New Category</p>
                <form onSubmit={handleAddCategory} className="space-y-4">
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700" htmlFor="category-name">Name</label>
                        <input
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            type="text"
                            id="category-name"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700" htmlFor="keywords-input">Keywords (Comma Separated)</label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                            id="keywords-input"
                            placeholder="e.g., ZOMATO, SWIGGY, LUNCH"
                            rows="3"
                            value={keywordsInput}
                            onChange={(e) => setKeywordsInput(e.target.value)}
                        />
                    </div>

                    {/* 6. Use ColorPalette Component */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                        <ColorPalette 
                            selectedColor={color} 
                            onChange={setColor} 
                        />
                    </div>

                    <div>
                        <button type="submit" className="w-full py-3 px-4 text-white font-bold bg-blue-600 rounded-lg shadow hover:bg-blue-700 transition">
                            Add Category
                        </button>
                    </div>

                    {saveStatus === 'success' && (
                        <div className="p-3 text-center bg-green-100 text-green-700 rounded-lg">
                            Category saved successfully!
                        </div>
                    )}
                </form>
            </div>

            {/* Modal for Editing */}
            {categoryToEdit && (
                <Modal title="Edit Category" onClose={handleDoneEditing}>
                    <EditCategoryForm
                        userId={userId}
                        categoryToEdit={categoryToEdit}
                        onDone={handleDoneEditing}
                    />
                </Modal>
            )}

            <h4 className="text-xl font-semibold text-gray-800 pt-3">Existing Categories</h4>
            
            {/* 7. Corrected Loading/Empty State */}
            {loading ? (
                <div className="text-center py-4">
                    <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                    <p className="text-gray-500 mt-2">Loading categories...</p>
                </div>
            ) : categories.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No categories created yet. Use the form above or load the defaults.</p>
            ) : (
                <div className="space-y-4">
                    {categories.map((cat) => (
                        <div 
                            key={cat.id} 
                            className="p-4 bg-white shadow-md rounded-xl border border-gray-100 flex flex-col space-y-3"
                        >
                            <div className="flex justify-between items-center">
                                {/* 8. Added Color Swatch to List */}
                                <span className="flex items-center gap-3 text-lg font-bold text-gray-900">
                                    <div 
                                        className="w-5 h-5 rounded-full border border-gray-300" 
                                        style={{ backgroundColor: cat.color || '#6B7280' }}
                                    ></div>
                                    {cat.name}
                                </span>
                                <div className="flex space-x-2">
                                    <button
                                        className="p-2 text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 transition"
                                        onClick={() => setCategoryToEdit(cat)}
                                        title={`Edit ${cat.name}`}
                                    >
                                        <i className="fas fa-pencil-alt text-sm"></i>
                                    </button>
                                    <button
                                        className="p-2 text-red-600 bg-red-100 rounded-full hover:bg-red-200 transition"
                                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                        title={`Delete ${cat.name}`}
                                        disabled={cat.name === 'UNCATEGORIZED'} 
                                    >
                                        <i className="fas fa-trash-alt text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            
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