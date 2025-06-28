import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Bot, MessageSquare, Phone, Settings, Sparkles, Users, Zap, Brain, 
  Search, TrendingUp, Bell, Globe, Rss, Newspaper,
  Mic, MessageCircle, Sliders, Grid3x3, Filter, Star, Clock, 
  BarChart3, Bookmark, CheckCircle2, Plus, User, LogOut, ChevronDown, MoreHorizontal
} from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { sourceIntegrations, actionIntegrations } from '../../integrations/data/integrations';
import { useAuth } from '../../auth/hooks/useAuth';

interface DashboardProps {
  contacts: AIContact[];
  onChatClick: (contact: AIContact) => void;
  onCallClick: (contact: AIContact) => void;
  onSettingsClick: (contact?: AIContact) => void;
  onNewChatClick: (contact: AIContact) => void;
  onCreateAgent: () => void;
}

export default function Dashboard({ 
  contacts, 
  onChatClick, 
  onCallClick, 
  onSettingsClick,
  onNewChatClick,
  onCreateAgent 
}: DashboardProps) {
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [integrationSearchQuery, setIntegrationSearchQuery] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const { user, signOut } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  // Get frequently used agents (first 4 for hero section)
  const frequentAgents = contacts.slice(0, 4);
  
  // Get recent agents based on last seen
  const recentAgents = useMemo(() => {
    return [...contacts]
      .sort((a, b) => {
        if (a.lastSeen === 'now') return -1;
        if (b.lastSeen === 'now') return 1;
        return 0;
      })
      .slice(0, 6);
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

  // Calculate stats
  const stats = {
    totalAgents: contacts.length,
    activeAgents: contacts.filter(c => c.status === 'online').length,
    totalIntegrations: contacts.reduce((sum, c) => sum + (c.integrations?.length || 0), 0),
    activeIntegrations: contacts.reduce((sum, c) => 
      sum + (c.integrations?.filter(i => i.status === 'active').length || 0), 0
    )
  };

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

  const getComplexityIndicators = (contact: AIContact) => {
    const indicators = [];
    
    // Count documents (blue dots)
    const documentCount = contact.documents?.length || 0;
    for (let i = 0; i < Math.min(documentCount, 7); i++) {
      indicators.push({ type: 'document', color: '#3b82f6' });
    }
    
    // Count source integrations (green dots)
    const sourceIntegrations = contact.integrations?.filter(integration => {
      const sourceIds = ['http-requests', 'google-news', 'rss-feeds', 'financial-markets', 'notion-oauth-source'];
      return sourceIds.includes(integration.integrationId) && integration.config.enabled;
    }) || [];
    
    for (let i = 0; i < Math.min(sourceIntegrations.length, 7); i++) {
      indicators.push({ type: 'source', color: '#10b981' });
    }
    
    // Count action integrations (red dots)
    const actionIntegrations = contact.integrations?.filter(integration => {
      const actionIds = ['api-request-tool', 'domain-checker-tool', 'zapier-webhook', 'n8n-webhook', 'webhook-trigger', 'google-sheets', 'notion-oauth-action'];
      return actionIds.includes(integration.integrationId) && integration.config.enabled;
    }) || [];
    
    for (let i = 0; i < Math.min(actionIntegrations.length, 7); i++) {
      indicators.push({ type: 'action', color: '#ef4444' });
    }
    
    return {
      indicators: indicators.slice(0, 7),
      hasMore: indicators.length > 7,
      counts: {
        documents: documentCount,
        sources: sourceIntegrations.length,
        actions: actionIntegrations.length,
        total: documentCount + sourceIntegrations.length + actionIntegrations.length
      }
    };
  };

  const renderComplexityIndicators = (contact: AIContact, size: 'small' | 'medium' | 'large' = 'small') => {
    const { indicators, hasMore, counts } = getComplexityIndicators(contact);
    
    if (indicators.length === 0) return null;
    
    // Set radius and dot size based on container size
    // Smaller radius to be partially inside the image
    const radius = size === 'large' ? 40 : size === 'medium' ? 30 : 20;
    const dotSize = size === 'large' ? 'w-4 h-4' : size === 'medium' ? 'w-3.5 h-3.5' : 'w-3 h-3';
    const dotOffset = size === 'large' ? 4 : size === 'medium' ? 3 : 3;
    
    // Starting from bottom right and going counter-clockwise around the bottom-right quadrant
    return (
      <div className="absolute inset-0 pointer-events-none">
        {indicators.map((indicator, index) => {
          // Calculate position around the bottom-right quadrant
          const totalItems = hasMore ? indicators.length + 1 : indicators.length;
          // Start at 0 degrees (right) and go counter-clockwise up to 90 degrees (bottom)
          // We're using a quarter circle (90 degrees) starting from the bottom right
          const angle = Math.PI / 2 - (index / totalItems) * (Math.PI / 2);
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          
          return (
            <div
              key={index}
              className={`absolute ${dotSize} rounded-full border border-slate-800`}
              style={{
                backgroundColor: indicator.color,
                right: `${dotOffset - x}px`,
                bottom: `${dotOffset - y}px`,
                boxShadow: `0 0 6px ${indicator.color}40`
              }}
            />
          );
        })}
        
        {/* "More" indicator */}
        {hasMore && (
          <div
            className={`absolute ${dotSize} rounded-full border border-slate-800 bg-slate-600 flex items-center justify-center`}
            style={{
              right: `${dotOffset - Math.cos(Math.PI / 2 - (indicators.length / (indicators.length + 1)) * (Math.PI / 2)) * radius}px`,
              bottom: `${dotOffset - Math.sin(Math.PI / 2 - (indicators.length / (indicators.length + 1)) * (Math.PI / 2)) * radius}px`,
            }}
          >
            <MoreHorizontal className={`${size === 'large' ? 'w-2.5 h-2.5' : 'w-2 h-2'} text-white`} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full bg-glass-bg overflow-y-auto">
      {/* Header Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#186799]/10 via-purple-600/5 to-glass-bg"></div>
        
        <div className="relative px-8 pt-8 pb-12">
          <div className="max-w-6xl mx-auto">
            {/* Greeting */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-bold text-white">Good morning, {user?.email?.split('@')[0] || 'User'}</h1>
                  <p className="text-slate-400 text-lg">Ready to chat with your AI companions?</p>
                </div>
                
                {/* Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors duration-200"
                  >
                    <User className="w-5 h-5 text-white" />
                  </button>
                  
                  {showProfileDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 rounded-lg border border-slate-600 shadow-lg z-50">
                      <div className="p-2">
                        <div className="px-3 py-2 border-b border-slate-600 mb-2">
                          <p className="text-white text-sm font-medium">{user?.email?.split('@')[0]}</p>
                          <p className="text-slate-400 text-xs">{user?.email}</p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await signOut();
                              setShowProfileDropdown(false);
                            } catch (error) {
                              console.error('Error signing out:', error);
                            }
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors duration-200 text-sm"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-glass-panel/50 glass-effect rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-[#186799]/20">
                    <Users className="w-5 h-5 text-[#186799]" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.totalAgents}</div>
                    <div className="text-slate-400 text-sm">AI Agents</div>
                  </div>
                </div>
              </div>
              <div className="bg-glass-panel/50 glass-effect rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-green-600/20">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.activeAgents}</div>
                    <div className="text-slate-400 text-sm">Online Now</div>
                  </div>
                </div>
              </div>
              <div className="bg-glass-panel/50 glass-effect rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-purple-600/20">
                    <Grid3x3 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.totalIntegrations}</div>
                    <div className="text-slate-400 text-sm">Integrations</div>
                  </div>
                </div>
              </div>
              <div className="bg-glass-panel/50 glass-effect rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-orange-600/20">
                    <Zap className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stats.activeIntegrations}</div>
                    <div className="text-slate-400 text-sm">Active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Getting Started or Frequently Used Agents */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {contacts.length === 0 ? 'Get Started' : 'Frequently Used'}
              </h2>
              {contacts.length > 0 && (
                <button
                  onClick={onCreateAgent}
                  className="flex items-center space-x-2 px-4 py-2 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full transition-colors duration-200"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Agent</span>
                </button>
              )}
            </div>
            
            {contacts.length === 0 ? (
              <div className="bg-glass-panel glass-effect rounded-2xl p-8 border border-slate-700 text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-[#186799] to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                  <Bot className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Create Your First AI Agent</h3>
                <p className="text-slate-400 text-lg mb-6 max-w-md mx-auto">
                  Start by creating a personalized AI assistant. Choose from our templates or build your own from scratch.
                </p>
                <button
                  onClick={onCreateAgent}
                  className="px-6 py-3 bg-gradient-to-r from-[#186799] to-purple-600 hover:from-[#1a5a7a] hover:to-purple-700 text-white rounded-full font-semibold transition-all duration-200 transform hover:scale-105"
                >
                  Create Your First Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {frequentAgents.map((agent) => (
                  <div key={agent.id} className="group relative">
                    <div className="bg-glass-panel glass-effect rounded-2xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-200 hover:transform hover:scale-105">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="relative w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden">
                          {agent.avatar ? (
                            <img
                              src={agent.avatar}
                              alt={agent.name}
                              className="w-full h-full object-cover rounded-2xl"
                            />
                          ) : (
                            <div 
                              className="w-full h-full rounded-2xl"
                              style={{ background: createAgentGradient(agent.color) }}
                            />
                          )}
                          {renderComplexityIndicators(agent, 'large')}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white mb-1">{agent.name}</h3>
                          <p className="text-slate-400 text-sm line-clamp-2">{agent.description}</p>
                        </div>
                        <div className="flex space-x-2 w-full">
                          <button 
                            onClick={() => onChatClick(agent)}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-full p-2 text-slate-300 hover:text-white transition-colors"
                          >
                            <MessageCircle className="w-4 h-4 mx-auto" />
                          </button>
                          <button 
                            onClick={() => onCallClick(agent)}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-full p-2 text-slate-300 hover:text-white transition-colors"
                          >
                            <Mic className="w-4 h-4 mx-auto" />
                          </button>
                          <button 
                            onClick={() => onSettingsClick(agent)}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-full p-2 text-slate-300 hover:text-white transition-colors"
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

          {/* Recent Activity - Only show if there are contacts */}
          {contacts.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {recentAgents.slice(0, 6).map((agent) => (
                  <div key={`recent-${agent.id}`} className="bg-glass-panel glass-effect rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="relative w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
                        {agent.avatar ? (
                          <img
                            src={agent.avatar}
                            alt={agent.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div 
                            className="w-full h-full rounded-lg"
                            style={{ background: createAgentGradient(agent.color) }}
                          />
                        )}
                        {renderComplexityIndicators(agent, 'small')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">{agent.name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-400 text-sm">{agent.lastSeen}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Agents Library */}
          {contacts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Agents Library</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={agentSearchQuery}
                    onChange={(e) => setAgentSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-glass-panel glass-effect border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-[#186799] focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAgents.map((agent) => (
                  <div key={`library-${agent.id}`} className="bg-glass-panel glass-effect rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-200 group">
                    <div className="flex items-start space-x-4">
                      <div className="relative w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
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
                        {renderComplexityIndicators(agent, 'medium')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-white">{agent.name}</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-4 line-clamp-2">{agent.description}</p>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => onChatClick(agent)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 hover:text-white transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onCallClick(agent)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 hover:text-white transition-colors"
                          >
                            <Mic className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onSettingsClick(agent)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 hover:text-white transition-colors"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Integrations Library */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Integrations Library</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search integrations..."
                  value={integrationSearchQuery}
                  onChange={(e) => setIntegrationSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-glass-panel glass-effect border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-[#186799] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredIntegrations.map((integration) => (
                <div key={integration.id} className="bg-glass-panel glass-effect rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-200 group">
                  <div className="flex items-start space-x-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: integration.color }}
                    >
                      {getIconForIntegration(integration.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white mb-2">{integration.name}</h3>
                      <p className="text-slate-400 text-sm mb-3 line-clamp-2">{integration.description}</p>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        integration.category === 'source' 
                          ? 'bg-[#186799]/20 text-[#186799]' 
                          : 'bg-green-600/20 text-green-400'
                      }`}>
                        {integration.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}