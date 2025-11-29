import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { Toast } from '@capacitor/toast';

function AddGroupForm({ userId, onClose }) {
    const [friends, setFriends] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [loadingFriends, setLoadingFriends] = useState(true);

    // Fetch Friends
    useEffect(() => {
        const friendsQuery = query(collection(db, `users/${userId}/friends`), orderBy("name"));
        const unsubscribe = onSnapshot(friendsQuery, (snapshot) => {
            const friendList = snapshot.docs.map(doc => ({ 
                id: doc.id, // Friend document ID
                ...doc.data() // Includes name, friendId (UID), email
            }));
            setFriends(friendList);
            setLoadingFriends(false);
        });
        return () => unsubscribe();
    }, [userId]);

    const handleMemberToggle = (friendId) => {
        setSelectedMembers(prev => 
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupName.trim() || selectedMembers.length === 0) {
            Toast.show({ text: 'Please name the group and select at least one member.', duration: 'short' });
            return;
        }

        setIsSaving(true);
        try {
            // Include current user in the member list
            const allMemberDocs = friends.filter(f => selectedMembers.includes(f.id));
            
            // Map members for easy access (used for balances/splits)
            const memberDetails = {};
            
            // 1. Add friends
            allMemberDocs.forEach(f => {
                memberDetails[f.id] = { name: f.name, friendId: f.friendId, balance: 0 };
            });
            
            // 2. Add yourself (assuming your user doc exists outside this loop)
            memberDetails['you'] = { name: 'You (Me)', friendId: userId, balance: 0 }; 

            const newGroup = {
                name: groupName.trim(),
                logoUrl: logoUrl.trim(),
                members: [...selectedMembers, 'you'], // Friend Doc IDs + 'you' identifier
                memberDetails: memberDetails,
                createdAt: Timestamp.now(),
            };

            await addDoc(collection(db, `users/${userId}/groups`), newGroup);
            
            Toast.show({ text: `${groupName} created successfully!`, duration: 'short' });
            onClose();
        } catch (error) {
            console.error("Error creating group:", error);
            Toast.show({ text: 'Failed to create group.', duration: 'long' });
        } finally {
            setIsSaving(false);
        }
    };
    
    // Member list rendering
    const memberList = friends.map(friend => (
        <label key={friend.id} className="flex items-center space-x-2 p-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
            <input
                type="checkbox"
                checked={selectedMembers.includes(friend.id)}
                onChange={() => handleMemberToggle(friend.id)}
                className="text-blue-600 rounded"
                disabled={isSaving}
            />
            <span className="text-sm">{friend.name}</span>
        </label>
    ));

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Group Name</label>
                <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Weekend Getaway"
                    required
                    disabled={isSaving}
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700">Logo/Icon URL (Optional)</label>
                <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Paste image link here"
                    disabled={isSaving}
                />
            </div>
            
            <fieldset className="border p-3 rounded-lg">
                <legend className="px-2 text-sm font-bold text-gray-700">Group Members (Excluding You)</legend>
                {loadingFriends ? (
                    <p className="text-sm text-gray-500">Loading friends...</p>
                ) : friends.length === 0 ? (
                    <p className="text-sm text-yellow-600">No friends added. Add friends via the main navigation first.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mt-2">
                        {memberList}
                    </div>
                )}
            </fieldset>

            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg" disabled={isSaving}>Cancel</button>
                <button 
                    type="submit" 
                    disabled={isSaving || selectedMembers.length === 0}
                    className="px-4 py-2 text-white bg-green-600 rounded-lg shadow hover:bg-green-700 disabled:bg-gray-400"
                >
                    {isSaving ? 'Creating...' : 'Create Group'}
                </button>
            </div>
        </form>
    );
}

export default AddGroupForm;