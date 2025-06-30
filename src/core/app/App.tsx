import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../modules/auth/hooks/useAuth";
import { getIntegrationById } from "../../modules/integrations/data/integrations";
import { supabase } from "../../modules/database/lib/supabase";
import { integrationsService } from "../../modules/integrations/core/integrationsService";
import { useMobile, useLocalStorage } from "../hooks/useLocalStorage";

// Import components
import AuthScreen from "../../modules/auth/components/AuthScreen";
import { ChatScreen } from "../../modules/chat";
import { CallScreen } from "../../modules/voice";
import { Dashboard, ContactSidebar, SettingsSidebar, SettingsScreen, MobileContactsScreen, MobileLibraryScreen, MobileNavigation } from "../../modules/ui";
import LandingPage from "../../components/LandingPage";
import SignupPage from "../../components/SignupPage";
import PricingPage from "../../components/PricingPage";
import SuccessPage from "../../components/SuccessPage";
import OAuthCallback from "../../modules/oauth/components/OAuthCallback";

// Import types
import { AIContact, Message } from "../types/types";
import { DocumentInfo } from "../../modules/fileManagement/types/documents";
import { IntegrationInstance } from "../../modules/integrations/types/integrations";

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
  const { user, loading: authLoading, signUp, signIn, signOut } = useAuth();
  const isMobile = useMobile();
  
  // App state
  const [appState, setAppState] = useState<'landing' | 'signup' | 'signin' | 'pricing' | 'app'>('landing');
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [currentContact, setCurrentContact] = useState<AIContact | null>(null);
  const [currentView, setCurrentView] = useLocalStorage<'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent' | 'contacts' | 'library'>('currentView', isMobile ? 'library' : 'dashboard');
  const [mobileView, setMobileView] = useLocalStorage<'contacts' | 'library'>('mobileView', 'library');
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(true);
  const [templateForCreation, setTemplateForCreation] = useState<AgentTemplate | null>(null);

  // Load user agents on app start
  useEffect(() => {
    if (user && appState === 'app') {
      loadUserAgents();
    }
  }, [user, appState]);

  // Auto-execute integrations when starting a chat
  useEffect(() => {
    const executeIntegrationsOnChatStart = async () => {
      if (currentView === 'chat' && currentContact) {
        const integrations = currentContact.integrations || [];
        
        for (const integrationInstance of integrations) {
          const integration = getIntegrationById(integrationInstance.integrationId);
          if (integration && 
              integrationInstance.status === 'active' &&
              (integrationInstance.config.trigger === 'chat-start' || integrationInstance.config.trigger === 'both')) {
            try {
              const data = await integrationsService.executeIntegration(integration, integrationInstance.config);
              integrationsService.storeIntegrationData(currentContact.id, integration.id, data, `Data from ${integration.name}`);
            } catch (error) {
              console.error(`Failed to execute integration ${integration.name}:`, error);
            }
          }
        }
      }
    };

    executeIntegrationsOnChatStart();
  }, [currentView, currentContact]);

  const loadUserAgents = async () => {
    try {
      console.log('Loading user agents...');
      const { data, error } = await supabase
        .from('user_agents')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user agents:', error);
        return;
      }

      const formattedContacts: AIContact[] = (data || []).map(agent => ({
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
        totalMessages: agent.total_messages,
        lastUsedAt: agent.last_used_at ? new Date(agent.last_used_at) : undefined,
        integrations: [], // Will be loaded separately if needed
        documents: [] // Will be loaded separately if needed
      }));

      setContacts(formattedContacts);
      console.log(`Loaded ${formattedContacts.length} user agents`);
    } catch (error) {
      console.error('Error loading user agents:', error);
    }
  };

  const handleCreateAgent = () => {
    setTemplateForCreation(null); // Clear any template
    setCurrentView('create-agent');
    // Always show settings sidebar during agent creation
    setShowSettingsSidebar(true);
  };

  const handleCreateFromTemplate = (template: AgentTemplate) => {
    setTemplateForCreation(template);
    setCurrentView('create-agent');
    // Always show settings sidebar during agent creation
    setShowSettingsSidebar(true);
  };

  const handleSaveAgent = async (agent: AIContact) => {
    try {
      console.log('Saving agent:', agent);

      const agentData = {
        user_id: user?.id,
        name: agent.name,
        description: agent.description,
        initials: agent.initials,
        color: agent.color,
        voice: agent.voice,
        avatar_url: agent.avatar,
        status: agent.status || 'online',
        last_seen: agent.lastSeen || 'now',
        personality_prompt: agent.personalityPrompt,
        system_instructions: agent.systemInstructions,
        custom_settings: agent.customSettings || {},
        folder: agent.folder,
        tags: agent.tags || [],
        is_favorite: agent.isFavorite || false,
        sort_order: agent.sortOrder || 0,
        total_conversations: agent.totalConversations || 0,
        total_messages: agent.totalMessages || 0,
        last_used_at: agent.lastUsedAt?.toISOString(),
        updated_at: new Date().toISOString()
      };

      let savedAgent;
      if (agent.id && agent.id !== 'temp') {
        // Update existing agent
        const { data, error } = await supabase
          .from('user_agents')
          .update(agentData)
          .eq('id', agent.id)
          .select()
          .single();

        if (error) throw error;
        savedAgent = data;
      } else {
        // Create new agent
        const { data, error } = await supabase
          .from('user_agents')
          .insert(agentData)
          .select()
          .single();

        if (error) throw error;
        savedAgent = data;
      }

      // Update local state
      const updatedAgent: AIContact = {
        ...agent,
        id: savedAgent.id
      };

      if (agent.id && agent.id !== 'temp') {
        setContacts(prev => prev.map(c => c.id === agent.id ? updatedAgent : c));
      } else {
        setContacts(prev => [...prev, updatedAgent]);
      }

      // Clear template and go back to dashboard
      setTemplateForCreation(null);
      setCurrentView(isMobile ? 'library' : 'dashboard');
      console.log('Agent saved successfully');
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('Failed to save agent. Please try again.');
    }
  };

  const handleDeleteAgent = (agentId: string) => {
    setContacts(prev => prev.filter(c => c.id !== agentId));
    if (currentContact?.id === agentId) {
      setCurrentContact(null);
      setCurrentView(isMobile ? 'library' : 'dashboard');
    }
  };

  const handleChatClick = (contact: AIContact) => {
    setCurrentContact(contact);
    setCurrentView('chat');
    setMessages([]); // Clear previous messages
    setConversationDocuments([]); // Clear previous conversation documents
    // Don't force settings sidebar open for chat
  };

  const handleCallClick = (contact: AIContact) => {
    setCurrentContact(contact);
    setCurrentView('call');
    // Don't force settings sidebar open for call
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setCurrentContact(contact);
    }
    setCurrentView('settings');
    // Don't force settings sidebar open for settings (it has its own layout)
  };

  const handleNewChatClick = (contact: AIContact) => {
    setCurrentContact(contact);
    setMessages([]); // Clear messages for new chat
    setConversationDocuments([]); // Clear conversation documents for new chat
    setCurrentView('chat');
    // Don't force settings sidebar open for new chat
  };

  const handleSendMessage = (content: string, documents?: DocumentInfo[]) => {
    if (!currentContact) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: currentContact.id,
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
        content: `I understand you're asking about "${content}". Let me help you with that. I have access to ${conversationDocuments.length + (documents?.length || 0)} documents in our conversation and ${currentContact.documents?.length || 0} permanent documents to provide you with accurate information.`,
        sender: 'ai',
        timestamp: new Date(),
        contactId: currentContact.id
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleBackToDashboard = () => {
    setCurrentContact(null);
    setCurrentView(isMobile ? 'library' : 'dashboard');
    // Don't change settings sidebar state when going back
  };

  const handleToggleSidebar = () => {
    setShowSettingsSidebar(prev => !prev);
  };

  // Handle authentication state changes
  useEffect(() => {
    if (authLoading) return;
    
    if (user) {
      setAppState('app');
    } else {
      setAppState('landing');
    }
  }, [user, authLoading]);

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screens if not authenticated
  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/pricing" element={
            <PricingPage 
              onSelectPlan={(plan) => console.log('Selected plan:', plan)}
              onStayFree={() => setAppState('app')}
            />
          } />
          <Route path="/*" element={
            <>
              {appState === 'landing' && (
                <LandingPage 
                  onGetStarted={() => setAppState('signup')}
                  onSignUp={() => setAppState('signup')}
                />
              )}
              {appState === 'signup' && (
                <SignupPage 
                  onSuccess={() => setAppState('app')}
                  onBackToLanding={() => setAppState('landing')}
                  onSignIn={() => setAppState('signin')}
                />
              )}
              {appState === 'signin' && (
                <AuthScreen 
                  onSuccess={() => setAppState('app')}
                  onBackToLanding={() => setAppState('landing')}
                  onSignUp={() => setAppState('signup')}
                />
              )}
            </>
          } />
        </Routes>
      </Router>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-screen bg-glass-bg flex flex-col">
        {currentView === 'chat' && currentContact ? (
          <ChatScreen
            contact={currentContact}
            messages={messages}
            conversationDocuments={conversationDocuments}
            onBack={() => setCurrentView('contacts')}
            onSendMessage={handleSendMessage}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCallClick={handleCallClick}
            showSidebar={false}
          />
        ) : currentView === 'call' && currentContact ? (
          <CallScreen
            contact={currentContact}
            onBack={() => setCurrentView('contacts')}
            onEndCall={() => setCurrentView('contacts')}
          />
        ) : currentView === 'settings' && currentContact ? (
          <SettingsScreen
            contact={currentContact}
            onBack={() => setCurrentView('contacts')}
            onSave={handleSaveAgent}
            onDelete={handleDeleteAgent}
          />
        ) : currentView === 'create-agent' ? (
          <SettingsScreen
            contact={{
              id: 'temp',
              name: templateForCreation?.name || '',
              description: templateForCreation?.description || '',
              initials: templateForCreation?.name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
              color: templateForCreation?.default_color || '#3b82f6',
              voice: templateForCreation?.default_voice || 'Puck',
              avatar: templateForCreation?.default_avatar_url,
              status: 'online',
              lastSeen: 'now',
              personalityPrompt: templateForCreation?.personality_traits?.join(', '),
              systemInstructions: templateForCreation?.capabilities?.join(', '),
              folder: templateForCreation?.category,
              tags: templateForCreation?.tags || [],
              integrations: templateForCreation?.suggested_integrations?.map(integrationId => {
                const integration = getIntegrationById(integrationId);
                if (!integration) return null;
                return {
                  id: Date.now().toString() + Math.random(),
                  integrationId,
                  name: `${integration.name} - ${templateForCreation.name}`,
                  config: {
                    integrationId,
                    enabled: true,
                    settings: {},
                    trigger: 'chat-start',
                    intervalMinutes: 30,
                    description: `Auto-configured from ${templateForCreation.name} template`
                  },
                  status: 'active'
                } as IntegrationInstance;
              }).filter(Boolean) as IntegrationInstance[]
            }}
            onBack={() => setCurrentView('library')}
            onSave={handleSaveAgent}
          />
        ) : (
          <>
            {mobileView === 'contacts' ? (
              <MobileContactsScreen
                contacts={contacts}
                onChatClick={handleChatClick}
                onCallClick={handleCallClick}
                onCreateAgent={handleCreateAgent}
              />
            ) : (
              <MobileLibraryScreen
                contacts={contacts}
                onChatClick={handleChatClick}
                onCallClick={handleCallClick}
                onSettingsClick={handleSettingsClick}
                onCreateAgent={handleCreateAgent}
              />
            )}
            <MobileNavigation
              currentView={mobileView}
              onViewChange={setMobileView}
              onCreateAgent={handleCreateAgent}
            />
          </>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/*" element={
          <div className="h-screen bg-glass-bg flex">
            {/* Left Sidebar - Contacts */}
            <div className="w-80 border-r border-slate-700 flex-shrink-0">
              <ContactSidebar
                contacts={contacts}
                onChatClick={handleChatClick}
                onCallClick={handleCallClick}
                onSettingsClick={handleSettingsClick}
                onHomeClick={handleBackToDashboard}
                onCreateAgent={handleCreateAgent}
              />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex">
              <div className={`${showSettingsSidebar ? 'flex-1' : 'w-full'} transition-all duration-300`}>
                {currentView === 'dashboard' ? (
                  <Dashboard
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCreateAgent={handleCreateAgent}
                    onCreateFromTemplate={handleCreateFromTemplate}
                  />
                ) : currentView === 'chat' && currentContact ? (
                  <ChatScreen
                    contact={currentContact}
                    messages={messages}
                    conversationDocuments={conversationDocuments}
                    onBack={handleBackToDashboard}
                    onSendMessage={handleSendMessage}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCallClick={handleCallClick}
                    showSidebar={showSettingsSidebar}
                    onToggleSidebar={handleToggleSidebar}
                  />
                ) : currentView === 'call' && currentContact ? (
                  <CallScreen
                    contact={currentContact}
                    onBack={handleBackToDashboard}
                    onEndCall={handleBackToDashboard}
                  />
                ) : currentView === 'settings' && currentContact ? (
                  <SettingsScreen
                    contact={currentContact}
                    onBack={handleBackToDashboard}
                    onSave={handleSaveAgent}
                    onDelete={handleDeleteAgent}
                  />
                ) : currentView === 'create-agent' ? (
                  <SettingsScreen
                    contact={{
                      id: 'temp',
                      name: templateForCreation?.name || '',
                      description: templateForCreation?.description || '',
                      initials: templateForCreation?.name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
                      color: templateForCreation?.default_color || '#3b82f6',
                      voice: templateForCreation?.default_voice || 'Puck',
                      avatar: templateForCreation?.default_avatar_url,
                      status: 'online',
                      lastSeen: 'now',
                      personalityPrompt: templateForCreation?.personality_traits?.join(', '),
                      systemInstructions: templateForCreation?.capabilities?.join(', '),
                      folder: templateForCreation?.category,
                      tags: templateForCreation?.tags || [],
                      integrations: templateForCreation?.suggested_integrations?.map(integrationId => {
                        const integration = getIntegrationById(integrationId);
                        if (!integration) return null;
                        return {
                          id: Date.now().toString() + Math.random(),
                          integrationId,
                          name: `${integration.name} - ${templateForCreation.name}`,
                          config: {
                            integrationId,
                            enabled: true,
                            settings: {},
                            trigger: 'chat-start',
                            intervalMinutes: 30,
                            description: `Auto-configured from ${templateForCreation.name} template`
                          },
                          status: 'active'
                        } as IntegrationInstance;
                      }).filter(Boolean) as IntegrationInstance[]
                    }}
                    onBack={handleBackToDashboard}
                    onSave={handleSaveAgent}
                  />
                ) : (
                  <Dashboard
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCreateAgent={handleCreateAgent}
                    onCreateFromTemplate={handleCreateFromTemplate}
                  />
                )}
              </div>

              {/* Right Sidebar - Settings (only show during agent creation) */}
              {showSettingsSidebar && currentView === 'create-agent' && (
                <div className="w-80 border-l border-slate-700 flex-shrink-0">
                  <SettingsSidebar
                    contact={currentContact}
                    onSave={handleSaveAgent}
                    onClose={() => setShowSettingsSidebar(false)}
                  />
                </div>
              )}
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}