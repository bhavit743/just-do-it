import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { 
  doc, updateDoc, arrayUnion, arrayRemove, 
  collection, query, where, documentId, getDocs 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Toast } from '@capacitor/toast';
import Modal from '../common/Modal';

function EditGroupModal({ group, currentUser, onClose }) {
  const [groupName, setGroupName] = useState(group.name);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // --- NEW: Store real names here ---
  const [memberNames, setMemberNames] = useState({});

  // --- NEW: Fetch Member Names ---
  useEffect(() => {
    const fetchMemberNames = async () => {
      if (!group?.members?.length) return;
      
      try {
        // Firestore 'in' query limit is 10. If you have >10, this simple logic 
        // might miss some. For now, we slice to 10 safely.
        const memberIdsToCheck = group.members.slice(0, 10);

        const q = query(collection(db, 'users'), where(documentId(), 'in', memberIdsToCheck));
        const snapshot = await getDocs(q);
        
        const namesMap = {};
        snapshot.docs.forEach(doc => {
          namesMap[doc.id] = doc.data().username || 'Unknown';
        });
        setMemberNames(namesMap);
      } catch (error) {
        console.error("Error fetching member names:", error);
      }
    };
    
    fetchMemberNames();
  }, [group.members]);

  // 1. Rename Group
  const handleRename = async () => {
    if (!groupName.trim() || groupName === group.name) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'groups', group.id), { name: groupName });
      await Toast.show({ text: 'Group renamed' });
    } catch (e) {
      console.error(e);
      await Toast.show({ text: 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Search Users
  const performSearch = async (query) => {
    if (query.length < 3) return;
    setIsSearching(true);
    try {
      const functions = getFunctions();
      const searchUsersFn = httpsCallable(functions, 'searchUsers');
      const res = await searchUsersFn({ query });
      
      // Filter out existing members
      const filtered = (res.data || []).filter(u => !group.members.includes(u.uid));
      setSearchResults(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // 3. Add Member
  const handleAddMember = async (newMemberId) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: arrayUnion(newMemberId),
        [`balances.${newMemberId}`]: 0 
      });
      setSearchResults(prev => prev.filter(u => u.uid !== newMemberId));
      await Toast.show({ text: 'Member added' });
    } catch (e) {
      console.error(e);
      await Toast.show({ text: 'Failed to add member' });
    } finally {
      setLoading(false);
    }
  };

  // 4. Remove Member
  const handleRemoveMember = async (memberId) => {
    // In a real app, check if balance is 0 first!
    if (!window.confirm('Remove this member?')) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: arrayRemove(memberId)
      });
      await Toast.show({ text: 'Member removed' });
    } catch (e) {
      console.error(e);
      await Toast.show({ text: 'Failed to remove' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Group Settings" onClose={onClose}>
      <div className="space-y-6">
        
        {/* RENAME SECTION */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Group Name</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={groupName} 
              onChange={(e) => setGroupName(e.target.value)}
              className="flex-1 border rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button 
              onClick={handleRename}
              disabled={loading || groupName === group.name}
              className="bg-blue-600 text-white px-4 rounded text-sm disabled:opacity-50 hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>

        {/* ADD MEMBER SECTION */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Add New Members</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search username..."
              className="w-full border border-gray-300 rounded px-3 py-2 pl-8 focus:ring-blue-500 focus:border-blue-500"
              onChange={(e) => { setSearchTerm(e.target.value); performSearch(e.target.value); }}
            />
            <i className={`fas ${isSearching ? 'fa-spinner fa-spin' : 'fa-search'} absolute left-3 top-3 text-gray-400`}></i>
          </div>
          
          {searchResults.length > 0 && (
            <ul className="mt-2 border border-gray-200 rounded max-h-32 overflow-y-auto bg-white">
              {searchResults.map(u => (
                <li key={u.uid} className="flex justify-between p-2 hover:bg-gray-50 items-center border-b last:border-b-0">
                  <span className="text-sm">{u.username}</span>
                  <button onClick={() => handleAddMember(u.uid)} className="text-blue-600 text-xs font-bold px-2 py-1 bg-blue-50 rounded">
                    ADD
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* CURRENT MEMBERS LIST */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
            Current Members ({group.members.length})
          </label>
          <ul className="space-y-2 border border-gray-200 rounded-lg divide-y divide-gray-200">
            {group.members.map(memberId => (
              <li key={memberId} className="flex justify-between items-center bg-white p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                    {/* Show initial */}
                    {(memberNames[memberId] || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800">
                     {/* Display Real Name or Loading... */}
                     {memberId === currentUser.uid ? 'You' : (memberNames[memberId] || 'Loading...')}
                  </span>
                </div>
                
                {memberId !== currentUser.uid && (
                  <button 
                    onClick={() => handleRemoveMember(memberId)}
                    className="text-red-500 text-xs hover:bg-red-50 px-2 py-1 rounded transition"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </Modal>
  );
}

export default EditGroupModal;