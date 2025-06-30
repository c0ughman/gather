import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import { ContactSidebar, SettingsSidebar, SettingsScreen, Dashboard } from '../../modules/ui';
import ChatScreen from '../../modules/chat/components/ChatScreen';
import CallScreen from '../../modules/voice/components/CallScreen';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import { AIContact, Message } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { IntegrationInstance } from '../../modules/integrations/types/integrations';
import { supabase } from '../../modules/database/lib/supabase';

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

type AppState = 'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'agent-creation';

export default function App() {
  const { user, loading } = useAuth();
  const [appState, setAppState] = useState<AppState>('landing');
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [currentContact, setCurrentContact] = useState<AIContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<AgentTemplate | null>(null);

  // Load user's agents when authenticated
  useEffect(() => {
    if (user) {
      loadUserAgents();
    } else {
      setContacts([]);
    }
  }, [user]);

  const loadUserAgents = async () => {
    try {
      console.log('Loading user agents...');
      const { data, error } = await supabase
        .from('user_agents')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading agents:', error);
        return;
      }

      const agents: AIContact[] = (data || []).map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        initials: agent.initials,
        color: agent.color,
        voice: agent.voice,
        avatar: agent.avatar_url,
        status: agent.status as 'online' | 'busy' | 'offline',
        lastSeen: agent.last_seen,
        total_messages: agent.total_messages || 0,
        total_conversations: agent.total_conversations || 0,
        last_used_at: agent.last_used_at ? new Date(agent.last_used_at) : undefined,
        // Note: integrations and documents would need separate queries
        integrations: undefined,
        documents: undefined
      }));

      setContacts(agents);
      console.log(`Loaded ${agents.length} agents`);
    } catch (error) {
      console.error('Error loading user agents:', error);
    }
  };

  // Navigation handlers
  const handleGetStarted = () => {
    if (user) {
      setAppState('dashboard');
    } else {
      setAppState('signup');
    }
  };

  const handleSignUp = () => setAppState('signup');
  const handleSignIn = () => setAppState('signin');
  const handleBackToLanding = () => setAppState('landing');
  const handleSelectPlan = () => setAppState('dashboard');
  const handleStayFree = () => setAppState('dashboard');
  const handleAuthSuccess = () => setAppState('dashboard');

  const handleChatClick = (contact: AIContact) => {
    setCurrentContact(contact);
    setMessages([]); // Reset messages for new conversation
    setConversationDocuments([]); // Reset conversation documents
    setAppState('chat');
  };

  const handleCallClick = (contact: AIContact) => {
    setCurrentContact(contact);
    setAppState('call');
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setCurrentContact(contact);
      setAppState('settings');
    }
  };

  const handleNewChatClick = (contact: AIContact) => {
    setCurrentContact(contact);
    setMessages([]); // Clear messages for new chat
    setConversationDocuments([]); // Clear conversation documents
    setAppState('chat');
  };

  const handleCreateAgent = () => {
    setCreatingFromTemplate(null);
    setCurrentContact({
      id: 'new',
      name: '',
      description: '',
      initials: 'AI',
      color: '#3b82f6',
      voice: 'Puck',
      status: 'online',
      lastSeen: 'now',
      total_messages: 0,
      total_conversations: 0
    });
    setAppState('agent-creation');
  };

  const handleCreateFromTemplate = (template: AgentTemplate) => {
    setCreatingFromTemplate(template);
    setCurrentContact({
      id: 'new',
      name: template.name,
      description: template.description,
      initials: template.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
      color: template.default_color,
      voice: template.default_voice,
      avatar: template.default_avatar_url,
      status: 'online',
      lastSeen: 'now',
      total_messages: 0,
      total_conversations: 0
    });
    setAppState('agent-creation');
  };

  const handleSaveAgent = async (contact: AIContact) => {
    try {
      if (contact.id === 'new') {
        // Create new agent
        console.log('Creating new agent:', contact.name);
        
        const agentData = {
          user_id: user?.id,
          name: contact.name,
          description: contact.description,
          initials: contact.initials,
          color: contact.color,
          voice: contact.voice,
          avatar_url: contact.avatar,
          status: contact.status,
          last_seen: contact.lastSeen,
          personality_prompt: null,
          system_instructions: null,
          custom_settings: {},
          folder: null,
          tags: [],
          is_favorite: false,
          sort_order: 0,
          total_conversations: 0,
          total_messages: 0,
          last_used_at: null
        };

        const { data, error } = await supabase
          .from('user_agents')
          .insert([agentData])
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
          id: data.id
        };
        
        setContacts(prev => [newContact, ...prev]);
        setCurrentContact(newContact);
        setAppState('dashboard');
      } else {
        // Update existing agent
        console.log('Updating agent:', contact.id);
        
        const { error } = await supabase
          .from('user_agents')
          .update({
            name: contact.name,
            description: contact.description,
            initials: contact.initials,
            color: contact.color,
            voice: contact.voice,
            avatar_url: contact.avatar,
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
        setCurrentContact(contact);
      }
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const handleDeleteAgent = async (contactId: string) => {
    try {
      console.log('Deleting agent from App:', contactId);
      
      // Remove from contacts list
      setContacts(prev => prev.filter(c => c.id !== contactId));
      
      // If this was the current contact, clear it
      if (currentContact?.id === contactId) {
        setCurrentContact(null);
      }
      
      console.log('Agent removed from UI');
    } catch (error) {
      console.error('Error handling agent deletion:', error);
    }
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
        content: `I understand you're asking about "${content}". Let me help you with that. ${documents && documents.length > 0 ? `I can see you've shared ${documents.length} document(s) which I'll analyze to provide better assistance.` : ''}`,
        sender: 'ai',
        timestamp: new Date(),
        contactId: currentContact.id
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleBack = () => {
    setAppState('dashboard');
    setCurrentContact(null);
  };

  const handleHomeClick = () => {
    setAppState('dashboard');
    setCurrentContact(null);
  };

  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!user && appState === 'landing') {
    return (
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="*" element={
            <LandingPage 
              onGetStarted={handleGetStarted}
              onSignUp={handleSignUp}
            />
          } />
        </Routes>
      </Router>
    );
  }

  // Show signup page
  if (!user && appState === 'signup') {
    return (
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="*" element={
            <SignupPage 
              onSuccess={handleAuthSuccess}
              onBackToLanding={handleBackToLanding}
              onSignIn={handleSignIn}
            />
          } />
        </Routes>
      </Router>
    );
  }

  // Show signin page
  if (!user && appState === 'signin') {
    return (
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="*" element={
            <AuthScreen 
              onSuccess={handleAuthSuccess}
              onBackToLanding={handleBackToLanding}
              onSignUp={handleSignUp}
            />
          } />
        </Routes>
      </Router>
    );
  }

  // Show pricing page
  if (!user && appState === 'pricing') {
    return (
      <Router>
        <Routes>
          <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="*" element={
            <PricingPage 
              onSelectPlan={handleSelectPlan}
              onStayFree={handleStayFree}
            />
          } />
        </Routes>
      </Router>
    );
  }

  // Main app layout for authenticated users
  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="*" element={
          <div className="h-screen flex bg-glass-bg font-inter">
            {/* Left Sidebar - Contacts */}
            <div className="w-1/4 border-r border-slate-700">
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
            <div className={`flex-1 ${showSidebar ? '' : 'mr-0'}`}>
              {appState === 'dashboard' && (
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

              {appState === 'chat' && currentContact && (
                <ChatScreen
                  contact={currentContact}
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
              )}

              {appState === 'call' && currentContact && (
                <CallScreen
                  contact={currentContact}
                  onBack={handleBack}
                  onEndCall={handleBack}
                  showSidebar={showSidebar}
                  onToggleSidebar={handleToggleSidebar}
                />
              )}

              {appState === 'settings' && currentContact && (
                <SettingsScreen
                  contact={currentContact}
                  onBack={handleBack}
                  onSave={handleSaveAgent}
                  onDelete={handleDeleteAgent}
                />
              )}

              {appState === 'agent-creation' && currentContact && (
                <SettingsScreen
                  contact={currentContact}
                  onBack={handleBack}
                  onSave={handleSaveAgent}
                  onDelete={handleDeleteAgent}
                />
              )}
            </div>

            {/* Right Sidebar - Settings (conditional) */}
            {showSidebar && (appState === 'chat' || appState === 'call' || appState === 'agent-creation') && (
              <div className="w-1/4 border-l border-slate-700">
                <SettingsSidebar
                  contact={currentContact}
                  onSave={handleSaveAgent}
                />
              </div>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}