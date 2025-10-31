// src/components/Activity/ManageKPIs.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, onSnapshot, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore'; // Added Timestamp for clean date saving

function ManageKPIs({ userId }) {
  const [kpiName, setKpiName] = useState('');
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Listen for real-time updates to the KPIs collection
  useEffect(() => {
    if (!userId) return;

    // Path: users/{userId}/kpis
    const kpisRef = collection(db, `users/${userId}/kpis`);
    const q = query(kpisRef, orderBy('createdAt', 'desc'));

    // Real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const kpiList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setKpis(kpiList);
      setLoading(false);
    }, (err) => {
      console.error("KPI Fetch Error:", err);
      setError("Failed to load goals.");
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [userId]);

  // 2. Add New KPI
  const handleAddKPI = async (e) => {
    e.preventDefault();
    const name = kpiName.trim();
    if (name === '') return;

    try {
      const kpisRef = collection(db, `users/${userId}/kpis`);
      await addDoc(kpisRef, {
        name: name,
        createdAt: Timestamp.now(), // Use Timestamp for consistent server-side time
      });
      setKpiName('');
    } catch (e) {
      console.error("Error adding KPI: ", e);
      setError("Failed to add goal.");
    }
  };

  // 3. Delete KPI
  const handleDeleteKPI = async (kpiId, kpiName) => {
    if (!window.confirm(`Are you sure you want to delete the goal: "${kpiName}"? This will affect your streak history!`)) return;
    try {
      const kpiDocRef = doc(db, `users/${userId}/kpis/${kpiId}`);
      await deleteDoc(kpiDocRef);
    } catch (e) {
      console.error("Error deleting KPI: ", e);
      setError("Failed to delete goal.");
    }
  };

  // 4. Gemini Feature Placeholder (Cannot be implemented on Spark plan)
  const handleSuggestTasks = (kpiName) => {
    alert(`AI Feature Disabled on Spark Plan. Cannot suggest tasks for: ${kpiName}`);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-900">Manage Daily Goals (KPIs)</h3>
      
      {/* Error Notification */}
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* KPI Input Form (Tailwind flex/addon equivalent) */}
      <form onSubmit={handleAddKPI} className="flex space-x-3">
        <div className="flex-grow">
          <input
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            type="text"
            placeholder="e.g., Exercise for 30 mins, Read 10 pages"
            value={kpiName}
            onChange={(e) => setKpiName(e.target.value)}
            required
          />
        </div>
        <div>
          <button 
            type="submit" 
            className="px-4 py-2 text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 transition font-medium"
          >
            Add Goal
          </button>
        </div>
      </form>

      <hr className="border-t border-gray-200" />

      {/* KPI List */}
      <h4 className="text-xl font-semibold text-gray-800">Existing Goals</h4>
      
      {/* Loading State */}
      {loading ? (
        <div className="text-center py-4">
          <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
          <p className="text-gray-500 mt-2">Loading goals...</p>
        </div>
      ) : kpis.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No goals added yet. Add your first daily goal above!</p>
      ) : (
        <div className="space-y-3">
          {kpis.map((kpi) => (
            <div 
              key={kpi.id} 
              className="flex justify-between items-center p-4 bg-white shadow-md rounded-lg border border-gray-100"
            >
              <p className="text-lg font-medium text-gray-900">{kpi.name}</p>
              
              <div className="flex space-x-2">
                {/* Gemini Feature Placeholder Button */}
                <button
                  className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition"
                  onClick={() => handleSuggestTasks(kpi.name)}
                >
                  Suggest Tasks
                </button>
                
                {/* Delete Button */}
                <button
                  className="p-2 text-red-600 bg-red-100 rounded-full hover:bg-red-200 transition"
                  onClick={() => handleDeleteKPI(kpi.id, kpi.name)}
                  title={`Delete ${kpi.name}`}
                >
                  <i className="fas fa-trash-alt text-sm"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManageKPIs;