import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, getDocs, onSnapshot, orderBy } from 'firebase/firestore';

// Utility: Returns date in YYYY-MM-DD format
const formatDateKey = (date) => date.toISOString().slice(0, 10);

// Utility: Returns date in YYYY-MM format
const formatDateMonthKey = (date) => date.toISOString().slice(0, 7);

// Utility: Compares dates for sorting
const dateCompare = (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
};

// --- CORE LOGIC: Calculate Monthly Achievement for a Single Month ---
const calculateMonthlyStats = (targetMonthKey, allData, kpiId) => {
    const today = new Date();
    const currentMonthKey = formatDateMonthKey(today);
    
    // Determine month boundaries
    const [year, month] = targetMonthKey.split('-').map(Number);
    const dateInMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Calculate days passed so far in the target month (up to today/month end)
    let daysPassed = 0;
    if (targetMonthKey === currentMonthKey) {
        daysPassed = today.getDate();
    } else if (targetMonthKey < currentMonthKey) {
        daysPassed = daysInMonth;
    }

    if (daysPassed === 0) {
        return { achieved: 0, total: 0, percentage: 0 };
    }
    
    let daysAchieved = 0;
    let checkDate = new Date(dateInMonth);
    
    // Loop through days that have passed in the month
    for (let i = 0; i < daysPassed; i++) {
        const dateKey = formatDateKey(checkDate);
        if (allData[dateKey]?.[kpiId]) {
            daysAchieved++;
        }
        checkDate.setDate(checkDate.getDate() + 1);
    }
    
    const percentage = (daysAchieved / daysPassed) * 100;

    return {
        achieved: daysAchieved,
        total: daysPassed,
        percentage: percentage,
        daysInMonth: daysInMonth, // Total days in month (used for historical display)
    };
};

// --- CORE LOGIC: Calculate Current Streaks and Current Month Achievement ---
const calculateStreaks = (kpis, allData) => {
    const todayKey = formatDateKey(new Date());
    const currentMonthKey = formatDateMonthKey(new Date());
    const results = {};

    for (const kpi of kpis) {
        let currentStreak = 0;
        let currentCheckDate = new Date(); // Start checking from today

        // 1. Calculate Current Streak
        const isCompletedToday = !!allData[todayKey]?.[kpi.id];
        if (isCompletedToday) {
            currentStreak = 1;
        }
        currentCheckDate.setDate(currentCheckDate.getDate() - 1); // Start checking from YESTERDAY

        for (let i = 0; i < 365; i++) {
            const dateKey = formatDateKey(currentCheckDate);
            const isCompleted = !!allData[dateKey]?.[kpi.id];

            if (isCompleted) {
                currentStreak++;
            } else {
                break;
            }
            currentCheckDate.setDate(currentCheckDate.getDate() - 1);
        }
        
        // 2. Calculate Current Month Achievement
        const monthlyStats = calculateMonthlyStats(currentMonthKey, allData, kpi.id);

        results[kpi.id] = {
            name: kpi.name,
            currentStreak: currentStreak,
            monthlyAchievement: monthlyStats, // Store current month stats
        };
    }
    
    return results;
};

// --- NEW: Calculate Historical Monthly Achievements ---
const calculateHistoricalAchievements = (kpis, allData) => {
    const history = {};
    const todayKey = formatDateMonthKey(new Date());

    if (kpis.length === 0 || Object.keys(allData).length === 0) return history;

    // Get all unique month keys present in the data
    const allMonths = new Set(
        // FIX: Convert the date string (YYYY-MM-DD) into a Date object before formatting
        Object.keys(allData).map(dateKey => formatDateMonthKey(new Date(dateKey))) 
    );
    
    // Sort months chronologically
    const sortedMonths = Array.from(allMonths).sort(dateCompare).filter(month => month < todayKey);
    
    for (const kpi of kpis) {
        history[kpi.id] = [];
        
        for (const monthKey of sortedMonths) {
            const stats = calculateMonthlyStats(monthKey, allData, kpi.id);
            if (stats.total > 0) {
                 history[kpi.id].push({
                    monthKey,
                    percentage: stats.percentage,
                    daysAchieved: stats.achieved,
                    daysInMonth: stats.daysInMonth,
                    isMet: stats.percentage >= 80, // Assuming a fixed 80% target for history
                });
            }
        }
    }
    return history;
};


function StreaksView({ userId }) {
    const [kpis, setKpis] = useState([]);
    const [allData, setAllData] = useState({});
    const [streaks, setStreaks] = useState({});
    const [historicalAchievements, setHistoricalAchievements] = useState({});
    const [loading, setLoading] = useState(true);
    // --- NEW STATE FOR COLLAPSIBLE HISTORY ---
    const [isHistoryOpen, setIsHistoryOpen] = useState(false); 
    
    const TARGET_PERCENTAGE = 80;


    // 1. Fetch ALL KPIs and ALL Historical Completion Data (Unchanged)
    useEffect(() => {
        if (!userId) return;

        const kpisRef = collection(db, `users/${userId}/kpis`);
        const kpiDataRef = collection(db, `users/${userId}/kpi-data`);

        const unsubscribeKpis = onSnapshot(kpisRef, (snapshot) => {
            const kpiList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setKpis(kpiList);
        });

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
                setLoading(false); 
            }
        };

        fetchAllData();
        return () => unsubscribeKpis();
    }, [userId]);

    // 2. Calculate Streaks and Achievements whenever KPIs or Data changes (Unchanged)
    useEffect(() => {
        if (kpis.length > 0) {
            const calculatedStreaks = calculateStreaks(kpis, allData);
            setStreaks(calculatedStreaks);
            
            const historical = calculateHistoricalAchievements(kpis, allData);
            setHistoricalAchievements(historical);
            
        } else if (kpis.length > 0) {
            const zeroStreaks = kpis.reduce((acc, kpi) => {
                acc[kpi.id] = { name: kpi.name, currentStreak: 0, monthlyAchievement: { achieved: 0, total: 0, percentage: 0 } };
                return acc;
            }, {});
            setStreaks(zeroStreaks);
        }
    }, [kpis, allData]);


    const getBadgeClasses = (days) => {
        if (days >= 30) return 'bg-yellow-100 text-yellow-800'; 
        if (days >= 14) return 'bg-blue-100 text-blue-800';   
        if (days >= 7) return 'bg-green-100 text-green-800';  
        return 'bg-gray-100 text-gray-500';                  
    };
    
    const getBadgeIcon = (days) => {
        if (days >= 30) return <i className="fas fa-trophy"></i>; 
        if (days >= 14) return <i className="fas fa-fire"></i>;
        if (days >= 7) return <i className="fas fa-bolt"></i>;
        return <i className="fas fa-leaf"></i>;
    }
    
    const formatMonthName = (monthKey) => {
        const [year, month] = monthKey.split('-');
        return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };


    if (loading) {
        return (
            <div className="text-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" viewBox="0 0 24 24"></svg>
                <p className="text-gray-500 mt-2">Calculating streaks...</p>
            </div>
        );
    }

    if (kpis.length === 0) {
        return (
            <div className="p-4 bg-blue-100 text-blue-700 rounded-lg">
                <p>No goals defined. Go to <span className="font-bold">Manage KPIs</span> to start tracking your habits!</p>
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Activity Streaks & Achievements</h2>
            
            {kpis.map((kpi) => {
                const streakData = streaks[kpi.id] || { currentStreak: 0, monthlyAchievement: { percentage: 0, daysAchieved: 0, total: 0 } };
                const currentStreak = streakData.currentStreak;
                const monthlyStats = streakData.monthlyAchievement;
                const achievementPercentage = monthlyStats.percentage;
                const achievementStatusClass = achievementPercentage >= TARGET_PERCENTAGE ? 'bg-green-600' : 'bg-red-600';
                
                // Progress Bar calculation
                const progressWidth = Math.min(100, Math.floor(achievementPercentage));


                return (
                    <div key={kpi.id} className="p-5 bg-white shadow-lg rounded-xl border border-gray-200 space-y-4">
                        <p className="text-xl font-bold mb-2 text-gray-900">{kpi.name}</p>
                        
                        {/* --- ROW 1: Current Streak Badges --- */}
                        <div className="flex justify-between items-center flex-wrap gap-4 border-b pb-4">
                            
                            {/* Current Streak */}
                            <div className="flex flex-col items-start">
                                <p className="text-sm font-medium text-gray-500 mb-1">Current Streak</p>
                                <span className={`flex items-center text-lg font-bold px-4 py-2 rounded-full ${getBadgeClasses(currentStreak)}`}>
                                    <span className="mr-2 text-xl">{getBadgeIcon(currentStreak)}</span>
                                    {currentStreak} Day{currentStreak !== 1 && 's'}
                                </span>
                            </div>
                            
                            {/* Streak Badges */}
                            <div className="flex space-x-4">
                                <div className="text-center">
                                    <p className="text-xs font-medium text-gray-500">7 Days</p>
                                    <span className={`inline-flex items-center px-3 py-1 mt-1 text-xs font-medium rounded-full ${currentStreak >= 7 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {currentStreak >= 7 ? 'Achieved' : 'Pending'}
                                    </span>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-medium text-gray-500">30 Days</p>
                                    <span className={`inline-flex items-center px-3 py-1 mt-1 text-xs font-medium rounded-full ${currentStreak >= 30 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {currentStreak >= 30 ? 'Achieved' : 'Pending'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* --- ROW 2: Monthly Achievement Progress Bar --- */}
                        <div className="pt-4 space-y-2">
                            <p className="text-sm font-medium text-gray-700">
                                Monthly Achievement: {achievementPercentage.toFixed(0)}%
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                    className={`h-2.5 rounded-full transition-all duration-500 ${achievementStatusClass}`}
                                    style={{ width: `${progressWidth}%` }}
                                ></div>
                            </div>
                          
                        </div>
                    </div>
                );
            })}
            
            {/* --- NEW SECTION: Collapsible Historical Achievements --- */}
            <div className="pt-6 border-t border-gray-200 space-y-4">
                <button
                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                    className="flex justify-between items-center w-full p-3 bg-gray-100 rounded-lg font-bold text-lg hover:bg-gray-200 transition"
                >
                    Historical Monthly Performance 
                    <i className={`fas fa-chevron-${isHistoryOpen ? 'up' : 'down'} text-sm ml-2`}></i>
                </button>

                {isHistoryOpen && (
                    <div className="space-y-4">
                        {kpis.map(kpi => (
                            <div key={`history-${kpi.id}`} className="p-5 bg-white shadow-lg rounded-xl border border-gray-200">
                                <h4 className="text-lg font-semibold mb-3 text-gray-800">{kpi.name} History</h4>
                                
                                {historicalAchievements[kpi.id]?.length > 0 ? (
                                    <div className="space-y-3">
                                        {historicalAchievements[kpi.id].map(history => (
                                            <div key={history.monthKey} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                                <p className="text-sm font-medium text-gray-700">
                                                    {formatMonthName(history.monthKey)}
                                                </p>
                                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${history.isMet ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                                    {history.percentage.toFixed(0)}% ({history.daysAchieved}/{history.daysInMonth})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No previous months recorded.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* --- END NEW SECTION --- */}
        </div>
    );
}

export default StreaksView;