// src/components/Activity/StreaksView.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, getDocs, onSnapshot, orderBy } from 'firebase/firestore';

// Utility: Returns date in YYYY-MM-DD format
const formatDateKey = (date) => date.toISOString().slice(0, 10);

// Utility: Returns a date that is 'days' ago
const getDateAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return formatDateKey(date);
};

// Utility: Compares dates for sorting
const dateCompare = (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
};

// --- CORE STREAK LOGIC (Remains UNCHANGED) ---
const calculateStreaks = (kpis, allData) => {
    const todayKey = formatDateKey(new Date());
    const results = {};

    // Sort all unique dates in descending order (newest first)
    const sortedDates = Object.keys(allData).sort(dateCompare).reverse();

    for (const kpi of kpis) {
        let currentStreak = 0;
        
        // Check for today's status
        const isCompletedToday = !!allData[todayKey]?.[kpi.id];

        // Start checking from yesterday, only count today if it's completed
        let startIndex = 0;
        if (isCompletedToday) {
            currentStreak = 1;
        } else {
            // If today is NOT completed, the streak ends yesterday. 
            startIndex = 1;
        }

        // Iterate through history (starting from yesterday/day before)
        for (let i = startIndex; i < sortedDates.length; i++) {
            const currentDateKey = sortedDates[i];
            
            // Check if this date has a completion entry for the KPI
            const isCompleted = !!allData[currentDateKey]?.[kpi.id];

            if (isCompleted) {
                // Check for a gap in days (e.g., missed one day)
                const dateA = new Date(currentDateKey);
                // Note: The logic in the original component for checking date difference
                // is complex. For clean client-side logic, we just check if the previous day 
                // in the data structure matches the current date minus one day.
                
                // For simplicity and to fix potential bugs, a real-world implementation uses 
                // moment.js or date-fns, but for now, we rely on sequential comparison:
                
                if (i === startIndex) { // Always count the first day checked (which is yesterday or before)
                     currentStreak++;
                     continue;
                }
                
                // Check if the previous date key is exactly one day before the current date key
                const previousDateKey = sortedDates[i - 1];
                const datePrev = new Date(previousDateKey);
                
                // Check if current date is exactly 24 hours after the previous date
                if (dateA.getTime() - datePrev.getTime() === 86400000) {
                     currentStreak++;
                } else {
                    // Gap detected, streak is broken
                    break;
                }

            } else {
                // Missed day detected, streak is broken
                break;
            }
        }
        
        results[kpi.id] = {
            name: kpi.name,
            currentStreak: currentStreak,
        };
    }
    
    return results;
};


function StreaksView({ userId }) {
    const [kpis, setKpis] = useState([]);
    const [allData, setAllData] = useState({});
    const [streaks, setStreaks] = useState({});
    const [loading, setLoading] = useState(true);

    // 1. Fetch ALL KPIs and ALL Historical Completion Data
    useEffect(() => {
        if (!userId) return;

        const kpisRef = collection(db, `users/${userId}/kpis`);
        const kpiDataRef = collection(db, `users/${userId}/kpi-data`);

        // Listener for KPIs
        const unsubscribeKpis = onSnapshot(kpisRef, (snapshot) => {
            const kpiList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setKpis(kpiList);
            // This is not the only dependency, so we defer clearing loading until we have all data.
        });

        // Fetch ALL historical data (using getDocs for initial pull)
        const fetchAllData = async () => {
            try {
                const snapshot = await getDocs(kpiDataRef);
                const historicalData = {};
                snapshot.forEach(doc => {
                    historicalData[doc.id] = doc.data().completions || {};
                });
                setAllData(historicalData);
            } catch (error) {
                console.error("Error fetching all KPI data for streaks:", error);
            } finally {
                setLoading(false); // Clear loading state here
            }
        };

        fetchAllData();
        return () => unsubscribeKpis();
    }, [userId]);

    // 2. Calculate Streaks whenever KPIs or Data changes
    useEffect(() => {
        if (kpis.length > 0 && Object.keys(allData).length > 0) {
            const calculatedStreaks = calculateStreaks(kpis, allData);
            setStreaks(calculatedStreaks);
        } else if (kpis.length > 0) {
            // If KPIs exist but no data, all streaks are 0
            const zeroStreaks = kpis.reduce((acc, kpi) => {
                acc[kpi.id] = { name: kpi.name, currentStreak: 0 };
                return acc;
            }, {});
            setStreaks(zeroStreaks);
        }
    }, [kpis, allData]);


    const getBadgeClasses = (days) => {
        if (days >= 30) return 'bg-yellow-100 text-yellow-800'; // Success
        if (days >= 14) return 'bg-blue-100 text-blue-800';   // Warning
        if (days >= 7) return 'bg-green-100 text-green-800';  // Info
        return 'bg-gray-100 text-gray-500';                  // Light/Default
    };
    
    // Tailwind icons
    const getBadgeIcon = (days) => {
        if (days >= 30) return <i className="fas fa-trophy"></i>; // Crown icon is not standard FontAwesome, using Trophy
        if (days >= 14) return <i className="fas fa-fire"></i>;
        if (days >= 7) return <i className="fas fa-bolt"></i>;
        return <i className="fas fa-leaf"></i>;
    }

    if (loading) {
        // Tailwind loading state
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Calculating streaks...</p>
            </div>
        );
    }

    if (kpis.length === 0) {
        // Tailwind notification equivalent
        return (
            <div className="p-4 bg-blue-100 text-blue-700 rounded-lg">
                <p>No goals defined. Go to <span className="font-bold">Manage KPIs</span> to start tracking your habits!</p>
            </div>
        );
    }


    return (
        <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-900">Goal Streaks</h3>
            <p className="text-sm text-gray-500 mb-6">Your consistency over time.</p>
            
            {kpis.map((kpi) => {
                const streakData = streaks[kpi.id] || { currentStreak: 0 };
                const currentStreak = streakData.currentStreak;
                const badgeClass = getBadgeClasses(currentStreak);

                return (
                    <div key={kpi.id} className="p-5 bg-white shadow-lg rounded-xl border border-gray-200">
                        <p className="text-xl font-semibold mb-3 text-gray-900">{kpi.name}</p>
                        
                        {/* Bulma 'level is-mobile' equivalent */}
                        <div className="flex justify-between items-center flex-wrap gap-4">
                            
                            {/* Current Streak */}
                            <div className="flex items-center space-x-3">
                                <span className={`flex items-center text-lg font-bold px-4 py-2 rounded-full ${badgeClass}`}>
                                    <span className="mr-2 text-xl">{getBadgeIcon(currentStreak)}</span>
                                    {currentStreak} Day Streak
                                </span>
                            </div>
                            
                            {/* Streak Badges (7, 14, 30 Days) */}
                            <div className="flex space-x-4 md:space-x-6">
                                {/* 7-Day Badge */}
                                <div className="text-center">
                                    <p className="text-xs font-medium text-gray-500">7 Days</p>
                                    <span className={`inline-flex items-center px-3 py-1 mt-1 text-xs font-medium rounded-full ${currentStreak >= 7 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {currentStreak >= 7 ? 'Achieved' : 'Pending'}
                                    </span>
                                </div>
                                {/* 14-Day Badge */}
                                <div className="text-center">
                                    <p className="text-xs font-medium text-gray-500">14 Days</p>
                                    <span className={`inline-flex items-center px-3 py-1 mt-1 text-xs font-medium rounded-full ${currentStreak >= 14 ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {currentStreak >= 14 ? 'Achieved' : 'Pending'}
                                    </span>
                                </div>
                                {/* 30-Day Badge */}
                                <div className="text-center">
                                    <p className="text-xs font-medium text-gray-500">30 Days</p>
                                    <span className={`inline-flex items-center px-3 py-1 mt-1 text-xs font-medium rounded-full ${currentStreak >= 30 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {currentStreak >= 30 ? 'Achieved' : 'Pending'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default StreaksView;