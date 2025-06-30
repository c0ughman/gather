import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { AIContact, Message } from './types/types';
import { DocumentInfo } from '../modules/fileManagement/types/documents';
import { IntegrationInstance } from '../modules/integrations/types/integrations';
import { getIntegrationById } from '../modules/integrations/data/integrations';
import { supabase } from '../modules/database/lib/supabase';

// Components
import LandingPage from '../components/LandingPage';
import SignupPage from '../components/SignupPage';
import PricingPage from '../components/PricingPage';
import SuccessPage from '../components/SuccessPage';
import AuthScreen from '../modules/auth/components/AuthScreen';
import Dashboard from '../modules/ui/components/Dashboard';
import ContactSidebar from '../modules/ui/components/ContactSidebar';
import SettingsSidebar from '../modules/ui/components/SettingsSidebar';
import SettingsScreen from '../modules/ui/components/SettingsScreen';
import ChatScreen from '../modules/chat/components/ChatScreen';
import CallScreen from '../modules/voice/components/CallScreen';

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

type AppView = 'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent';

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [contacts, setContacts] = useState<AIContact[]>([]);
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

  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setMessages([]); // Reset messages for new conversation
    setConversationDocuments([]); // Reset conversation documents
    setCurrentView('chat');
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

  const handleNewChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setMessages([]); // Clear previous messages
    setConversationDocuments([]); // Clear previous conversation documents
    setCurrentView('chat');
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
    return (
      <Router>
        <Routes>
          <Route path="/pricing" element={<PricingPage onSelectPlan={() => {}} onStayFree={() => setCurrentView('signup')} />} />
          <Route path="/signup" element={<SignupPage onSuccess={() => setCurrentView('dashboard')} onBackToLanding={() => setCurrentView('landing')} onSignIn={() => setCurrentView('signin')} />} />
          <Route path="/signin" element={<AuthScreen onSuccess={() => setCurrentView('dashboard')} onBackToLanding={() => setCurrentView('landing')} onSignUp={() => setCurrentView('signup')} />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/" element={<LandingPage onGetStarted={() => setCurrentView('signup')} onSignUp={() => setCurrentView('signup')} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    );
  }

  // Authenticated user views
  const renderMainContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            contacts={contacts}
            onChatClick={handleChatClick}
            onCallClick={handleCallClick}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCreateAgent={handleCreateAgent}
            onCreateFromTemplate={handleCreateFromTemplate}
          />
        );

      case 'chat':
        return selectedContact ? (
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
            onToggleSidebar={toggleSidebar}
          />
        ) : null;

      case 'call':
        return selectedContact ? (
          <CallScreen
            contact={selectedContact}
            onBack={handleBack}
          />
        ) : null;

      case 'settings':
        return selectedContact ? (
          <SettingsScreen
            contact={selectedContact}
            onBack={handleBack}
            onSave={handleSaveAgent}
            onDelete={handleDeleteAgent}
          />
        ) : null;

      case 'create-agent':
        const initialContact: AIContact = templateToCreate ? {
          id: '',
          name: templateToCreate.name,
          description: templateToCreate.description,
          initials: templateToCreate.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
          color: templateToCreate.default_color,
          voice: templateToCreate.default_voice,
          avatar: templateToCreate.default_avatar_url,
          status: 'online',
          lastSeen: 'now',
          personalityPrompt: templateToCreate.personality_traits?.join(', '),
          systemInstructions: templateToCreate.capabilities?.join(', '),
          customSettings: {},
          folder: undefined,
          tags: templateToCreate.tags || [],
          isFavorite: false,
          sortOrder: 0,
          totalConversations: 0,
          totalMessages: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Add suggested integrations
          integrations: templateToCreate.suggested_integrations?.map(integrationId => {
            const integrationDef = getIntegrationById(integrationId);
            if (!integrationDef) return null;
            
            return {
              id: Date.now().toString() + Math.random(),
              integrationId,
              name: `${integrationDef.name} - ${templateToCreate.name}`,
              config: {
                integrationId,
                enabled: true,
                settings: {},
                trigger: 'chat-start',
                intervalMinutes: 30,
                description: `Auto-configured from ${templateToCreate.name} template`
              },
              status: 'active'
            } as IntegrationInstance;
          }).filter(Boolean) as IntegrationInstance[]
        } : {
          id: '',
          name: '',
          description: '',
          initials: 'AI',
          color: '#3b82f6',
          voice: 'Puck',
          avatar: undefined,
          status: 'online',
          lastSeen: 'now',
          personalityPrompt: undefined,
          systemInstructions: undefined,
          customSettings: {},
          folder: undefined,
          tags: [],
          isFavorite: false,
          sortOrder: 0,
          totalConversations: 0,
          totalMessages: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        return (
          <SettingsScreen
            contact={initialContact}
            onBack={handleBack}
            onSave={handleSaveAgent}
          />
        );

      default:
        return (
          <Dashboard
            contacts={contacts}
            onChatClick={handleChatClick}
            onCallClick={handleCallClick}
            onSettingsClick={handleSettingsClick}
            onNewChatClick={handleNewChatClick}
            onCreateAgent={handleCreateAgent}
            onCreateFromTemplate={handleCreateFromTemplate}
          />
        );
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/*" element={
          <div className="h-screen flex bg-glass-bg font-inter">
            {/* Left Sidebar - Contacts */}
            {(currentView === 'chat' || currentView === 'call' || currentView === 'settings' || currentView === 'create-agent') && (
              <div className="w-1/4 border-r border-slate-700">
                <ContactSidebar
                  contacts={contacts}
                  onChatClick={handleChatClick}
                  onCallClick={handleCallClick}
                  onSettingsClick={handleSettingsClick}
                  onHomeClick={() => setCurrentView('dashboard')}
                  onCreateAgent={handleCreateAgent}
                />
              </div>
            )}

            {/* Main Content */}
            <div className={`flex-1 ${(currentView === 'chat' || currentView === 'call' || currentView === 'settings' || currentView === 'create-agent') ? '' : 'w-full'}`}>
              {renderMainContent()}
            </div>

            {/* Right Sidebar - Settings (only for chat view) */}
            {currentView === 'chat' && showSidebar && selectedContact && (
              <div className="w-1/4 border-l border-slate-700">
                <SettingsSidebar
                  contact={selectedContact}
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