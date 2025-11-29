import React from 'react';

function Modal({ children, onClose, title }) {
  return (
    // Backdrop
    <div 
      // Ensure the backdrop itself allows scrolling if the underlying page is scrollable, 
      // but the fix is mainly applied to the modal content below.
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose} 
    >
      {/* Modal Content */}
      <div 
        // 1. Set max height relative to screen height (e.g., 90%)
        // 2. Enable overflow-y-auto on the wrapper to handle overall modal size
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 max-h-[90vh] flex flex-col" // <-- ADDED max-h-[90vh] and flex flex-col
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header (Fixed) */}
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0"> 
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            &times;
          </button>
        </div>
        
        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto flex-grow"> 
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;