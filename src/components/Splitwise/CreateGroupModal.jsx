import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Toast } from '@capacitor/toast';
import Modal from '../common/Modal';

function CreateGroupModal({ userId, onClose }) {
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 1. Unified Search Function
  const performSearch = async (query) => {
    setIsSearching(true);
    try {
      const functions = getFunctions();
      const searchUsersFn = httpsCallable(functions, 'searchUsers');
      
      // Call the backend function
      const result = await searchUsersFn({ query: query });
      
      // Filter out self (userId) and users already selected
      const filtered = (result.data || []).filter(u => 
        u.uid !== userId && !selectedMembers.find(m => m.uid === u.uid)
      );
      
      setSearchResults(filtered);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // 2. AUTO-SEARCH EFFECT (Debounced)
  useEffect(() => {
    // A. Initial Load: If search is empty, fetch the "Prospect List" immediately
    if (searchTerm === '') {
        performSearch(''); 
        return;
    }

    // B. Typing: Wait 500ms after user stops typing before searching
    const delayDebounceFn = setTimeout(() => {
      performSearch(searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedMembers]); // Re-run if selection changes to filter properly

  // 3. Add User to Selection
  const handleSelectUser = (user) => {
    setSelectedMembers(prev => [...prev, user]);
    setSearchResults(prev => prev.filter(u => u.uid !== user.uid)); // Remove from list
    setSearchTerm(''); // Clear input to show default list again
  };

  // 4. Remove User from Selection
  const handleRemoveUser = (uid) => {
    setSelectedMembers(prev => prev.filter(m => m.uid !== uid));
    // We don't re-add to search results immediately; the next search refresh will pick them up
  };

  // 5. Create Group Logic
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;

    setIsCreating(true);
    try {
      // Members = Me + Selected Friends
      const memberIds = [userId, ...selectedMembers.map(m => m.uid)];
      
      // Initialize balances (Nobody owes anything yet)
      const initialBalances = {};
      memberIds.forEach(id => initialBalances[id] = 0);

      // Save to Firestore
      await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        members: memberIds,
        createdBy: userId,
        createdAt: Timestamp.now(),
        balances: initialBalances,
        simplifyDebts: true 
      });

      await Toast.show({ text: 'Group created successfully!' });
      onClose();
    } catch (error) {
      console.error("Error creating group:", error);
      await Toast.show({ text: 'Failed to create group.' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal title="Create New Group" onClose={onClose}>
      <div className="space-y-6">
        
        {/* Group Name Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Trip to Goa"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>

        {/* Add Members Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Friends</label>
          
          {/* Search Input (No Button Needed) */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               {/* Show Spinner if searching, else Spyglass */}
               <i className={`fas ${isSearching ? 'fa-spinner fa-spin' : 'fa-search'} text-gray-400`}></i>
            </div>
            <input
              type="text"
              className="w-full pl-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type to search or select below..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Search Results / Prospect List */}
          <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-sm">
            {searchResults.length === 0 && !isSearching ? (
                <div className="p-3 text-center text-sm text-gray-500">
                    No users found.
                </div>
            ) : (
                <ul className="divide-y divide-gray-100">
                {searchResults.map(user => (
                    <li key={user.uid} className="flex justify-between items-center p-3 hover:bg-gray-50 transition">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            {user.username ? user.username.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{user.username}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-medium hover:bg-blue-700"
                    >
                        Add
                    </button>
                    </li>
                ))}
                </ul>
            )}
          </div>

          {/* Selected Members Chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
              You (Admin)
            </span>
            {selectedMembers.map(member => (
              <span key={member.uid} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                {member.username}
                <button
                  type="button"
                  onClick={() => handleRemoveUser(member.uid)}
                  className="ml-1.5 text-blue-400 hover:text-blue-600 focus:outline-none"
                >
                  <i className="fas fa-times-circle"></i>
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={isCreating || !groupName.trim()}
            className={`px-4 py-2 text-white font-bold rounded-lg shadow transition ${
              isCreating || !groupName.trim() ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </button>
        </div>

      </div>
    </Modal>
  );
}

export default CreateGroupModal;