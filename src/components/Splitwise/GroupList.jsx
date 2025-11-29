import React from 'react';

const formatMoney = (amount) => `₹${Math.abs(amount).toFixed(2)}`;

function GroupList({ userId, groups, onSelectGroup, onCreateGroup }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-bold text-gray-900">Your Groups</h3>
            <button onClick={onCreateGroup} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <i className="fas fa-plus mr-2"></i> New Group
            </button>
        </div>
        <div className="p-8 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="text-gray-400 mb-3"><i className="fas fa-users text-4xl"></i></div>
            <p className="text-gray-600 font-medium">No groups yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold text-gray-900">Your Groups</h3>
        <button onClick={onCreateGroup} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
          <i className="fas fa-plus mr-2"></i> New Group
        </button>
      </div>

      <div className="grid gap-3">
        {groups.map(group => {
            // Get Balance from the Group Document (updated by Modals)
            const balance = group.balances?.[userId] || 0;
            const isOwed = balance > 0.01;
            const isOwing = balance < -0.01;
            const isSettled = !isOwed && !isOwing;

            return (
                <div key={group.id} onClick={() => onSelectGroup(group)} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl shadow-inner">
                            {group.name ? group.name.charAt(0).toUpperCase() : 'G'}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 text-lg">{group.name}</h4>
                            <p className="text-xs text-gray-500 flex items-center"><i className="fas fa-user-friends mr-1"></i>{group.members?.length || 0} members</p>
                        </div>
                    </div>
                    
                    {/* NEW: Balance on Tile */}
                    <div className="text-right">
                        {isOwed && (
                            <>
                                <p className="text-[10px] uppercase font-bold text-green-600 tracking-wide">you get back</p>
                                <p className="text-lg font-bold text-green-600">{formatMoney(balance)}</p>
                            </>
                        )}
                        {isOwing && (
                            <>
                                <p className="text-[10px] uppercase font-bold text-orange-600 tracking-wide">you owe</p>
                                <p className="text-lg font-bold text-orange-600">{formatMoney(balance)}</p>
                            </>
                        )}
                        {isSettled && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Settled Up</span>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}

export default GroupList;