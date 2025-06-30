import React, { useState, useEffect } from 'react';
import { MessageCircle, Phone, Users, Search, Plus, Grid3x3, User, LogOut, ChevronDown } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { useAuth } from '../../auth/hooks/useAuth';
import { SubscriptionBadge } from '../../payments';

interface MobileContactsScreenProps {
  contacts: AIContact[];
  onChatClick: (contact: AIContact) => void;
  onCallClick: (contact: AIContact) => void;
  onCreateAgent: () => void;
}

export default function MobileContactsScreen({ 
  contacts, 
  onChatClick, 
  onCallClick, 
  onCreateAgent 
}: MobileContactsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const { user, signOut } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.profile-dropdown')) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showProfileDropdown]);

  const createAgentGradient = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const compR = Math.round(255 - r * 0.3);
    const compG = Math.round(255 - g * 0.3);
    const compB = Math.round(255 - b * 0.3);
    
    const lightCompR = Math.round(compR + (255 - compR) * 0.8);
    const lightCompG = Math.round(compG + (255 - compG) * 0.8);
    const lightCompB = Math.round(compB + (255 - compB) * 0.8);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort contacts based on active filter
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (activeFilter === 'All') {
      return 0;
    } else if (activeFilter === 'Sources') {
      return 0;
    } else if (activeFilter === 'Actions') {
      return 0;
    } else if (activeFilter === 'Documents') {
      const aDocuments = a.documents?.length || 0;
      const bDocuments = b.documents?.length || 0;
      return bDocuments - aDocuments;
    }
    return 0;
  });

  const filters = ['All', 'Sources', 'Actions', 'Documents'];

  // Filter contacts by integration type
  const getFilteredContacts = () => {
    if (activeFilter === 'All') {
      return sortedContacts;
    } else if (activeFilter === 'Sources') {
      return sortedContacts.filter(contact => 
        contact.integrations?.some(integration => 
          integration.integrationId.includes('source') || 
          ['http-requests', 'google-news', 'rss-feeds', 'financial-markets', 'notion-oauth-source'].includes(integration.integrationId)
        )
      );
    } else if (activeFilter === 'Actions') {
      return sortedContacts.filter(contact => 
        contact.integrations?.some(integration => 
          integration.integrationId.includes('action') || 
          ['api-request-tool', 'domain-checker-tool', 'webhook-trigger', 'zapier-webhook', 'n8n-webhook', 'google-sheets', 'notion-oauth-action'].includes(integration.integrationId)
        )
      );
    } else if (activeFilter === 'Documents') {
      return sortedContacts.filter(contact => (contact.documents?.length || 0) > 0);
    }
    return sortedContacts;
  };

  const displayContacts = getFilteredContacts();

  return (
    <div className="h-full bg-glass-bg flex flex-col font-inter">
      {/* Header */}
      <div className="bg-glass-panel glass-effect border-b border-slate-700 px-4 py-4 safe-area-top">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Gather</h1>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-slate-400">Welcome, {user?.email?.split('@')[0]}</p>
              <SubscriptionBadge />
            </div>
          </div>
          
          {/* Profile Dropdown */}
          <div className="relative profile-dropdown">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center space-x-2 p-2 bg-glass-panel glass-effect rounded-lg hover:bg-slate-700/50 transition-colors duration-200"
            >
              <User className="w-5 h-5 text-slate-400" />
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            
            {showProfileDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-[9999]" style={{ backgroundColor: 'rgba(30, 41, 59, 0.98)' }}>
                <div className="p-3 border-b border-slate-600">
                  <p className="text-white font-medium truncate">{user?.email || 'User'}</p>
                  <p className="text-slate-400 text-sm">Free Plan</p>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setShowProfileDropdown(false);
                    await signOut();
                  }}
                  className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-700/70 transition-colors duration-200 flex items-center space-x-2 rounded-b-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-glass-panel glass-effect text-white pl-12 pr-4 py-3 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 font-inter text-base"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 font-inter whitespace-nowrap ${
                activeFilter === filter
                  ? 'bg-[#186799] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto mobile-scroll">
        {displayContacts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="text-slate-500 mb-6">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No agents yet</p>
                <p className="text-sm text-slate-400">Create your first AI agent to get started</p>
              </div>
              <button
                onClick={onCreateAgent}
                className="flex items-center space-x-2 px-6 py-3 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full transition-colors duration-200 mx-auto"
              >
                <Plus className="w-5 h-5" />
                <span>Create Agent</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pb-20">
            {displayContacts.map((contact) => (
              <div
                key={contact.id}
                className="px-4 py-4 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors duration-200 cursor-pointer active:bg-slate-600/30"
                onClick={() => onChatClick(contact)}
              >
                <div className="flex items-center space-x-4">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden">
                      {contact.avatar ? (
                        <img
                          src={contact.avatar}
                          alt={contact.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <div
                          className="w-full h-full rounded-full"
                          style={{ background: createAgentGradient(contact.color) }}
                        />
                      )}
                    </div>
                    {/* Online status indicator */}
                    {contact.status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white font-medium truncate font-inter text-base">{contact.name}</h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCallClick(contact);
                          }}
                          className="p-2 rounded-full hover:bg-slate-600 transition-colors duration-200"
                          title="Voice call"
                        >
                          <Phone className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm truncate font-inter">
                      {contact.description.length > 50 
                        ? `${contact.description.substring(0, 50)}...` 
                        : contact.description
                      }
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {contact.lastSeen}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 