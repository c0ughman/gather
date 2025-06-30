import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AIContact, Message } from '../types/types';
import { Dashboard, ContactSidebar, SettingsSidebar, SettingsScreen } from '../../modules/ui';
import { ChatScreen } from '../../modules/chat';
import { CallScreen } from '../../modules/voice';
import { AuthScreen } from '../../modules/auth';
import { OAuthCallback } from '../../modules/oauth';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import { supabase } from '../../modules/database/lib/supabase';
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { IntegrationInstance } from '../../modules/integrations/types/integrations';
import { useMobile } from '../hooks/useLocalStorage';
import { MobileContactsScreen, MobileLibraryScreen, MobileNavigation } from '../../modules/ui';

type ViewType = 'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent';

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
  const { user, loading: authLoading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'contacts' | 'library'>('library');
  
  // Agent creation state
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [newAgentData, setNewAgentData] = useState<Partial<AIContact> | null>(null);

  const isMobile = useMobile();

  // Load user agents on mount and when user changes
  useEffect(() => {
    if (user) {
      loadUserAgents();
      // Start with dashboard view when user is authenticated
      if (currentView === 'landing' || currentView === 'signup' || currentView === 'signin') {
        setCurrentView('dashboard');
      }
    } else if (!authLoading) {
      // Only redirect to landing if auth is not loading
      setCurrentView('landing');
      setContacts([]);
      setMessages([]);
      setSelectedContact(null);
    }
  }, [user, authLoading]);

  const loadUserAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading user agents...');

      const { data, error } = await supabase
        .from('user_agents')
        .select(`
          *,
          conversations:conversations(count)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user agents:', error);
        setError(`Failed to load agents: ${error.message}`);
        return;
      }

      console.log('Raw agents data:', data);

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
        tags: agent.tags || [],
        isFavorite: agent.is_favorite,
        sortOrder: agent.sort_order,
        totalConversations: agent.total_conversations,
        totalMessages: agent.total_messages,
        lastUsedAt: agent.last_used_at ? new Date(agent.last_used_at) : undefined,
        createdAt: new Date(agent.created_at),
        updatedAt: new Date(agent.updated_at),
        // These will be loaded separately when needed
        integrations: [],
        documents: []
      }));

      console.log('Transformed contacts:', transformedContacts);
      setContacts(transformedContacts);
    } catch (error) {
      console.error('Error loading user agents:', error);
      setError('An unexpected error occurred while loading agents');
    } finally {
      setLoading(false);
    }
  };

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

  const handleAuthSuccess = () => {
    setCurrentView('dashboard');
  };

  const handleSelectPlan = (plan: string) => {
    console.log('Selected plan:', plan);
    setCurrentView('dashboard');
  };

  const handleStayFree = () => {
    setCurrentView('dashboard');
  };

  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentView('chat');
    // Load messages for this contact
    loadMessages(contact.id);
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

  const handleBackFromChat = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
    setMessages([]);
    setConversationDocuments([]);
  };

  const handleBackFromCall = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleBackFromSettings = () => {
    if (isCreatingAgent) {
      // If we were creating an agent, go back to dashboard and reset creation state
      setIsCreatingAgent(false);
      setNewAgentData(null);
      setCurrentView('dashboard');
    } else {
      setCurrentView('dashboard');
    }
    setSelectedContact(null);
  };

  const handleHomeClick = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
    setMessages([]);
    setConversationDocuments([]);
  };

  const handleCreateAgent = () => {
    setIsCreatingAgent(true);
    setNewAgentData({
      name: '',
      description: '',
      color: '#3b82f6',
      voice: 'Puck',
      initials: 'AI',
      status: 'online',
      lastSeen: 'now',
      integrations: [],
      documents: [],
      tags: [],
      isFavorite: false,
      sortOrder: 0,
      totalConversations: 0,
      totalMessages: 0
    });
    setCurrentView('settings');
  };

  const handleCreateFromTemplate = async (template: AgentTemplate) => {
    console.log('Creating agent from template:', template);
    
    setIsCreatingAgent(true);
    setNewAgentData({
      name: template.name,
      description: template.description,
      color: template.default_color,
      voice: template.default_voice || 'Puck',
      avatar: template.default_avatar_url,
      initials: template.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
      status: 'online',
      lastSeen: 'now',
      integrations: [],
      documents: [],
      tags: template.tags || [],
      isFavorite: false,
      sortOrder: 0,
      totalConversations: 0,
      totalMessages: 0
    });
    setCurrentView('settings');
  };

  const loadMessages = async (contactId: string) => {
    try {
      console.log('Loading messages for contact:', contactId);
      
      // Get the most recent conversation for this agent
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('agent_id', contactId)
        .eq('user_id', user?.id)
        .order('last_message_at', { ascending: false })
        .limit(1);

      if (convError) {
        console.error('Error loading conversations:', convError);
        return;
      }

      if (!conversations || conversations.length === 0) {
        console.log('No conversations found for this agent');
        setMessages([]);
        setConversationDocuments([]);
        return;
      }

      const conversationId = conversations[0].id;
      console.log('Loading messages for conversation:', conversationId);

      // Load messages for this conversation
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (messagesError) {
        console.error('Error loading messages:', messagesError);
        return;
      }

      const transformedMessages: Message[] = (messagesData || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender as 'user' | 'ai',
        timestamp: new Date(msg.timestamp),
        contactId: contactId
      }));

      console.log('Loaded messages:', transformedMessages);
      setMessages(transformedMessages);

      // TODO: Load conversation documents
      setConversationDocuments([]);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async (content: string, documents?: DocumentInfo[]) => {
    if (!selectedContact || !user) return;

    try {
      console.log('Sending message:', content);
      
      // Add user message immediately
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

      // Simulate AI response (replace with actual AI integration)
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `I understand you said: "${content}". This is a simulated response. In the full implementation, this would be processed by the AI service with access to the agent's knowledge base and integrations.`,
          sender: 'ai',
          timestamp: new Date(),
          contactId: selectedContact.id
        };
        setMessages(prev => [...prev, aiMessage]);
      }, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSaveContact = async (contact: AIContact) => {
    try {
      console.log('Saving contact:', contact);

      if (isCreatingAgent) {
        // Creating a new agent
        const { data, error } = await supabase
          .from('user_agents')
          .insert({
            user_id: user?.id,
            name: contact.name,
            description: contact.description,
            initials: contact.initials,
            color: contact.color,
            voice: contact.voice,
            avatar_url: contact.avatar,
            status: contact.status,
            last_seen: contact.lastSeen,
            personality_prompt: contact.personalityPrompt,
            system_instructions: contact.systemInstructions,
            custom_settings: contact.customSettings || {},
            folder: contact.folder,
            tags: contact.tags || [],
            is_favorite: contact.isFavorite || false,
            sort_order: contact.sortOrder || 0
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating agent:', error);
          alert('Failed to create agent. Please try again.');
          return;
        }

        console.log('Agent created successfully:', data);
        
        // Add to contacts list
        const newContact: AIContact = {
          ...contact,
          id: data.id,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        };
        
        setContacts(prev => [newContact, ...prev]);
        
        // Reset creation state
        setIsCreatingAgent(false);
        setNewAgentData(null);
        setCurrentView('dashboard');
      } else {
        // Updating existing agent
        const { error } = await supabase
          .from('user_agents')
          .update({
            name: contact.name,
            description: contact.description,
            initials: contact.initials,
            color: contact.color,
            voice: contact.voice,
            avatar_url: contact.avatar,
            status: contact.status,
            last_seen: contact.lastSeen,
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
        
        // Update contacts list
        setContacts(prev => prev.map(c => c.id === contact.id ? contact : c));
        setSelectedContact(contact);
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('An unexpected error occurred. Please try again.');
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
        console.error('Error deleting agent:', error);
        alert('Failed to delete agent. Please try again.');
        return;
      }

      console.log('Agent deleted successfully');
      
      // Remove from contacts list
      setContacts(prev => prev.filter(c => c.id !== contactId));
      
      // If this was the selected contact, clear selection
      if (selectedContact?.id === contactId) {
        setSelectedContact(null);
        setCurrentView('dashboard');
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Show loading screen while auth is loading
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

  // Show error if there's an error loading agents
  if (error) {
    return (
      <div className="min-h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-400 mb-4">⚠️</div>
          <h2 className="text-white text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadUserAgents();
            }}
            className="px-4 py-2 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-lg transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/*" element={
          <div className="h-screen bg-glass-bg overflow-hidden">
            {/* Mobile Layout */}
            {isMobile ? (
              <>
                {currentView === 'landing' && (
                  <LandingPage onGetStarted={handleGetStarted} onSignUp={handleSignUp} />
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
                    mode="signin"
                    onSuccess={handleAuthSuccess} 
                    onSwitchMode={() => setCurrentView('signup')}
                    onBackToLanding={handleBackToLanding}
                  />
                )}
                {currentView === 'pricing' && (
                  <PricingPage onSelectPlan={handleSelectPlan} onStayFree={handleStayFree} />
                )}
                {(currentView === 'dashboard' && user) && (
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
                {currentView === 'chat' && selectedContact && (
                  <ChatScreen
                    contact={selectedContact}
                    messages={messages}
                    conversationDocuments={conversationDocuments}
                    onBack={handleBackFromChat}
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
                    onBack={handleBackFromCall}
                  />
                )}
                {currentView === 'settings' && (
                  <SettingsScreen
                    contact={isCreatingAgent && newAgentData ? { ...newAgentData, id: 'new' } as AIContact : selectedContact!}
                    onBack={handleBackFromSettings}
                    onSave={handleSaveContact}
                    onDelete={!isCreatingAgent ? handleDeleteContact : undefined}
                  />
                )}
              </>
            ) : (
              /* Desktop Layout */
              <>
                {currentView === 'landing' && (
                  <LandingPage onGetStarted={handleGetStarted} onSignUp={handleSignUp} />
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
                    mode="signin"
                    onSuccess={handleAuthSuccess} 
                    onSwitchMode={() => setCurrentView('signup')}
                    onBackToLanding={handleBackToLanding}
                  />
                )}
                {currentView === 'pricing' && (
                  <PricingPage onSelectPlan={handleSelectPlan} onStayFree={handleStayFree} />
                )}
                {(currentView === 'dashboard' && user) && (
                  <div className="flex h-full">
                    {/* Left Sidebar - Contacts */}
                    <div className="w-80 border-r border-slate-700 bg-glass-panel glass-effect">
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
                  </div>
                )}
                {currentView === 'chat' && selectedContact && (
                  <div className="flex h-full">
                    {/* Left Sidebar - Contacts */}
                    <div className="w-80 border-r border-slate-700 bg-glass-panel glass-effect">
                      <ContactSidebar
                        contacts={contacts}
                        onChatClick={handleChatClick}
                        onCallClick={handleCallClick}
                        onSettingsClick={handleSettingsClick}
                        onHomeClick={handleHomeClick}
                        onCreateAgent={handleCreateAgent}
                      />
                    </div>
                    
                    {/* Chat Content */}
                    <div className="flex-1">
                      <ChatScreen
                        contact={selectedContact}
                        messages={messages}
                        conversationDocuments={conversationDocuments}
                        onBack={handleBackFromChat}
                        onSendMessage={handleSendMessage}
                        onSettingsClick={handleSettingsClick}
                        onNewChatClick={handleNewChatClick}
                        onCallClick={handleCallClick}
                        showSidebar={showSidebar}
                        onToggleSidebar={toggleSidebar}
                      />
                    </div>
                    
                    {/* Right Sidebar - Settings */}
                    {showSidebar && (
                      <div className="w-80 border-l border-slate-700 bg-glass-panel glass-effect">
                        <SettingsSidebar
                          contact={selectedContact}
                          onSave={handleSaveContact}
                        />
                      </div>
                    )}
                  </div>
                )}
                {currentView === 'call' && selectedContact && (
                  <div className="flex h-full">
                    {/* Left Sidebar - Contacts */}
                    <div className="w-80 border-r border-slate-700 bg-glass-panel glass-effect">
                      <ContactSidebar
                        contacts={contacts}
                        onChatClick={handleChatClick}
                        onCallClick={handleCallClick}
                        onSettingsClick={handleSettingsClick}
                        onHomeClick={handleHomeClick}
                        onCreateAgent={handleCreateAgent}
                      />
                    </div>
                    
                    {/* Call Content */}
                    <div className="flex-1">
                      <CallScreen
                        contact={selectedContact}
                        onBack={handleBackFromCall}
                      />
                    </div>
                  </div>
                )}
                {currentView === 'settings' && (
                  <div className="flex h-full">
                    {/* Left Sidebar - Contacts */}
                    <div className="w-80 border-r border-slate-700 bg-glass-panel glass-effect">
                      <ContactSidebar
                        contacts={contacts}
                        onChatClick={handleChatClick}
                        onCallClick={handleCallClick}
                        onSettingsClick={handleSettingsClick}
                        onHomeClick={handleHomeClick}
                        onCreateAgent={handleCreateAgent}
                      />
                    </div>
                    
                    {/* Settings Content */}
                    <div className="flex-1">
                      <SettingsScreen
                        contact={isCreatingAgent && newAgentData ? { ...newAgentData, id: 'new' } as AIContact : selectedContact!}
                        onBack={handleBackFromSettings}
                        onSave={handleSaveContact}
                        onDelete={!isCreatingAgent ? handleDeleteContact : undefined}
                      />
                    </div>
                    
                    {/* Right Sidebar - Settings (always show during agent creation/editing) */}
                    <div className="w-80 border-l border-slate-700 bg-glass-panel glass-effect">
                      <SettingsSidebar
                        contact={isCreatingAgent && newAgentData ? { ...newAgentData, id: 'new' } as AIContact : selectedContact}
                        onSave={handleSaveContact}
                        onClose={handleBackFromSettings}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}