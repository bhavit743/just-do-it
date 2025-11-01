import React, { useState } from 'react';

// Our 30-color palette
const COLOR_PALETTE = [
  // Reds / Pinks
  '#EF4444', '#F87171', '#FBCFE8', '#BE185D', '#E11D48',
  // Oranges / Yellows
  '#F97316', '#FB923C', '#FFEDD5', '#F59E0B', '#FEF9C3',
  // Greens
  '#10B981', '#34D399', '#D1FAE5', '#047857', '#84CC16',
  // Blues
  '#3B82F6', '#60A5FA', '#DBEAFE', '#0D9488', '#0F766E',
  // Purples
  '#8B5CF6', '#A78BFA', '#EDE9FE', '#701A75', '#D946EF',
  // Neutrals
  '#1F2937', '#6B7280', '#E5E7EB', '#78350F', '#A16207',
];

function ColorPalette({ selectedColor, onChange }) {
  // --- 1. ADD: Internal state to manage visibility ---
  const [isOpen, setIsOpen] = useState(false);

  // --- 2. ADD: Handler to select a color AND close the palette ---
  const handleColorSelect = (color) => {
    onChange(color);
    setIsOpen(false); // Close on selection
  };

  // --- 3. RENDER: The collapsed trigger button by default ---
  if (!isOpen) {
    return (
      <div className="flex items-center gap-3">
        <div 
          className="w-8 h-8 rounded-full border-2 border-gray-200" 
          style={{ backgroundColor: selectedColor }}
          title={`Current color: ${selectedColor}`}
        ></div>
        <button 
          type="button" 
          onClick={() => setIsOpen(true)}
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Change
        </button>
      </div>
    );
  }

  // --- 4. RENDER: The full, open palette if isOpen is true ---
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          className={`w-8 h-8 rounded-full cursor-pointer border-2 ${
            selectedColor === color 
              ? 'ring-2 ring-offset-2 ring-blue-500' // Selected state
              : 'border-gray-200' // Default state
          }`}
          style={{ backgroundColor: color }}
          onClick={() => handleColorSelect(color)} // Use new handler
          title={color}
        />
      ))}
    </div>
  );
}

export default ColorPalette;