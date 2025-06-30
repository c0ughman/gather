import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import { getIntegrationById } from '../../modules/integrations/data/integrations';
import { supabase } from '../../modules/database/lib/supabase';
import { integrationsService } from '../../modules/integrations/core/integrationsService';

// Import components
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import Dashboard from '../../modules/ui/components/Dashboard';
import ContactSidebar from '../../modules/ui/components/ContactSidebar';
import SettingsSidebar from '../../modules/ui/components/SettingsSidebar';
import SettingsScreen from '../../modules/ui/components/SettingsScreen';
import ChatScreen from '../../modules/chat/components/ChatScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';

// Import types
import { AIContact, Message } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';

// Mobile detection hook
function useMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Agent template interface
interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  default_color: string;
  default_voice: string;
  default_avatar_url?: string;
  personality_traits: string[];
  capabilities: string[];
  suggested_integrations: string[];
  tags: string[];
  is_featured: boolean;
  is_active: boolean;
}

export default function App() {
  const { user, loading } = useAuth();
  const isMobile = useMobile();
  
  // App state
  const [currentView, setCurrentView] = useState<'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent'>('landing');
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [mobileView, setMobileView] = useState<'contacts' | 'library'>('library'); // Start with library
  const [templateForCreation, setTemplateForCreation] = useState<AgentTemplate | null>(null);

  // Load user agents on mount
  useEffect(() => {
    if (user) {
      loadUserAgents();
    }
  }, [user]);

  const loadUserAgents = async () => {
    try {
      console.log('Loading user agents...');
      
      const { data: agents, error } = await supabase
        .from('user_agents')
        .select(`
          *,
          agent_documents (
            id,
            name,
            original_filename,
            file_type,
            file_size,
            file_url,
            content,
            summary,
            extracted_text,
            processing_status,
            extraction_quality,
            metadata,
            folder,
            tags,
            access_count,
            last_accessed_at,
            uploaded_at,
            created_at,
            updated_at
          ),
          agent_integrations (
            id,
            template_id,
            name,
            description,
            config,
            credentials,
            trigger_type,
            interval_minutes,
            status,
            last_executed_at,
            last_success_at,
            last_error_at,
            error_message,
            execution_count,
            last_data,
            data_summary,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user agents:', error);
        return;
      }

      console.log('Raw agents data:', agents);

      const formattedContacts: AIContact[] = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        initials: agent.initials,
        color: agent.color,
        voice: agent.voice,
        avatar: agent.avatar_url,
        status: agent.status as 'online' | 'busy' | 'offline',
        lastSeen: agent.last_seen,
        personalityPrompt: agent.personality_prompt,
        systemInstructions: agent.system_instructions,
        customSettings: agent.custom_settings,
        folder: agent.folder,
        tags: agent.tags,
        isFavorite: agent.is_favorite,
        sortOrder: agent.sort_order,
        totalConversations: agent.total_conversations,
        total_messages: agent.total_messages,
        lastUsedAt: agent.last_used_at ? new Date(agent.last_used_at) : undefined,
        documents: agent.agent_documents?.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.file_type,
          size: doc.file_size,
          content: doc.content,
          summary: doc.summary,
          extractedText: doc.extracted_text,
          uploadedAt: new Date(doc.uploaded_at),
          metadata: {
            ...doc.metadata,
            extractionQuality: doc.extraction_quality,
            processingStatus: doc.processing_status
          }
        })) || [],
        integrations: agent.agent_integrations?.map((integration: any) => ({
          id: integration.id,
          integrationId: integration.template_id,
          name: integration.name,
          config: {
            integrationId: integration.template_id,
            enabled: integration.status === 'active',
            settings: integration.config || {},
            trigger: integration.trigger_type || 'chat-start',
            intervalMinutes: integration.interval_minutes || 30,
            description: integration.description || ''
          },
          status: integration.status as 'active' | 'inactive' | 'error' | 'pending'
        })) || []
      }));

      console.log('Formatted contacts:', formattedContacts);
      setContacts(formattedContacts);
      
      // Set current view to dashboard if we have a user
      if (currentView === 'landing') {
        setCurrentView('dashboard');
      }
    } catch (error) {
      console.error('Error loading user agents:', error);
    }
  };

  // Auto-execute integrations when starting a chat
  const executeIntegrationsForContact = async (contact: AIContact) => {
    if (!contact.integrations) return;

    for (const integrationInstance of contact.integrations) {
      const integration = getIntegrationById(integrationInstance.integrationId);
      if (integration && 
          integrationInstance.status === 'active' &&
          (integrationInstance.config.trigger === 'chat-start' || integrationInstance.config.trigger === 'both')) {
        try {
          const data = await integrationsService.executeIntegration(integration, integrationInstance.config);
          integrationsService.storeIntegrationData(contact.id, integration.id, data, `Data from ${integration.name}`);
        } catch (error) {
          console.error(`Failed to execute integration ${integration.name}:`, error);
        }
      }
    }
  };

  // Navigation handlers
  const handleGetStarted = () => {
    setCurrentView('signup');
  };

  const handleSignUp = () => {
    setCurrentView('signup');
  };

  const handleSignIn = () => {
    setCurrentView('signin');
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
  };

  const handleSelectPlan = (plan: string) => {
    console.log('Selected plan:', plan);
    setCurrentView('dashboard');
  };

  const handleStayFree = () => {
    setCurrentView('dashboard');
  };

  const handleAuthSuccess = () => {
    setCurrentView('dashboard');
  };

  const handleHomeClick = () => {
    setCurrentView('dashboard');
  };

  const handleCreateAgent = () => {
    setTemplateForCreation(null); // Clear any template
    setCurrentView('create-agent');
  };

  const handleCreateFromTemplate = (template: AgentTemplate) => {
    setTemplateForCreation(template);
    setCurrentView('create-agent');
  };

  const handleChatClick = async (contact: AIContact) => {
    setSelectedContact(contact);
    setMessages([]);
    setConversationDocuments([]);
    setCurrentView('chat');
    
    // Execute integrations for this contact
    await executeIntegrationsForContact(contact);
  };

  const handleCallClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('call');
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
    }
    setCurrentView('settings');
  };

  const handleNewChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setMessages([]);
    setConversationDocuments([]);
    setCurrentView('chat');
  };

  const handleSendMessage = (content: string, documents?: DocumentInfo[]) => {
    if (!selectedContact) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: selectedContact.id,
      attachments: documents
    };

    setMessages(prev => [...prev, userMessage]);

    // Add documents to conversation documents if provided
    if (documents && documents.length > 0) {
      setConversationDocuments(prev => [...prev, ...documents]);
    }

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Thanks for your message! I'm ${selectedContact.name}, and I'm here to help you with ${selectedContact.description.toLowerCase()}. ${documents && documents.length > 0 ? `I can see you've shared ${documents.length} document${documents.length > 1 ? 's' : ''} with me - I'll analyze ${documents.length > 1 ? 'them' : 'it'} and incorporate the information into my responses.` : ''}`,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleSaveContact = async (contact: AIContact) => {
    try {
      console.log('Saving contact:', contact);

      // Prepare the update data
      const updateData = {
        name: contact.name,
        description: contact.description,
        initials: contact.initials,
        color: contact.color,
        voice: contact.voice,
        avatar_url: contact.avatar,
        personality_prompt: contact.personalityPrompt,
        system_instructions: contact.systemInstructions,
        custom_settings: contact.customSettings,
        folder: contact.folder,
        tags: contact.tags,
        is_favorite: contact.isFavorite,
        sort_order: contact.sortOrder,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('user_agents')
        .update(updateData)
        .eq('id', contact.id);

      if (error) {
        console.error('Error updating contact:', error);
        return;
      }

      // Update local state
      setContacts(prev => prev.map(c => c.id === contact.id ? contact : c));
      setSelectedContact(contact);
      
      console.log('Contact updated successfully');
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      console.log('Deleting contact:', contactId);

      const { error } = await supabase
        .from('user_agents')
        .delete()
        .eq('id', contactId);

      if (error) {
        console.error('Error deleting contact:', error);
        return;
      }

      // Update local state
      setContacts(prev => prev.filter(c => c.id !== contactId));
      setSelectedContact(null);
      setCurrentView('dashboard');
      
      console.log('Contact deleted successfully');
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const handleBack = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, show the main app
  if (user) {
    return (
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/*" element={
            <div className="h-screen bg-glass-bg flex overflow-hidden">
              {/* Desktop Layout */}
              {!isMobile && (
                <>
                  {/* Left Sidebar - Contacts */}
                  <div className="w-80 border-r border-slate-700 flex-shrink-0">
                    <ContactSidebar
                      contacts={contacts}
                      onChatClick={handleChatClick}
                      onCallClick={handleCallClick}
                      onSettingsClick={handleSettingsClick}
                      onHomeClick={handleHomeClick}
                      onCreateAgent={handleCreateAgent}
                    />
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 flex">
                    {currentView === 'dashboard' && (
                      <div className="flex-1">
                        <Dashboard
                          contacts={contacts}
                          onChatClick={handleChatClick}
                          onCallClick={handleCallClick}
                          onSettingsClick={handleSettingsClick}
                          onNewChatClick={handleNewChatClick}
                          onCreateAgent={handleCreateAgent}
                          onCreateFromTemplate={handleCreateFromTemplate}
                        />
                      </div>
                    )}

                    {currentView === 'chat' && selectedContact && (
                      <div className="flex-1">
                        <ChatScreen
                          contact={selectedContact}
                          messages={messages}
                          conversationDocuments={conversationDocuments}
                          onBack={handleBack}
                          onSendMessage={handleSendMessage}
                          onSettingsClick={handleSettingsClick}
                          onNewChatClick={handleNewChatClick}
                          onCallClick={handleCallClick}
                          showSidebar={showSidebar}
                          onToggleSidebar={handleToggleSidebar}
                        />
                      </div>
                    )}

                    {currentView === 'call' && selectedContact && (
                      <div className="flex-1">
                        <CallScreen
                          contact={selectedContact}
                          onBack={handleBack}
                          onEndCall={handleBack}
                        />
                      </div>
                    )}

                    {currentView === 'settings' && selectedContact && (
                      <div className="flex-1">
                        <SettingsScreen
                          contact={selectedContact}
                          onBack={handleBack}
                          onSave={handleSaveContact}
                          onDelete={handleDeleteContact}
                        />
                      </div>
                    )}

                    {currentView === 'create-agent' && (
                      <div className="flex-1">
                        <SettingsScreen
                          contact={{
                            id: 'new',
                            name: templateForCreation?.name || '',
                            description: templateForCreation?.description || '',
                            initials: templateForCreation?.name ? templateForCreation.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) : 'AI',
                            color: templateForCreation?.default_color || '#3b82f6',
                            voice: templateForCreation?.default_voice || 'Puck',
                            avatar: templateForCreation?.default_avatar_url,
                            status: 'online',
                            lastSeen: 'now',
                            personalityPrompt: templateForCreation?.personality_traits?.join(', '),
                            systemInstructions: templateForCreation?.capabilities?.join(', '),
                            customSettings: {},
                            folder: templateForCreation?.category,
                            tags: templateForCreation?.tags || [],
                            isFavorite: false,
                            sortOrder: 0,
                            totalConversations: 0,
                            total_messages: 0,
                            documents: [],
                            integrations: templateForCreation?.suggested_integrations?.map(integrationId => ({
                              id: `temp-${Date.now()}-${integrationId}`,
                              integrationId,
                              name: `${getIntegrationById(integrationId)?.name || 'Integration'} - ${templateForCreation.name}`,
                              config: {
                                integrationId,
                                enabled: true,
                                settings: {},
                                trigger: 'chat-start',
                                intervalMinutes: 30,
                                description: ''
                              },
                              status: 'active'
                            })) || []
                          }}
                          onBack={handleBack}
                          onSave={async (contact) => {
                            try {
                              console.log('Creating new agent:', contact);

                              const { data: newAgent, error } = await supabase
                                .from('user_agents')
                                .insert({
                                  user_id: user.id,
                                  name: contact.name,
                                  description: contact.description,
                                  initials: contact.initials,
                                  color: contact.color,
                                  voice: contact.voice,
                                  avatar_url: contact.avatar,
                                  status: 'online',
                                  last_seen: 'now',
                                  personality_prompt: contact.personalityPrompt,
                                  system_instructions: contact.systemInstructions,
                                  custom_settings: contact.customSettings || {},
                                  folder: contact.folder,
                                  tags: contact.tags || [],
                                  is_favorite: contact.isFavorite || false,
                                  sort_order: contact.sortOrder || 0,
                                  total_conversations: 0,
                                  total_messages: 0
                                })
                                .select()
                                .single();

                              if (error) {
                                console.error('Error creating agent:', error);
                                return;
                              }

                              console.log('Agent created successfully:', newAgent);

                              // Create integrations if any
                              if (contact.integrations && contact.integrations.length > 0) {
                                for (const integration of contact.integrations) {
                                  const { error: integrationError } = await supabase
                                    .from('agent_integrations')
                                    .insert({
                                      agent_id: newAgent.id,
                                      template_id: integration.integrationId,
                                      name: integration.name,
                                      description: integration.config.description,
                                      config: integration.config.settings,
                                      trigger_type: integration.config.trigger,
                                      interval_minutes: integration.config.intervalMinutes,
                                      status: 'active'
                                    });

                                  if (integrationError) {
                                    console.error('Error creating integration:', integrationError);
                                  }
                                }
                              }

                              // Reload agents and go back to dashboard
                              await loadUserAgents();
                              setCurrentView('dashboard');
                            } catch (error) {
                              console.error('Error creating agent:', error);
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* Right Sidebar - Settings (when chat is open and sidebar is shown) */}
                    {currentView === 'chat' && selectedContact && showSidebar && (
                      <div className="w-80 border-l border-slate-700 flex-shrink-0">
                        <SettingsSidebar
                          contact={selectedContact}
                          onSave={handleSaveContact}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Mobile Layout */}
              {isMobile && (
                <div className="flex-1 flex flex-col">
                  {/* Mobile content based on current view */}
                  {currentView === 'dashboard' && (
                    <>
                      {mobileView === 'contacts' && (
                        <div className="flex-1">
                          {/* Mobile Contacts Screen */}
                          <div className="h-full bg-glass-bg flex flex-col font-inter">
                            {/* Header */}
                            <div className="bg-glass-panel glass-effect border-b border-slate-700 px-4 py-4 safe-area-top">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h1 className="text-2xl font-bold text-white">Gather</h1>
                                  <div className="flex items-center space-x-2">
                                    <p className="text-sm text-slate-400">Welcome, {user?.email?.split('@')[0]}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Contact List */}
                            <div className="flex-1 overflow-y-auto mobile-scroll">
                              {contacts.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-8">
                                  <div className="text-center">
                                    <div className="text-slate-500 mb-6">
                                      <div className="w-16 h-16 mx-auto mb-4 opacity-50 bg-slate-600 rounded-full"></div>
                                      <p className="text-lg mb-2">No agents yet</p>
                                      <p className="text-sm text-slate-400">Create your first AI agent to get started</p>
                                    </div>
                                    <button
                                      onClick={handleCreateAgent}
                                      className="flex items-center space-x-2 px-6 py-3 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full transition-colors duration-200 mx-auto"
                                    >
                                      <span>Create Agent</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="pb-20">
                                  {contacts.map((contact) => (
                                    <div
                                      key={contact.id}
                                      className="px-4 py-4 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors duration-200 cursor-pointer active:bg-slate-600/30"
                                      onClick={() => handleChatClick(contact)}
                                    >
                                      <div className="flex items-center space-x-4">
                                        <div className="w-14 h-14 rounded-full bg-slate-600"></div>
                                        <div className="flex-1 min-w-0">
                                          <h3 className="text-white font-medium truncate font-inter text-base">{contact.name}</h3>
                                          <p className="text-slate-400 text-sm truncate font-inter">
                                            {contact.description.length > 50 
                                              ? `${contact.description.substring(0, 50)}...` 
                                              : contact.description
                                            }
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {mobileView === 'library' && (
                        <div className="flex-1">
                          <Dashboard
                            contacts={contacts}
                            onChatClick={handleChatClick}
                            onCallClick={handleCallClick}
                            onSettingsClick={handleSettingsClick}
                            onNewChatClick={handleNewChatClick}
                            onCreateAgent={handleCreateAgent}
                            onCreateFromTemplate={handleCreateFromTemplate}
                          />
                        </div>
                      )}

                      {/* Mobile Navigation */}
                      <div className="fixed bottom-0 left-0 right-0 bg-glass-panel glass-effect border-t border-slate-700 px-2 py-2 safe-area-bottom z-50">
                        <div className="flex justify-between items-center max-w-md mx-auto">
                          <button
                            onClick={() => setMobileView('contacts')}
                            className={`flex flex-col items-center justify-center px-6 py-2 rounded-lg transition-colors duration-200 ${
                              mobileView === 'contacts'
                                ? 'text-[#186799] bg-[#186799]/10'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                          >
                            <div className={`w-6 h-6 mb-1 ${mobileView === 'contacts' ? 'text-[#186799]' : ''}`}>💬</div>
                            <span className={`text-xs font-medium ${mobileView === 'contacts' ? 'text-[#186799]' : ''}`}>
                              Chats
                            </span>
                          </button>

                          <button
                            onClick={handleCreateAgent}
                            className="flex flex-col items-center justify-center px-6 py-2 rounded-lg transition-colors duration-200 text-slate-400 hover:text-white hover:bg-slate-700/50"
                          >
                            <div className="w-6 h-6 mb-1">➕</div>
                            <span className="text-xs font-medium">Create</span>
                          </button>

                          <button
                            onClick={() => setMobileView('library')}
                            className={`flex flex-col items-center justify-center px-6 py-2 rounded-lg transition-colors duration-200 ${
                              mobileView === 'library'
                                ? 'text-[#186799] bg-[#186799]/10'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                          >
                            <div className={`w-6 h-6 mb-1 ${mobileView === 'library' ? 'text-[#186799]' : ''}`}>📚</div>
                            <span className={`text-xs font-medium ${mobileView === 'library' ? 'text-[#186799]' : ''}`}>
                              Library
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {currentView === 'chat' && selectedContact && (
                    <ChatScreen
                      contact={selectedContact}
                      messages={messages}
                      conversationDocuments={conversationDocuments}
                      onBack={handleBack}
                      onSendMessage={handleSendMessage}
                      onSettingsClick={handleSettingsClick}
                      onNewChatClick={handleNewChatClick}
                      onCallClick={handleCallClick}
                      showSidebar={false}
                    />
                  )}

                  {currentView === 'call' && selectedContact && (
                    <CallScreen
                      contact={selectedContact}
                      onBack={handleBack}
                      onEndCall={handleBack}
                    />
                  )}

                  {currentView === 'settings' && selectedContact && (
                    <SettingsScreen
                      contact={selectedContact}
                      onBack={handleBack}
                      onSave={handleSaveContact}
                      onDelete={handleDeleteContact}
                    />
                  )}

                  {currentView === 'create-agent' && (
                    <SettingsScreen
                      contact={{
                        id: 'new',
                        name: templateForCreation?.name || '',
                        description: templateForCreation?.description || '',
                        initials: templateForCreation?.name ? templateForCreation.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) : 'AI',
                        color: templateForCreation?.default_color || '#3b82f6',
                        voice: templateForCreation?.default_voice || 'Puck',
                        avatar: templateForCreation?.default_avatar_url,
                        status: 'online',
                        lastSeen: 'now',
                        personalityPrompt: templateForCreation?.personality_traits?.join(', '),
                        systemInstructions: templateForCreation?.capabilities?.join(', '),
                        customSettings: {},
                        folder: templateForCreation?.category,
                        tags: templateForCreation?.tags || [],
                        isFavorite: false,
                        sortOrder: 0,
                        totalConversations: 0,
                        total_messages: 0,
                        documents: [],
                        integrations: templateForCreation?.suggested_integrations?.map(integrationId => ({
                          id: `temp-${Date.now()}-${integrationId}`,
                          integrationId,
                          name: `${getIntegrationById(integrationId)?.name || 'Integration'} - ${templateForCreation.name}`,
                          config: {
                            integrationId,
                            enabled: true,
                            settings: {},
                            trigger: 'chat-start',
                            intervalMinutes: 30,
                            description: ''
                          },
                          status: 'active'
                        })) || []
                      }}
                      onBack={handleBack}
                      onSave={async (contact) => {
                        try {
                          console.log('Creating new agent:', contact);

                          const { data: newAgent, error } = await supabase
                            .from('user_agents')
                            .insert({
                              user_id: user.id,
                              name: contact.name,
                              description: contact.description,
                              initials: contact.initials,
                              color: contact.color,
                              voice: contact.voice,
                              avatar_url: contact.avatar,
                              status: 'online',
                              last_seen: 'now',
                              personality_prompt: contact.personalityPrompt,
                              system_instructions: contact.systemInstructions,
                              custom_settings: contact.customSettings || {},
                              folder: contact.folder,
                              tags: contact.tags || [],
                              is_favorite: contact.isFavorite || false,
                              sort_order: contact.sortOrder || 0,
                              total_conversations: 0,
                              total_messages: 0
                            })
                            .select()
                            .single();

                          if (error) {
                            console.error('Error creating agent:', error);
                            return;
                          }

                          console.log('Agent created successfully:', newAgent);

                          // Create integrations if any
                          if (contact.integrations && contact.integrations.length > 0) {
                            for (const integration of contact.integrations) {
                              const { error: integrationError } = await supabase
                                .from('agent_integrations')
                                .insert({
                                  agent_id: newAgent.id,
                                  template_id: integration.integrationId,
                                  name: integration.name,
                                  description: integration.config.description,
                                  config: integration.config.settings,
                                  trigger_type: integration.config.trigger,
                                  interval_minutes: integration.config.intervalMinutes,
                                  status: 'active'
                                });

                              if (integrationError) {
                                console.error('Error creating integration:', integrationError);
                              }
                            }
                          }

                          // Reload agents and go back to dashboard
                          await loadUserAgents();
                          setCurrentView('dashboard');
                        } catch (error) {
                          console.error('Error creating agent:', error);
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          } />
        </Routes>
      </Router>
    );
  }

  // Show auth flow for non-authenticated users
  return (
    <Router>
      <Routes>
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/*" element={
          <>
            {currentView === 'landing' && (
              <LandingPage 
                onGetStarted={handleGetStarted}
                onSignUp={handleSignUp}
              />
            )}
            {currentView === 'signup' && (
              <SignupPage 
                onSuccess={handleAuthSuccess}
                onBackToLanding={handleBackToLanding}
                onSignIn={handleSignIn}
              />
            )}
            {currentView === 'signin' && (
              <AuthScreen 
                onSuccess={handleAuthSuccess}
                onBackToLanding={handleBackToLanding}
                onSignUp={handleSignUp}
              />
            )}
            {currentView === 'pricing' && (
              <PricingPage 
                onSelectPlan={handleSelectPlan}
                onStayFree={handleStayFree}
              />
            )}
          </>
        } />
      </Routes>
    </Router>
  );
}