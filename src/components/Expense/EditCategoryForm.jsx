// src/components/Expense/EditCategoryForm.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { getFunctions, httpsCallable } from 'firebase/functions'; 
import { Toast } from '@capacitor/toast';
import ColorPalette from '../common/ColorPalette';

// --- 1. THE FIX: Changed prop name from 'itemToEdit' to 'categoryToEdit' ---
function EditCategoryForm({ userId, categoryToEdit, onDone }) {
  
  const [categoryName, setCategoryName] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- 2. THE FIX: Populate state from 'categoryToEdit' ---
  useEffect(() => {
    if (categoryToEdit) {
      setCategoryName(categoryToEdit.name);
      setKeywordsInput(categoryToEdit.keywords ? categoryToEdit.keywords.join(', ') : '');
      setColor(categoryToEdit.color || '#6B7280'); 
    }
  }, [categoryToEdit]); // This hook now depends on the correct prop

  // Handle the save (update) action
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const newName = categoryName.trim().toUpperCase();
    if (!newName) {
        setError("Category name cannot be empty.");
        setLoading(false);
        return;
    }

    let keywordsArray = keywordsInput.split(',').map(k => k.trim().toUpperCase()).filter(k => k.length > 0);
    if (!keywordsArray.includes(newName)) {
        keywordsArray.push(newName);
    }
    keywordsArray = [...new Set(keywordsArray)]; 

    try {
        const functions = getFunctions();
        const updateCategory = httpsCallable(functions, 'updateCategory');

        // --- 3. THE FIX: Use 'categoryToEdit' when sending data ---
        await updateCategory({
            categoryId: categoryToEdit.id,
            oldName: categoryToEdit.name, // Send the original name
            newName: newName,
            newKeywords: keywordsArray,
            newColor: color
        });
        
        Toast.show({ text: 'Category updated successfully!', duration: 'short' });
        onDone(); // Close the modal
    } catch (e) {
        console.error("Error updating category: ", e);
        if (e.code === 'functions/already-exists') {
            setError("A category with this name already exists.");
        } else {
            setError("Failed to update category.");
        }
    } finally {
        setLoading(false);
    }
  };

  // This guard is important
  if (!categoryToEdit) return null; 

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {/* Category Name (Editable) */}
      <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="category-name-edit">Category Name</label>
          <input
              id="category-name-edit"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
          />
      </div>

      {/* Edit the keywords */}
      <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700" htmlFor="keywords-edit">Keywords (Comma Separated)</label>
          <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
              id="keywords-edit"
              rows="3"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
          />
          <p className="text-xs text-gray-500">These keywords help auto-categorize transactions.</p>
      </div>

      {/* Color Palette */}
      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <ColorPalette 
              selectedColor={color} 
              onChange={setColor} 
          />
      </div>
      
      {/* Save Button */}
      <div>
        <button 
          type="submit" 
          className={`w-full px-4 py-2 text-white bg-green-600 rounded-lg shadow hover:bg-green-700 transition font-medium ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

export default EditCategoryForm;