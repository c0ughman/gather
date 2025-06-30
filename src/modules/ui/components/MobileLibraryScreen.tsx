import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bot, MessageSquare, Phone, Sparkles, Users, Zap, Brain, 
  Search, TrendingUp, Bell, Globe, Rss, Newspaper,
  Mic, MessageCircle, Sliders, Grid3x3, Filter, Star, Clock, 
  BarChart3, Bookmark, CheckCircle2, Plus, User, LogOut, ChevronDown
} from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { sourceIntegrations, actionIntegrations } from '../../integrations/data/integrations';
import { useAuth } from '../../auth/hooks/useAuth';
import { SubscriptionBadge } from '../../payments';

interface MobileLibraryScreenProps {
  contacts: AIContact[];
  onChatClick: (contact: AIContact) => void;
  onCallClick: (contact: AIContact) => void;
  onSettingsClick: (contact?: AIContact) => void;
  onCreateAgent: () => void;
}

export default function MobileLibraryScreen({ 
  contacts, 
  onChatClick, 
  onCallClick, 
  onSettingsClick,
  onCreateAgent 
}: MobileLibraryScreenProps) {
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [integrationSearchQuery, setIntegrationSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'agents' | 'integrations'>('agents');
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

  // Get frequently used agents (first 4)
  const frequentAgents = useMemo(() => {
    return [...contacts]
      .sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0))
      .slice(0, 4);
  }, [contacts]);
  
  // Filter agents for search
  const filteredAgents = useMemo(() => {
    if (!agentSearchQuery.trim()) return contacts;
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
      contact.description.toLowerCase().includes(agentSearchQuery.toLowerCase())
    );
  }, [contacts, agentSearchQuery]);

  // All integrations
  const allIntegrations = [...sourceIntegrations, ...actionIntegrations];
  
  // Filter integrations for search
  const filteredIntegrations = useMemo(() => {
    if (!integrationSearchQuery.trim()) return allIntegrations;
    return allIntegrations.filter(integration => 
      integration.name.toLowerCase().includes(integrationSearchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(integrationSearchQuery.toLowerCase()) ||
      integration.tags?.some(tag => tag.toLowerCase().includes(integrationSearchQuery.toLowerCase()))
    );
  }, [integrationSearchQuery, allIntegrations]);

  const getIconForIntegration = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<any> } = {
      Globe, Rss, Newspaper, TrendingUp, Bot, Zap, Bell
    };
    const IconComponent = iconMap[iconName] || Globe;
    return <IconComponent className="w-5 h-5" />;
  };

  // Helper function to create radial gradient for agents without avatars
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

  return (
    <div className="h-full bg-glass-bg overflow-y-auto mobile-scroll pb-20">
      {/* Header Section */}
      <div className="bg-glass-panel glass-effect border-b border-slate-700 px-4 py-4 safe-area-top">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-white">Library</h1>
              <SubscriptionBadge />
            </div>
            <p className="text-slate-400">AI agents and integrations</p>
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

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-700/30 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === 'agents'
                ? 'bg-[#186799] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            AI Agents
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${
              activeTab === 'integrations'
                ? 'bg-[#186799] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Integrations
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'agents' ? 'Search agents...' : 'Search integrations...'}
            value={activeTab === 'agents' ? agentSearchQuery : integrationSearchQuery}
            onChange={(e) => activeTab === 'agents' ? setAgentSearchQuery(e.target.value) : setIntegrationSearchQuery(e.target.value)}
            className="w-full bg-glass-panel glass-effect text-white pl-12 pr-4 py-3 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 font-inter text-base"
          />
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'agents' ? (
          <>
            {/* Getting Started or Frequently Used Agents */}
            <section className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4">
                {contacts.length === 0 ? 'Get Started' : 'Frequently Used'}
              </h2>
              
              {contacts.length === 0 ? (
                <div className="bg-glass-panel glass-effect rounded-2xl p-6 border border-slate-700 text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-[#186799] to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <Bot className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Create Your First AI Agent</h3>
                  <p className="text-slate-400 mb-4">
                    Start by creating a personalized AI assistant.
                  </p>
                  <button
                    onClick={onCreateAgent}
                    className="px-6 py-3 bg-gradient-to-r from-[#186799] to-purple-600 hover:from-[#1a5a7a] hover:to-purple-700 text-white rounded-full font-semibold transition-all duration-200"
                  >
                    Create Your First Agent
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {frequentAgents.map((agent) => (
                    <div key={agent.id} className="group relative">
                      <div className="bg-glass-panel glass-effect rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all duration-200">
                        <div className="flex flex-col items-center text-center space-y-3">
                          <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden">
                            {agent.avatar ? (
                              <img
                                src={agent.avatar}
                                alt={agent.name}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : (
                              <div 
                                className="w-full h-full rounded-xl"
                                style={{ background: createAgentGradient(agent.color) }}
                              />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-sm mb-1">{agent.name}</h3>
                            <p className="text-slate-400 text-xs line-clamp-2">{agent.description}</p>
                          </div>
                          <div className="flex space-x-1 w-full">
                            <button 
                              onClick={() => onChatClick(agent)}
                              className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg p-2 text-slate-300 hover:text-white transition-colors"
                            >
                              <MessageCircle className="w-4 h-4 mx-auto" />
                            </button>
                            <button 
                              onClick={() => onCallClick(agent)}
                              className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg p-2 text-slate-300 hover:text-white transition-colors"
                            >
                              <Mic className="w-4 h-4 mx-auto" />
                            </button>
                            <button 
                              onClick={() => onSettingsClick(agent)}
                              className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg p-2 text-slate-300 hover:text-white transition-colors"
                            >
                              <Sliders className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* All Agents */}
            {contacts.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-4">All Agents</h2>
                
                <div className="space-y-3">
                  {filteredAgents.map((agent) => (
                    <div key={`all-${agent.id}`} className="bg-glass-panel glass-effect rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all duration-200">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                          {agent.avatar ? (
                            <img
                              src={agent.avatar}
                              alt={agent.name}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : (
                            <div 
                              className="w-full h-full rounded-xl"
                              style={{ background: createAgentGradient(agent.color) }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white mb-1">{agent.name}</h3>
                          <p className="text-slate-400 text-sm line-clamp-2">{agent.description}</p>
                        </div>
                        <div className="flex space-x-1">
                          <button 
                            onClick={() => onChatClick(agent)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onCallClick(agent)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors"
                          >
                            <Mic className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          /* Integrations Library */
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Available Integrations</h2>

            <div className="space-y-3">
              {filteredIntegrations.map((integration) => (
                <div key={integration.id} className="bg-glass-panel glass-effect rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all duration-200">
                  <div className="flex items-start space-x-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: integration.color + '20', color: integration.color }}
                    >
                      {getIconForIntegration(integration.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-white">{integration.name}</h3>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                          integration.category === 'source' 
                            ? 'bg-[#186799]/20 text-[#186799]' 
                            : 'bg-green-600/10 text-green-300'
                        }`}>
                          {integration.category}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm line-clamp-2">{integration.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
} 