import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

function EditKPIForm({ userId, kpiToEdit, onDone }) {
  const [kpiName, setKpiName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Populate form when the kpiToEdit prop changes
  useEffect(() => {
    if (kpiToEdit) {
      setKpiName(kpiToEdit.name);
    }
  }, [kpiToEdit]);

  // 2. Handle the save (update) action
  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = kpiName.trim();
    if (name === '') return;

    setLoading(true);
    setError('');

    try {
      // Create a reference to the specific KPI document
      const kpiDocRef = doc(db, `users/${userId}/kpis/${kpiToEdit.id}`);
      
      // Update the document
      await updateDoc(kpiDocRef, {
        name: name
      });
      
      setLoading(false);
      onDone(); // Close the modal
    } catch (e) {
      console.error("Error updating KPI: ", e);
      setError("Failed to update goal.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <div>
        <label htmlFor="kpiNameEdit" className="block text-sm font-medium text-gray-700">Goal Name</label>
        <input
          id="kpiNameEdit"
          className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          type="text"
          placeholder="e.g., Exercise for 30 mins"
          value={kpiName}
          onChange={(e) => setKpiName(e.target.value)}
          required
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

export default EditKPIForm;