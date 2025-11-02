import React, { useState } from 'react';

function Accordion({ title, children, icon: IconComponent }) { // 1. Accept an IconComponent prop
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"> {/* Added shadow-sm, changed border-radius */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
      >
        <div className="flex items-center space-x-3"> {/* Added div for icon and title */}
          {IconComponent && <IconComponent className="text-blue-500 text-xl" />} {/* Render icon here */}
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <i className={`fas fa-chevron-down text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      
      {/* Collapsible Content */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-screen' : 'max-h-0'}`}
      >
        <div className="p-4 border-t border-gray-200 bg-white prose max-w-none text-gray-700 leading-relaxed"> {/* Added bg-white, text-gray-700, leading-relaxed */}
          {children}
        </div>
      </div>
    </div>
  );
}

export default Accordion;