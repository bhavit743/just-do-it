import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, Timestamp, runTransaction } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';
import debounce from 'lodash.debounce'; // You'll need to install this: npm install lodash.debounce

function FindFriendForm({ userId, existingFriends, onClose }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState(null); // Tracks the user selected from suggestions
    const [isSaving, setIsSaving] = useState(false);

    // Helper to check if the friend is already in the list
    const isFriendAlreadyAdded = (foundUserId) => {
        return existingFriends.some(f => f.friendId === foundUserId);
    };

    // --- 1. THE SEARCH LOGIC (DEBOUNCED) ---
    const fetchSuggestions = async (term) => {
        const lowerTerm = term.trim().toLowerCase();
        if (lowerTerm.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsSearching(true);
        const nextTerm = lowerTerm + '\uf8ff'; // Firestore magic for "less than next string"

        try {
            // Firestore query for prefix search on username
            // NOTE: This requires a single-field index on 'username' and 'email'
            const usernameQuery = query(
                collection(db, 'users'), 
                where('username', '>=', lowerTerm), 
                where('username', '<', nextTerm)
            );

            // Fetch and combine results (you can expand this to include email search too)
            const usernameSnapshot = await getDocs(usernameQuery);
            let results = usernameSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(user => user.id !== userId); // Exclude self

            // Simple de-duplication if you add more queries (e.g., email)
            const uniqueResults = results.filter((value, index, self) =>
                index === self.findIndex((t) => t.id === value.id)
            );

            setSuggestions(uniqueResults.slice(0, 5)); // Limit to 5 suggestions
        } catch (error) {
            console.error("Suggestion fetch error:", error);
            setSuggestions([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Debounce the function to limit Firestore reads
    const debouncedFetchSuggestions = useCallback(debounce(fetchSuggestions, 300), []);

    // Effect to run the search when searchTerm changes
    useEffect(() => {
        if (searchTerm) {
            debouncedFetchSuggestions(searchTerm);
        } else {
            setSuggestions([]);
        }
    }, [searchTerm, debouncedFetchSuggestions]);

    // Handler for search input
    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setSelectedFriend(null); // Clear selection on new input
    };

    // Handler when a suggestion is clicked
    const handleSelectSuggestion = (user) => {
        setSelectedFriend(user);
        setSearchTerm(user.username || user.email); // Display the selected name
        setSuggestions([]); // Clear the suggestions list
    };

    // --- 2. THE ADD LOGIC (Simplified since we have a selected user) ---
    const handleAddFriend = async (e) => {
        e.preventDefault();
        if (!selectedFriend) {
            Toast.show({ text: "Please select a user from the suggestions.", duration: 'short' });
            return;
        }

        if (isFriendAlreadyAdded(selectedFriend.id)) {
            Toast.show({ text: `${selectedFriend.username || selectedFriend.name || 'User'} is already your friend.`, duration: 'long' });
            return;
        }

        setIsSaving(true);

        try {
            await runTransaction(db, async (transaction) => {
                const friendRef = collection(doc(db, 'users', userId), 'friends');
                
                transaction.set(doc(friendRef), {
                    friendId: selectedFriend.id,
                    name: selectedFriend.username || selectedFriend.name || 'New Friend',
                    email: selectedFriend.email,
                    balance: 0, 
                    createdAt: Timestamp.now()
                });
            });

            Toast.show({ text: `${selectedFriend.name || selectedFriend.username} added successfully!`, duration: 'short' });
            setTimeout(onClose, 500); 

        } catch (error) {
            console.error("Error adding friend:", error);
            Toast.show({ text: 'Failed to add friend.', duration: 'long' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleAddFriend} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Search by Username or Email</label>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Start typing a name (min 3 characters)"
                    required
                    disabled={isSaving}
                />
            </div>

            {/* --- SUGGESTIONS DROP-DOWN --- */}
            {searchTerm.length >= 3 && (suggestions.length > 0 || isSearching) && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {isSearching && suggestions.length === 0 && (
                        <p className="p-3 text-center text-gray-500">Searching...</p>
                    )}
                    {suggestions.map(user => (
                        <div 
                            key={user.id} 
                            onClick={() => handleSelectSuggestion(user)}
                            className="p-3 cursor-pointer hover:bg-blue-50 flex justify-between items-center"
                        >
                            <span className="font-medium text-gray-800">{user.username || user.name}</span>
                            <span className="text-sm text-gray-500">{user.email}</span>
                        </div>
                    ))}
                    {!isSearching && suggestions.length === 0 && (
                        <p className="p-3 text-center text-gray-500">No matching users found.</p>
                    )}
                </div>
            )}
            
            {/* --- SELECTED FRIEND DISPLAY --- */}
            {selectedFriend && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <p className="font-bold">Ready to Add:</p>
                    <p>{selectedFriend.username || selectedFriend.name} ({selectedFriend.email})</p>
                </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSaving || !selectedFriend} // Disable if not selected
                    className="px-4 py-2 text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {isSaving ? 'Adding...' : 'Add Friend'}
                </button>
            </div>
            
            <p className="text-xs text-gray-500 pt-2 border-t mt-4">
                💡 **Setup:** Remember to install `lodash.debounce` and create the **single-field index** for the `username` field (and `email` if you extend the search) on your `users` collection.
            </p>
        </form>
    );
}

export default FindFriendForm;