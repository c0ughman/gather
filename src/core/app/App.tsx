import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AIContact, Message } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { IntegrationInstance } from '../../modules/integrations/types/integrations';
import { getIntegrationById } from '../../modules/integrations/data/integrations';
import { supabase } from '../../modules/database/lib/supabase';

// Components
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import { AuthScreen } from '../../modules/auth';
import { Dashboard, ContactSidebar, SettingsScreen, SettingsSidebar } from '../../modules/ui';
import { ChatScreen } from '../../modules/chat';
import { CallScreen } from '../../modules/voice';

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

type AppState = 'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [appState, setAppState] = useState<AppState>('landing');
  const [contacts, setContacts] = useLocalStorage<AIContact[]>('ai-contacts', []);
  const [messages, setMessages] = useLocalStorage<Message[]>('chat-messages', []);
  const [conversationDocuments, setConversationDocuments] = useLocalStorage<DocumentInfo[]>('conversation-documents', []);
  const [currentContact, setCurrentContact] = useState<AIContact | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [templateToCreate, setTemplateToCreate] = useState<AgentTemplate | null>(null);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && user && appState === 'landing') {
      setAppState('dashboard');
    }
  }, [user, authLoading, appState]);

  // Load contacts from Supabase when user logs in
  useEffect(() => {
    const loadUserContacts = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_agents')
          .select(`
            *,
            agent_integrations(*),
            agent_documents(*)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading user contacts:', error);
          return;
        }

        const loadedContacts: AIContact[] = data.map(agent => ({
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
          integrations: agent.agent_integrations?.map((integration: any) => ({
            id: integration.id,
            integrationId: integration.template_id,
            name: integration.name,
            config: integration.config,
            status: integration.status
          })) || [],
          documents: agent.agent_documents?.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            type: doc.file_type,
            size: doc.file_size,
            content: doc.content,
            uploadedAt: new Date(doc.uploaded_at),
            metadata: doc.metadata
          })) || []
        }));

        setContacts(loadedContacts);
      } catch (error) {
        console.error('Error loading user contacts:', error);
      }
    };

    if (user) {
      loadUserContacts();
    }
  }, [user, setContacts]);

  const handleGetStarted = () => {
    setAppState('signup');
  };

  const handleSignUp = () => {
    setAppState('signup');
  };

  const handleSignIn = () => {
    setAppState('signin');
  };

  const handleBackToLanding = () => {
    setAppState('landing');
  };

  const handleAuthSuccess = () => {
    setAppState('dashboard');
  };

  const handleSelectPlan = (plan: string) => {
    console.log('Selected plan:', plan);
    setAppState('dashboard');
  };

  const handleStayFree = () => {
    setAppState('dashboard');
  };

  const handleChatClick = (contact: AIContact) => {
    setCurrentContact(contact);
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
    } else {
      // Global settings
      setCurrentContact(null);
      setAppState('settings');
    }
  };

  const handleNewChatClick = (contact: AIContact) => {
    // Clear conversation documents for new chat
    setConversationDocuments([]);
    // Clear messages for this contact
    setMessages(prev => prev.filter(msg => msg.contactId !== contact.id));
    handleChatClick(contact);
  };

  const handleCreateAgent = () => {
    setTemplateToCreate(null);
    setCurrentContact(null);
    setAppState('create-agent');
  };

  const handleCreateFromTemplate = (template: AgentTemplate) => {
    setTemplateToCreate(template);
    setCurrentContact(null);
    setAppState('create-agent');
  };

  const handleBack = () => {
    setCurrentContact(null);
    setTemplateToCreate(null);
    setAppState('dashboard');
  };

  const handleSaveContact = async (contact: AIContact) => {
    try {
      if (!user) {
        console.error('No user found');
        return;
      }

      // Check if this is a new contact or an update
      const isNewContact = !contacts.find(c => c.id === contact.id);

      if (isNewContact) {
        // Create new agent in database
        const { data: newAgent, error: agentError } = await supabase
          .from('user_agents')
          .insert({
            user_id: user.id,
            template_id: templateToCreate?.id || null,
            name: contact.name,
            description: contact.description,
            initials: contact.initials,
            color: contact.color,
            voice: contact.voice,
            avatar_url: contact.avatar,
            status: contact.status || 'online',
            last_seen: contact.lastSeen || 'now',
            tags: contact.tags || [],
            is_favorite: false,
            sort_order: 0,
            total_conversations: 0,
            total_messages: 0
          })
          .select()
          .single();

        if (agentError) {
          console.error('Error creating agent:', agentError);
          return;
        }

        // Update contact with database ID
        const updatedContact = { ...contact, id: newAgent.id };

        // Save integrations if any
        if (contact.integrations && contact.integrations.length > 0) {
          const integrationInserts = contact.integrations.map(integration => ({
            agent_id: newAgent.id,
            template_id: integration.integrationId,
            name: integration.name,
            description: integration.config.description || '',
            config: integration.config,
            trigger_type: integration.config.trigger || 'manual',
            interval_minutes: integration.config.intervalMinutes || null,
            status: integration.status || 'active'
          }));

          const { error: integrationsError } = await supabase
            .from('agent_integrations')
            .insert(integrationInserts);

          if (integrationsError) {
            console.error('Error saving integrations:', integrationsError);
          }
        }

        // Save documents if any
        if (contact.documents && contact.documents.length > 0) {
          const documentInserts = contact.documents.map(doc => ({
            agent_id: newAgent.id,
            name: doc.name,
            original_filename: doc.name,
            file_type: doc.type,
            file_size: doc.size,
            content: doc.content,
            processing_status: 'completed',
            metadata: doc.metadata || {},
            uploaded_at: doc.uploadedAt.toISOString()
          }));

          const { error: documentsError } = await supabase
            .from('agent_documents')
            .insert(documentInserts);

          if (documentsError) {
            console.error('Error saving documents:', documentsError);
          }
        }

        // Add to local state
        setContacts(prev => [...prev, updatedContact]);
      } else {
        // Update existing contact
        const { error: updateError } = await supabase
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
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id);

        if (updateError) {
          console.error('Error updating agent:', updateError);
          return;
        }

        // Update local state
        setContacts(prev => prev.map(c => c.id === contact.id ? contact : c));
      }

      setTemplateToCreate(null);
      setAppState('dashboard');
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  const handleSendMessage = (content: string, documents?: DocumentInfo[]) => {
    if (!currentContact) return;

    // Add documents to conversation documents if provided
    if (documents && documents.length > 0) {
      setConversationDocuments(prev => [...prev, ...documents]);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: currentContact.id,
      attachments: documents
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I understand you said: "${content}". I'm analyzing this along with ${conversationDocuments.length + (documents?.length || 0)} available documents to provide you with the most relevant response.`,
        sender: 'ai',
        timestamp: new Date(),
        contactId: currentContact.id
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Get current contact messages
  const currentMessages = currentContact 
    ? messages.filter(msg => msg.contactId === currentContact.id)
    : [];

  // Create contact from template if needed
  const getContactForCreation = (): AIContact | null => {
    if (!templateToCreate) return null;

    // Create integrations from template
    const integrations: IntegrationInstance[] = templateToCreate.suggested_integrations?.map(integrationId => {
      const integrationDef = getIntegrationById(integrationId);
      return {
        id: Date.now().toString() + Math.random(),
        integrationId,
        name: integrationDef?.name || integrationId,
        config: {
          integrationId,
          enabled: true,
          settings: {},
          trigger: 'chat-start',
          intervalMinutes: 30,
          description: `Auto-configured from ${templateToCreate.name} template`
        },
        status: 'active'
      };
    }).filter(Boolean) || [];

    return {
      id: Date.now().toString(),
      name: templateToCreate.name,
      description: templateToCreate.description,
      initials: templateToCreate.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2),
      color: templateToCreate.default_color,
      voice: templateToCreate.default_voice,
      avatar: templateToCreate.default_avatar_url,
      status: 'online',
      lastSeen: 'now',
      integrations,
      tags: templateToCreate.tags
    };
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/*" element={
          <div className="h-screen flex flex-col bg-glass-bg">
            {!user ? (
              // Unauthenticated states
              <>
                {appState === 'landing' && (
                  <LandingPage 
                    onGetStarted={handleGetStarted}
                    onSignUp={handleSignUp}
                  />
                )}
                {appState === 'signup' && (
                  <SignupPage 
                    onSuccess={handleAuthSuccess}
                    onBackToLanding={handleBackToLanding}
                    onSignIn={handleSignIn}
                  />
                )}
                {appState === 'signin' && (
                  <AuthScreen 
                    onSuccess={handleAuthSuccess}
                    onBackToLanding={handleBackToLanding}
                    onSignUp={handleSignUp}
                  />
                )}
                {appState === 'pricing' && (
                  <PricingPage 
                    onSelectPlan={handleSelectPlan}
                    onStayFree={handleStayFree}
                  />
                )}
              </>
            ) : (
              // Authenticated states
              <div className="flex h-full">
                {/* Left Sidebar - Contacts */}
                {(appState === 'dashboard' || appState === 'chat' || appState === 'call') && (
                  <div className="w-1/4 border-r border-slate-700">
                    <ContactSidebar
                      contacts={contacts}
                      onChatClick={handleChatClick}
                      onCallClick={handleCallClick}
                      onSettingsClick={handleSettingsClick}
                      onHomeClick={() => setAppState('dashboard')}
                      onCreateAgent={handleCreateAgent}
                    />
                  </div>
                )}

                {/* Main Content */}
                <div className={`flex-1 ${
                  appState === 'dashboard' ? 'w-full' : 
                  (appState === 'chat' || appState === 'call') && showSidebar ? 'w-1/2' : 
                  (appState === 'chat' || appState === 'call') ? 'w-3/4' : 'w-full'
                }`}>
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
                      messages={currentMessages}
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

                  {appState === 'settings' && (
                    <SettingsScreen
                      contact={currentContact || getContactForCreation()!}
                      onBack={handleBack}
                      onSave={handleSaveContact}
                    />
                  )}

                  {appState === 'create-agent' && (
                    <SettingsScreen
                      contact={getContactForCreation() || {
                        id: Date.now().toString(),
                        name: '',
                        description: '',
                        initials: 'AI',
                        color: '#3b82f6',
                        voice: 'Puck',
                        status: 'online',
                        lastSeen: 'now'
                      }}
                      onBack={handleBack}
                      onSave={handleSaveContact}
                    />
                  )}
                </div>

                {/* Right Sidebar - Settings */}
                {(appState === 'chat' || appState === 'call') && showSidebar && (
                  <div className="w-1/4 border-l border-slate-700">
                    <SettingsSidebar
                      contact={currentContact}
                      onSave={handleSaveContact}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}