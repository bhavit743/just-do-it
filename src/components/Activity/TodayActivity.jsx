// src/components/Activity/TodayActivity.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { collection, doc, onSnapshot, setDoc, query, orderBy } from 'firebase/firestore';

// Utility to get today's date in YYYY-MM-DD format


const getTodayDate = () => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(new Date()); // en-CA gives YYYY-MM-DD
};

function TodayActivity({ userId }) {
  const [kpis, setKpis] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);
  const today = getTodayDate();

  // 1. Fetch user's defined KPIs and today's completion data
  useEffect(() => {
    if (!userId) return;

    // NOTE: If you are using a structure like `artifacts/{appId}/users/{userId}/kpis`,
    // you must update the collection path here. Using the short path for now.
    const kpisRef = collection(db, `users/${userId}/kpis`);
    const qKpis = query(kpisRef, orderBy('createdAt'));
    
    const completionsRef = doc(db, `users/${userId}/kpi-data/${today}`);

    // Real-time listener for KPIs
    const unsubscribeKpis = onSnapshot(qKpis, (snapshot) => {
      setKpis(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Note: We don't clear loading here to wait for the completion listener if it's slow,
      // but clearing it once at the end is usually safe. For this case, we'll keep it simple.
    });

    // Real-time listener for TODAY's completion status
    const unsubscribeCompletions = onSnapshot(completionsRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompletions(docSnap.data().completions || {});
      } else {
        setCompletions({}); // Reset if no document exists for today
      }
      setLoading(false); // Clear loading state once data has been fetched
    });

    return () => {
      unsubscribeKpis();
      unsubscribeCompletions();
    };
  }, [userId, today]);

  // 2. Handle Checkbox Change and Save to Firestore
  const handleToggleCompletion = useCallback(async (kpiId, isComplete) => {
    const newCompletions = {
      ...completions,
      [kpiId]: isComplete,
    };
    
    // Optimistic update for immediate feedback
    setCompletions(newCompletions);

    try {
      const completionsRef = doc(db, `users/${userId}/kpi-data/${today}`);
      await setDoc(completionsRef, {
        date: today,
        completions: newCompletions
      }, { merge: true }); // Use merge: true to avoid overwriting the whole document
    } catch (error) {
      console.error("Error saving KPI completion:", error);
      // Optional: Revert state if necessary, or let the onSnapshot listener refresh it
    }
  }, [userId, today, completions]);


  if (loading) {
    // Tailwind loading progress bar/spinner
    return (
      <div className="text-center py-8">
        <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
        <p className="text-gray-500 mt-2">Loading goals...</p>
      </div>
    );
  }

  if (kpis.length === 0) {
    // Tailwind notification equivalent
    return (
      <div className="p-4 bg-blue-100 text-blue-700 rounded-lg">
        <p>You haven't added any goals yet. Go to the <span className="font-bold">Manage KPIs</span> tab to create your first goal!</p>
      </div>
    );
  }

  const completedCount = Object.values(completions).filter(v => v).length;
  const totalCount = kpis.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  // Tailwind color classes for progress bar
  const progressColor = progressPercentage === 100 ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div>
      <h3 className="text-xl font-semibold mb-6">Today's Progress ({today})</h3>
      
      {/* Progress Bar and Summary (Tailwind equivalent of Bulma box) */}
      <div className="p-6 bg-gray-50 shadow-inner rounded-xl mb-6 text-center">
        <p className="text-sm font-medium text-gray-500">Goals Completed</p>
        <p className="text-5xl font-extrabold text-gray-900 my-2">{completedCount}/{totalCount}</p>
        
        {/* Tailwind Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3.5">
          <div 
            className={`h-3.5 rounded-full transition-all duration-500 ${progressColor}`} 
            style={{ width: `${progressPercentage}%` }}
          >
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">{progressPercentage.toFixed(0)}% Complete</p>

      </div>

      {/* KPI Checkboxes (Tailwind list) */}
      <div className="space-y-3">
        {kpis.map((kpi) => {
          const isCompleted = !!completions[kpi.id];
          return (
            <div 
              key={kpi.id} 
              className={`flex items-center justify-between p-4 rounded-lg shadow-sm border ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
            >
              <label htmlFor={`kpi-${kpi.id}`} className="flex items-center space-x-3 w-full cursor-pointer">
                <input
                  id={`kpi-${kpi.id}`}
                  type="checkbox"
                  // Tailwind checkbox styling
                  className="w-6 h-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" 
                  checked={isCompleted}
                  onChange={(e) => handleToggleCompletion(kpi.id, e.target.checked)}
                />
                <span className={`text-lg font-medium ${isCompleted ? 'text-gray-800 line-through' : 'text-gray-900'}`}>
                  {kpi.name}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TodayActivity;