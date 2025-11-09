import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';

function EditWishlistItemForm({ userId, itemToEdit, onClose }) {
    const [itemName, setItemName] = useState(itemToEdit.name);
    const [itemCost, setItemCost] = useState(itemToEdit.cost);
    const [priorityInput, setPriorityInput] = useState(itemToEdit.priority);
    const [isSaving, setIsSaving] = useState(false);
    
    // Reference to the specific wishlist item
    const itemDocRef = React.useMemo(() => doc(db, `users/${userId}/wishlist`, itemToEdit.id), [userId, itemToEdit.id]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!itemName || !itemCost || !priorityInput) return;

        setIsSaving(true);
        try {
            await updateDoc(itemDocRef, {
                name: itemName.trim(),
                cost: Number(itemCost),
                priority: Number(priorityInput),
            });
            Toast.show({ text: 'Wishlist item updated!', duration: 'short' });
            onClose();
        } catch (error) {
            console.error("Error updating item:", error);
            Toast.show({ text: 'Failed to update item.', duration: 'long' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-4">
            <h4 className="text-lg font-bold">Editing: {itemToEdit.name}</h4>
            
            <div>
                <label htmlFor="editName" className="block text-sm font-medium text-gray-700">Item Name</label>
                <input
                    type="text"
                    id="editName"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm"
                    required
                />
            </div>
            
            <div>
                <label htmlFor="editCost" className="block text-sm font-medium text-gray-700">Target Cost</label>
                <input
                    type="number"
                    id="editCost"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm"
                    min="1"
                    required
                />
            </div>

            <div>
                <label htmlFor="editPriority" className="block text-sm font-medium text-gray-700">Priority (1 = Highest)</label>
                <input
                    type="number"
                    id="editPriority"
                    value={priorityInput}
                    onChange={(e) => setPriorityInput(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm"
                    min="1"
                    required
                />
            </div>

            <div className="flex justify-end pt-2 space-x-3 border-t">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition">
                    Cancel
                </button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow transition bg-green-600 hover:bg-green-700 disabled:bg-gray-400">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
}

export default EditWishlistItemForm;