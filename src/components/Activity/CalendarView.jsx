// src/components/Activity/CalendarView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, doc, setDoc, orderBy, getDocs } from 'firebase/firestore'; // Added getDocs for initial check

// Utility: Returns date in YYYY-MM-DD format
const formatDateKey = (date) => new Date(date).toISOString().slice(0, 10);
// Utility: Returns the first day of the month
const getStartOfMonth = (year, month) => new Date(year, month, 1);


// --- 1. Day Detail Modal Component (Converted to Tailwind) ---
const DayDetailModal = ({ date, initialCompletions, kpis, userId, onClose }) => {
    const [completions, setCompletions] = useState(initialCompletions);
    const [isSaving, setIsSaving] = useState(false);
    const dateKey = formatDateKey(date);
    const isFutureDate = date.getTime() > new Date().setHours(23, 59, 59, 999);

    const handleCheckboxChange = (kpiId, isChecked) => {
        if (isFutureDate) return; 
        setCompletions(prev => ({ ...prev, [kpiId]: isChecked }));
    };

    const handleSave = async () => {
        if (isFutureDate) return; 
        setIsSaving(true);
        try {
            // NOTE: Path should match your global app structure if different from standard
            const completionsRef = doc(db, `users/${userId}/kpi-data/${dateKey}`);
            await setDoc(completionsRef, { date: dateKey, completions: completions }, { merge: true });
            onClose(); 
        } catch (error) {
            console.error("Error saving KPI completion for past date:", error);
            alert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const totalCount = kpis.length;
    const completedCount = Object.values(completions).filter(v => v).length;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 transition-opacity duration-300 ${onClose ? 'opacity-100 visible' : 'opacity-0 hidden'}`}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 transform transition-transform duration-300">
                <header className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <p className="text-xl font-semibold">Activity for {date.toLocaleDateString()}</p>
                    <button className="text-gray-500 hover:text-gray-800" onClick={onClose}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </header>
                <section className="py-4 space-y-3 max-h-96 overflow-y-auto">
                    {isFutureDate && (<div className="p-3 text-yellow-800 bg-yellow-100 rounded">Cannot edit future dates.</div>)}
                    <p className="text-center text-sm font-medium">{completedCount}/{totalCount} goals completed</p>
                    {kpis.length === 0 ? (
                        <div className="p-3 text-blue-800 bg-blue-100 rounded">No goals defined.</div>
                    ) : (
                        kpis.map(kpi => (
                            <div key={kpi.id} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0">
                                <label className="flex items-center space-x-3 text-lg font-medium cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                                        checked={!!completions[kpi.id]} 
                                        onChange={(e) => handleCheckboxChange(kpi.id, e.target.checked)}
                                        disabled={isFutureDate}
                                    />
                                    <span>{kpi.name}</span>
                                </label>
                            </div>
                        ))
                    )}
                </section>
                <footer className="pt-4 flex justify-end space-x-3 border-t border-gray-200">
                    <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition" onClick={onClose}>Cancel</button>
                    <button 
                        className={`px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50 ${isSaving ? 'animate-pulse' : ''}`}
                        onClick={handleSave}
                        disabled={isSaving || kpis.length === 0 || isFutureDate}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </footer>
            </div>
        </div>
    );
};


function CalendarView({ userId }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [kpis, setKpis] = useState([]);
    const [dailyData, setDailyData] = useState({});
    const [loading, setLoading] = useState(true);
    const [kpisLoaded, setKpisLoaded] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null); 

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); 
    const todayKey = formatDateKey(new Date());
    const totalCount = kpis.length;

    // --- 1. Fetch KPI List (Real-time) ---
    useEffect(() => {
        if (!userId) return;
        const kpisRef = collection(db, `users/${userId}/kpis`);
        const qKpis = query(kpisRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(qKpis, (snapshot) => {
            setKpis(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setKpisLoaded(true);
        });

        return () => unsubscribe();
    }, [userId]);


    // --- 2. Fetch ALL Completion Data (Real-time listener for calendar) ---
    useEffect(() => {
        if (!userId) return;
        setLoading(true);

        const kpiDataRef = collection(db, `users/${userId}/kpi-data`);
        
        const unsubscribe = onSnapshot(kpiDataRef, (snapshot) => {
            const historicalData = {};
            const startOfMonth = getStartOfMonth(year, month);
            const endOfMonth = getStartOfMonth(year, month + 1);
            
            snapshot.forEach(doc => {
                const docDate = doc.id; 

                if (docDate >= formatDateKey(startOfMonth) && docDate < formatDateKey(endOfMonth)) {
                    historicalData[docDate] = doc.data().completions || {};
                }
            });
            setDailyData(historicalData);
            setLoading(false);
        }, (error) => {
            console.error("Error setting up real-time calendar listener:", error);
            setLoading(false); 
        });

        return () => unsubscribe();
        
    }, [userId, year, month]); 


    // --- Calendar Generation Logic (remains same) ---
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const calendarDays = [];
    
    for (let i = 0; i < firstDayIndex; i++) { calendarDays.push(null); }
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateKey = formatDateKey(date);
        const completions = dailyData[dateKey] || {};
        const completedCount = Object.values(completions).filter(v => v).length;
        const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        const isPast = date.setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);

        calendarDays.push({
            day, date, dateKey, summary: `${completedCount}/${totalCount}`,
            progress, completions, isToday: dateKey === todayKey, isPast: isPast,
        });
    }

    const handleDayClick = (dayData) => {
        if (dayData && dayData.date.setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0)) { 
            setSelectedDay(dayData);
        }
    };

    const handleMonthChange = (direction) => {
        const newMonth = month + direction;
        setCurrentDate(new Date(year, newMonth, 1));
    };

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


    // --- Tailwind Styles ---
    const gridStyle = "grid grid-cols-7 border border-gray-300 bg-white rounded-lg overflow-hidden";
    
    const headerCellStyle = "text-center text-xs font-medium text-gray-600 py-2 border-b border-gray-300 bg-gray-50 uppercase";

    const dayCellStyle = {
        padding: '0.5rem',
        borderRight: '1px solid #f5f5f5', 
        borderBottom: '1px solid #f5f5f5',
        minHeight: '4.5rem', 
        position: 'relative', 
    };

    return (
        <div className="p-4"> 
            <h3 className="text-2xl font-semibold mb-4">Activity Calendar</h3>

            {/* Month Navigation */}
            <nav className="flex justify-between items-center mb-4">
                <button className="p-2 rounded-full hover:bg-gray-100 transition" onClick={() => handleMonthChange(-1)}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <p className="text-xl font-bold text-gray-800">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                <button className="p-2 rounded-full hover:bg-gray-100 transition" onClick={() => handleMonthChange(1)}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </nav>

            {loading || !kpisLoaded ? (
                <div className="p-4 text-center text-gray-500">
                    <svg className="animate-spin h-5 w-5 text-blue-500 inline-block mr-2" viewBox="0 0 24 24"></svg>
                    Loading calendar data...
                </div>
            ) : (
                <div className={gridStyle}>
                    {/* Day Headers */}
                    {dayHeaders.map(day => (
                        <div key={day} className={headerCellStyle}>
                            {day}
                        </div>
                    ))}

                    {/* Calendar Days */}
                    {calendarDays.map((dayData, index) => {
                        const canClick = dayData && dayData.date.setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0); 
                        const isToday = dayData && dayData.isToday;
                        const isCompleted = dayData && dayData.progress === 100 && dayData.progress > 0;
                        const bgColor = dayData ? (isToday ? 'bg-blue-50' : 'bg-white') : 'bg-gray-100'; 
                        
                        return (
                            <div 
                                key={index} 
                                // Apply the style object and Tailwind classes
                                className={`text-left text-sm relative ${bgColor} ${canClick ? 'cursor-pointer hover:bg-gray-100' : 'opacity-60'}`}
                                style={dayCellStyle} 
                                onClick={() => handleDayClick(dayData)}
                            >
                                {dayData ? (
                                    <>
                                        {/* Date Number */}
                                        <p className={`text-lg font-bold ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                                            {dayData.day}
                                        </p>
                                        
                                        {/* Completion Summary */}
                                        {totalCount > 0 && (
                                            <div className="flex flex-col items-start mt-1">
                                                <p className="text-xs text-gray-500">
                                                    {dayData.summary}
                                                </p>
                                            </div>
                                        )}

                                        {/* Green Indicator Dot */}
                                        {isCompleted && (
                                            <span 
                                                className="absolute w-1.5 h-1.5 rounded-full bg-green-500" 
                                                style={{ bottom: '5px', left: '50%', transform: 'translateX(-50%)' }}
                                            />
                                        )}
                                    </>
                                ) : (
                                    // Empty day cell
                                    <p className="text-lg text-gray-300"></p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal for Day Details */}
            {selectedDay && (
                <DayDetailModal 
                    date={selectedDay.date} 
                    initialCompletions={selectedDay.completions} 
                    kpis={kpis}
                    userId={userId}
                    onClose={() => setSelectedDay(null)}
                />
            )}
        </div>
    );
}

export default CalendarView;