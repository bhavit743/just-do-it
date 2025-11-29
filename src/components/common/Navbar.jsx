import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar({ user }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const location = useLocation();
    
    // --- Mock/Prop Handling for User Data ---
    const currentUser = user;
    const logout = () => {
        // This is where your actual authentication sign out logic would go.
        console.log("Logout function placeholder executed.");
    };
    // ------------------------------------------


    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    // Function to determine the active top-level path (aligned with App.jsx routes)
    const getActiveHeader = (path) => {
        // Match the index/ActivityTracker route (path: '/')
        if (path === '/' && location.pathname === '/') return true;
        
        // Match the main modules (expense, split)
        const currentPathSegment = location.pathname.split('/')[1];
        const targetPathSegment = path.split('/')[1];
        
        return currentPathSegment === targetPathSegment;
    };

    // --- Navigation Items based STRICTLY on App.jsx routes ---
    const navItems = [
        { name: 'Activity Tracker', path: '/' },
        { name: 'Personal Expenses', path: '/expense' },
        { name: 'Split', path: '/splitwise' }
    ];

    return (
        <nav className="bg-white shadow-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    
                    {/* Logo/App Name */}
                    <Link to="/" className="flex-shrink-0 text-xl font-bold text-gray-900">
                        JUST DO IT
                    </Link>

                    {/* Hamburger Button */}
                    <div className="-mr-2 flex items-center">
                        <button
                            onClick={toggleMenu}
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                            aria-expanded="false"
                        >
                            <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu / Hamburger Menu Content */}
            {isMenuOpen && (
                <div className="md:hidden">
                    {/* Main Modules (Top Section) */}
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
                        {navItems.map(item => (
                            <Link
                                key={item.name}
                                to={item.path}
                                onClick={toggleMenu}
                                className={`block px-3 py-2 rounded-md text-base font-medium transition ${
                                    getActiveHeader(item.path) 
                                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                        : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>
                    
                    {/* User Profile and Sign Out Section (Bottom Section) */}
                    <div className="pt-4 pb-3 border-t border-gray-200">

                        
                        {/* --- PROFILE AND HOW TO (HORIZONTAL DISPLAY FIX AND LIGHT BG) --- */}
                        <div className="mt-3 flex justify-evenly px-2">
                            {/* Profile Settings */}
                            <Link
                                to="/profile"
                                onClick={toggleMenu}
                                // ADDED bg-gray-100 and hover:bg-gray-200
                                className="text-center px-2 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 w-1/2 mx-1 transition"
                            >
                                Profile Settings
                            </Link>
                            
                            {/* How To / Help */}
                            <Link
                                to="/tutorial"
                                onClick={toggleMenu}
                                // ADDED bg-gray-100 and hover:bg-gray-200
                                className="text-center px-2 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 w-1/2 mx-1 transition"
                            >
                                How To / Help
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}

export default Navbar;