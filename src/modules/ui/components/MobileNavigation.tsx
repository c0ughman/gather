import React from 'react';
import { MessageCircle, Grid3x3, Plus } from 'lucide-react';

interface MobileNavigationProps {
  currentView: 'contacts' | 'library';
  onViewChange: (view: 'contacts' | 'library') => void;
  onCreateAgent: () => void;
}

export default function MobileNavigation({ currentView, onViewChange, onCreateAgent }: MobileNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-glass-panel glass-effect border-t border-slate-700 px-2 py-2 safe-area-bottom z-50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {/* Left - Chats */}
        <button
          onClick={() => onViewChange('contacts')}
          className={`flex flex-col items-center justify-center px-6 py-2 rounded-lg transition-colors duration-200 ${
            currentView === 'contacts'
              ? 'text-[#186799] bg-[#186799]/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <MessageCircle className={`w-6 h-6 mb-1 ${currentView === 'contacts' ? 'text-[#186799]' : ''}`} />
          <span className={`text-xs font-medium ${currentView === 'contacts' ? 'text-[#186799]' : ''}`}>
            Chats
          </span>
        </button>

        {/* Center - Create Agent */}
        <button
          onClick={onCreateAgent}
          className="flex flex-col items-center justify-center px-6 py-2 rounded-lg transition-colors duration-200 text-slate-400 hover:text-white hover:bg-slate-700/50"
        >
          <Plus className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">
            Create
          </span>
        </button>

        {/* Right - Library */}
        <button
          onClick={() => onViewChange('library')}
          className={`flex flex-col items-center justify-center px-6 py-2 rounded-lg transition-colors duration-200 ${
            currentView === 'library'
              ? 'text-[#186799] bg-[#186799]/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <Grid3x3 className={`w-6 h-6 mb-1 ${currentView === 'library' ? 'text-[#186799]' : ''}`} />
          <span className={`text-xs font-medium ${currentView === 'library' ? 'text-[#186799]' : ''}`}>
            Library
          </span>
        </button>
      </div>
    </div>
  );
} 