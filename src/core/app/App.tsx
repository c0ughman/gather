import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import { geminiLiveService } from '../../modules/voice';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import { Dashboard, ContactSidebar, SettingsSidebar, SettingsScreen, MobileContactsScreen, MobileLibraryScreen, MobileNavigation } from '../../modules/ui';
import { ChatScreen } from '../../modules/chat';
import { AIContact, Message, CallState } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { documentContextService } from '../../modules/fileManagement/services/documentContextService';
import { geminiService } from '../../modules/fileManagement/services/geminiService';
import { supabaseService } from '../../modules/database/services/supabaseService';
import { integrationsService, getIntegrationById } from '../../modules/integrations';
import { useLocalStorage, useMobile } from '../hooks/useLocalStorage';
import { SubscriptionBadge, ManageSubscriptionButton } from '../../modules/payments';

type ViewType = 'landing' | 'signup' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent' | 'success' | 'login';
type MobileViewType = 'contacts' | 'library';

export default function App() {
  const { user, loading } = useAuth();
  const isMobile = useMobile();
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [mobileView, setMobileView] = useState<MobileViewType>('contacts');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [templateToCreate, setTemplateToCreate] = useState<AgentTemplate | null>(null);

  // Load user's agents from Supabase
  useEffect(() => {
    if (user) {
      loadUserAgents();
    }
  }, [user]);

  const loadUserAgents = async () => {
    if (!user) return;

    try {
      console.log('Loading user agents from Supabase...');
      const { data, error } = await supabase
        .from('user_agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user agents:', error);
        return;
      }

      console.log(`Loaded ${data?.length || 0} agents from Supabase`);

      // Transform Supabase data to AIContact format
      const transformedContacts: AIContact[] = (data || []).map(agent => ({
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
        createdAt: new Date(agent.created_at),
        updatedAt: new Date(agent.updated_at),
        // These will be loaded separately if needed
        integrations: undefined,
        documents: undefined
      }));

      setContacts(transformedContacts);
    } catch (error) {
      console.error('Error loading user agents:', error);
    }
  };

  const handleCreateFromTemplate = (template: AgentTemplate) => {
    console.log('Creating agent from template:', template.name);
    setTemplateToCreate(template);
    setIsCreatingAgent(true);
    setCurrentView('create-agent');
  };

  const handleCreateAgent = () => {
    console.log('Creating new agent from scratch');
    setTemplateToCreate(null);
    setIsCreatingAgent(true);
    setCurrentView('create-agent');
  };

  const handleSaveAgent = async (contact: AIContact) => {
    try {
      console.log('Saving agent:', contact.name);

      if (isCreatingAgent) {
        // Create new agent in Supabase
        const { data, error } = await supabase
          .from('user_agents')
          .insert({
            user_id: user?.id,
            template_id: templateToCreate?.id || null,
            name: contact.name,
            description: contact.description,
            initials: contact.initials,
            color: contact.color,
            voice: contact.voice,
            avatar_url: contact.avatar,
            status: contact.status || 'online',
            last_seen: contact.lastSeen || 'now',
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
          alert('Failed to create agent. Please try again.');
          return;
        }

        console.log('Agent created successfully:', data);

        // Add to local state
        const newContact: AIContact = {
          ...contact,
          id: data.id,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        };

        setContacts(prev => [newContact, ...prev]);
        setIsCreatingAgent(false);
        setTemplateToCreate(null);
        setCurrentView('dashboard');
      } else {
        // Update existing agent in Supabase
        const { error } = await supabase
          .from('user_agents')
          .update({
            name: contact.name,
            description: contact.description,
            initials: contact.initials,
            color: contact.color,
            voice: contact.voice,
            avatar_url: contact.avatar,
            personality_prompt: contact.personalityPrompt,
            system_instructions: contact.systemInstructions,
            custom_settings: contact.customSettings || {},
            folder: contact.folder,
            tags: contact.tags || [],
            is_favorite: contact.isFavorite || false,
            sort_order: contact.sortOrder || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id);

        if (error) {
          console.error('Error updating agent:', error);
          alert('Failed to update agent. Please try again.');
          return;
        }

        console.log('Agent updated successfully');

        // Update local state
        setContacts(prev => prev.map(c => c.id === contact.id ? contact : c));
        setSelectedContact(contact);
      }
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const handleDeleteAgent = async (contactId: string) => {
    try {
      console.log('Deleting agent from App:', contactId);
      
      // Remove from local state
      setContacts(prev => prev.filter(c => c.id !== contactId));
      
      // Clear selected contact if it was the deleted one
      if (selectedContact?.id === contactId) {
        setSelectedContact(null);
      }
      
      // Navigate back to dashboard
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Error handling agent deletion:', error);
    }
  };

  const handleChatClick = async (contact: AIContact) => {
    setSelectedContact(contact);
    setMessages([]); // Reset messages for new conversation
    setConversationDocuments([]); // Reset conversation documents
    setCurrentView('chat');
    
    // Load conversation documents for this contact
    const contactMessages = messages.filter(m => m.contactId === contact.id);
    const allAttachments = contactMessages.flatMap(m => m.attachments || []);
    setConversationDocuments(prev => ({
      ...prev,
      [contact.id]: allAttachments
    }));

    // Execute integrations on chat start if configured
    if (contact.integrations) {
      for (const integrationInstance of contact.integrations) {
        const integration = getIntegrationById(integrationInstance.integrationId);
        if (integration && 
            integration.category !== 'action' &&
            integrationInstance.config.enabled && 
            (integrationInstance.config.trigger === 'chat-start' || integrationInstance.config.trigger === 'both')) {
          try {
            const data = await integrationsService.executeIntegration(integration, integrationInstance.config);
            integrationsService.storeIntegrationData(contact.id, integration.id, data, `Data from ${integration.name}`);
          } catch (error) {
            console.error(`Failed to execute integration ${integration.name}:`, error);
          }
        }
      }
    }
  };

  const handleCallClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('call');
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
      setCurrentView('settings');
    } else {
      // Global settings
      setSelectedContact(null);
      setCurrentView('settings');
    }
  };

  const handleHomeClick = () => {
    if (isMobile) {
      setMobileView('library');
    } else {
      setCurrentView('dashboard');
    }
    setSelectedContact(null);
  };

  const handleCreateAgent = () => {
    setCurrentView('create-agent');
  };

  // Mobile-specific handlers
  const handleMobileViewChange = (view: MobileViewType) => {
    setMobileView(view);
    if (view === 'contacts') {
      setCurrentView('dashboard'); // Reset to dashboard view
    } else if (view === 'library') {
      setCurrentView('dashboard');
    }
    setSelectedContact(null);
  };

  const handleMobileChatClick = (contact: AIContact) => {
    handleChatClick(contact); // Use existing chat logic
  };

  const handleMobileBack = () => {
    console.log('🔙 Mobile back clicked, current view:', currentView, 'mobile view:', mobileView);
    if (currentView === 'call') {
      // From call, go back to chat with the same contact
      console.log('📞→💬 Going from call to chat');
      setCurrentView('chat');
    } else if (currentView === 'chat' || currentView === 'settings' || currentView === 'create-agent') {
      // From chat, settings, or create-agent, go back to contacts
      console.log('💬→📱 Going from chat/settings/create-agent to contacts');
      setMobileView('contacts');
      setCurrentView('dashboard');
      setSelectedContact(null);
    }
  };

  const handleToggleSidebar = () => {
    setShowSidebar(prev => !prev);
  };

  const handleSendMessage = (content: string, documents?: DocumentInfo[]) => {
    if (!selectedContact) return;

    // Add user message
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
        content: `I understand you're asking about "${content}". Let me help you with that. ${documents && documents.length > 0 ? `I can see you've shared ${documents.length} document${documents.length > 1 ? 's' : ''} with me, which I'll reference in my response.` : ''}`,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleBack = () => {
    if (isCreatingAgent) {
      setIsCreatingAgent(false);
      setTemplateToCreate(null);
    }
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show public pages
  if (!user) {
    if (currentView === 'signup') {
      return <SignupPage onSuccess={handleSignupSuccess} onBackToLanding={handleBackToLanding} onSignIn={handleSignIn} />;
    } else if (currentView === 'login') {
      return <AuthScreen />;
    } else {
      return <LandingPage onGetStarted={handleGetStarted} onSignUp={handleSignUp} />;
    }
  }

  // Show pricing page after signup
  if (currentView === 'pricing') {
    return <PricingPage onSelectPlan={handleSelectPlan} onStayFree={handleStayFree} />;
  }

  // Get messages for selected contact
  const contactMessages = selectedContact 
    ? messages.filter(msg => msg.contactId === selectedContact.id)
    : [];

  // Get conversation documents for selected contact
  const contactConversationDocuments = selectedContact 
    ? conversationDocuments[selectedContact.id] || []
    : [];

  // If authenticated, show the main app
  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="*" element={
          <div className="h-screen bg-glass-bg">
            {/* OAuth Success/Error Message */}
            {oauthMessage && (
              <div className="fixed top-4 right-4 z-50 max-w-md">
                <div className={`p-4 rounded-lg border ${
                  oauthMessage.includes('✅') 
                    ? 'bg-green-900 bg-opacity-90 border-green-700 text-green-300' 
                    : 'bg-red-900 bg-opacity-90 border-red-700 text-red-300'
                } backdrop-blur-sm`}>
                  <p className="text-sm font-medium">{oauthMessage}</p>
                </div>
              </div>
            )}

            {isMobile ? (
              /* MOBILE LAYOUT */
              <div className="h-full flex flex-col">
                {currentView === 'chat' && selectedContact ? (
                  /* Mobile Chat Screen */
                  <ChatScreen
                    contact={selectedContact}
                    messages={contactMessages}
                    conversationDocuments={contactConversationDocuments}
                    onBack={handleMobileBack}
                    onSendMessage={handleSendMessage}
                    onSettingsClick={handleSettingsClick}
                    onNewChatClick={handleNewChatClick}
                    onCallClick={handleCallClick}
                    showSidebar={false}
                  />
                ) : currentView === 'call' && selectedContact ? (
                  /* Mobile Call Screen */
                  <CallScreen
                    contact={selectedContact}
                    callState={callState}
                    onBack={handleMobileBack}
                    onEndCall={handleEndCall}
                    onToggleMute={handleToggleMute}
                    showSidebar={false}
                  />
                ) : currentView === 'settings' && selectedContact ? (
                  /* Mobile Settings Screen */
                  <SettingsScreen
                    contact={selectedContact}
                    onBack={handleMobileBack}
                    onSave={handleSaveContact}
                  />
                ) : currentView === 'create-agent' ? (
                  /* Mobile Create Agent Screen */
                  <SettingsScreen
                    contact={{
                      id: `temp_${Date.now()}`,
                      name: 'New AI Assistant',
                      description: 'A helpful AI assistant ready to be customized.',
                      initials: 'AI',
                      color: '#3b82f6',
                      status: 'online',
                      lastSeen: 'now',
                      voice: 'Puck'
                    }}
                    onBack={handleMobileBack}
                    onSave={(contact) => {
                      handleSaveContact(contact);
                      setCurrentView('dashboard');
                      setMobileView('contacts');
                    }}
                  />
                ) : (
                  /* Mobile Main Views */
                  <>
                    <div className="flex-1 overflow-hidden">
                      {mobileView === 'contacts' && (
                        <MobileContactsScreen
                          contacts={contacts}
                          onChatClick={handleMobileChatClick}
                          onCallClick={handleCallClick}
                          onCreateAgent={handleCreateAgent}
                        />
                      )}
                      
                      {mobileView === 'library' && (
                        <MobileLibraryScreen
                          contacts={contacts}
                          onChatClick={handleMobileChatClick}
                          onCallClick={handleCallClick}
                          onSettingsClick={handleSettingsClick}
                          onCreateAgent={handleCreateAgent}
                        />
                      )}
                      

                    </div>
                    
                    {/* Mobile Bottom Navigation */}
                    <MobileNavigation
                      currentView={mobileView}
                      onViewChange={handleMobileViewChange}
                      onCreateAgent={handleCreateAgent}
                    />
                  </>
                )}
              </div>
            ) : (
              /* DESKTOP LAYOUT */
              <div className="h-screen flex">
                {/* Left Sidebar - Contacts */}
                <div className="w-80 border-r border-slate-700">
                  <ContactSidebar
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onHomeClick={handleHomeClick}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex">
                  <div className="flex-1">
                    {currentView === 'dashboard' && (
                      <Dashboard
                        contacts={contacts}
                        onChatClick={handleChatClick}
                        onCallClick={handleCallClick}
                        onSettingsClick={handleSettingsClick}
                        onNewChatClick={handleNewChatClick}
                        onCreateAgent={handleCreateAgent}
                      />
                    )}
                    
                    {currentView === 'chat' && selectedContact && (
                      <ChatScreen
                        contact={selectedContact}
                        messages={contactMessages}
                        conversationDocuments={contactConversationDocuments}
                        onBack={handleBack}
                        onSendMessage={handleSendMessage}
                        onSettingsClick={handleSettingsClick}
                        onNewChatClick={handleNewChatClick}
                        onCallClick={handleCallClick}
                        showSidebar={showSidebar}
                        onToggleSidebar={handleToggleSidebar}
                      />
                    )}
                    
                    {currentView === 'call' && selectedContact && (
                      <CallScreen
                        contact={selectedContact}
                        callState={callState}
                        onBack={handleBack}
                        onEndCall={handleEndCall}
                        onToggleMute={handleToggleMute}
                        showSidebar={showSidebar}
                        onToggleSidebar={handleToggleSidebar}
                      />
                    )}
                    
                    {currentView === 'settings' && selectedContact && (
                      <SettingsScreen
                        contact={selectedContact}
                        onBack={handleBack}
                        onSave={handleSaveContact}
                      />
                    )}
                    
                    {currentView === 'create-agent' && (
                      <SettingsScreen
                        contact={{
                          id: `temp_${Date.now()}`,
                          name: 'New AI Assistant',
                          description: 'A helpful AI assistant ready to be customized.',
                          initials: 'AI',
                          color: '#3b82f6',
                          status: 'online',
                          lastSeen: 'now',
                          voice: 'Puck'
                        }}
                        onBack={handleBack}
                        onSave={(contact) => {
                          handleSaveContact(contact);
                          setCurrentView('dashboard');
                        }}
                      />
                    )}
                  </div>

                  {/* Right Sidebar - Settings (when in chat or call view) */}
                  {(currentView === 'chat' || currentView === 'call') && showSidebar && (
                    <div className="w-80 border-l border-slate-700">
                      <SettingsSidebar
                        contact={selectedContact}
                        onSave={handleSaveContact}
                        onClose={handleToggleSidebar}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}