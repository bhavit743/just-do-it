import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

// 1. IMPORT ColorPalette
import ColorPalette from '../common/ColorPalette';

function EditCategoryForm({ userId, categoryToEdit, onDone }) {
  const [keywordsInput, setKeywordsInput] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Populate form when the component loads
  useEffect(() => {
    if (categoryToEdit) {
      setKeywordsInput(categoryToEdit.keywords ? categoryToEdit.keywords.join(', ') : '');
      setColor(categoryToEdit.color || '#6B7280'); // Populate color
    }
  }, [categoryToEdit]);

  // Handle the save (update) action
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Sanitize the keywords
    let keywordsArray = keywordsInput.split(',').map(k => k.trim().toUpperCase()).filter(k => k.length > 0);
    if (!keywordsArray.includes(categoryToEdit.name)) {
        keywordsArray.push(categoryToEdit.name);
    }
    keywordsArray = [...new Set(keywordsArray)]; 

    try {
      const catDocRef = doc(db, `users/${userId}/categories/${categoryToEdit.id}`);
      
      // 3. UPDATE: Save the new color and keywords
      await updateDoc(catDocRef, {
        keywords: keywordsArray,
        color: color // <-- Save color
      });
      
      setLoading(false);
      onDone(); // Close the modal
    } catch (e) {
      console.error("Error updating category: ", e);
      setError("Failed to update keywords.");
      setLoading(false);
    }
  };

  if (!categoryToEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Category Name (Read-Only)</label>
        <p className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500">
          {categoryToEdit.name}
        </p>
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

      {/* 5. SWAP: <input> for <ColorPalette> */}
      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <ColorPalette 
              selectedColor={color} 
              onChange={setColor} 
          />
      </div>

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