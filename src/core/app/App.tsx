import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
import AuthScreen from '../../modules/auth/components/AuthScreen';
import { ChatScreen } from '../../modules/chat';
import { CallScreen } from '../../modules/voice';
import { Dashboard, ContactSidebar, SettingsScreen, SettingsSidebar } from '../../modules/ui';
import { AIContact } from '../types/types';
import { DocumentInfo } from '../../modules/fileManagement/types/documents';
import { supabase } from '../../modules/database/lib/supabase';
import LandingPage from '../../components/LandingPage';
import SignupPage from '../../components/SignupPage';
import PricingPage from '../../components/PricingPage';
import SuccessPage from '../../components/SuccessPage';
import OAuthCallback from '../../modules/oauth/components/OAuthCallback';

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

type Screen = 'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create';

export default function App() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [templateToCreate, setTemplateToCreate] = useState<AgentTemplate | null>(null);

  // Load user's agents when authenticated
  useEffect(() => {
    if (user) {
      loadUserAgents();
    }
  }, [user]);

  const loadUserAgents = async () => {
    try {
      const { data: agents, error } = await supabase
        .from('user_agents')
        .select(`
          *,
          agent_integrations(*),
          agent_documents(*)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading user agents:', error);
        return;
      }

      const formattedContacts: AIContact[] = agents?.map(agent => ({
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
        integrations: agent.agent_integrations?.map((integration: any) => ({
          id: integration.id,
          integrationId: integration.template_id,
          name: integration.name,
          config: integration.config,
          status: integration.status
        })),
        documents: agent.agent_documents?.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.file_type,
          size: doc.file_size,
          content: doc.content,
          uploadedAt: new Date(doc.uploaded_at)
        }))
      })) || [];

      setContacts(formattedContacts);
    } catch (error) {
      console.error('Error loading user agents:', error);
    }
  };

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user && currentScreen === 'landing') {
      setCurrentScreen('dashboard');
    }
  }, [user, loading, currentScreen]);

  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentScreen('chat');
    setMessages([]); // Reset messages for new conversation
    setConversationDocuments([]); // Reset conversation documents
  };

  const handleCallClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setCurrentScreen('call');
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
    }
    setCurrentScreen('settings');
  };

  const handleNewChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setMessages([]); // Clear existing messages
    setConversationDocuments([]); // Clear conversation documents
    setCurrentScreen('chat');
  };

  const handleCreateAgent = () => {
    setTemplateToCreate(null); // Clear any template
    setCurrentScreen('create');
  };

  const handleCreateFromTemplate = (template: AgentTemplate) => {
    setTemplateToCreate(template);
    setCurrentScreen('create');
  };

  const getContactForCreation = (): AIContact => {
    if (templateToCreate) {
      // Create contact from template
      return {
        id: '',
        name: templateToCreate.name,
        description: templateToCreate.description,
        initials: templateToCreate.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
        color: templateToCreate.default_color,
        voice: templateToCreate.default_voice,
        avatar: templateToCreate.default_avatar_url,
        status: 'online',
        lastSeen: 'now',
        total_messages: 0,
        integrations: templateToCreate.suggested_integrations?.map(integrationId => ({
          id: Date.now().toString() + Math.random(),
          integrationId,
          name: `${integrationId} - ${templateToCreate.name}`,
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
      };
    }

    // Default empty contact
    return {
      id: '',
      name: '',
      description: '',
      initials: 'AI',
      color: '#3b82f6',
      voice: 'Puck',
      status: 'online',
      lastSeen: 'now',
      total_messages: 0
    };
  };

  const handleSaveContact = async (contact: AIContact) => {
    try {
      if (contact.id) {
        // Update existing agent
        const { error: updateError } = await supabase
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

        if (updateError) {
          console.error('Error updating agent:', updateError);
          return;
        }

        // Update integrations
        if (contact.integrations) {
          // Delete existing integrations
          await supabase
            .from('agent_integrations')
            .delete()
            .eq('agent_id', contact.id);

          // Insert new integrations
          for (const integration of contact.integrations) {
            await supabase
              .from('agent_integrations')
              .insert({
                agent_id: contact.id,
                template_id: integration.integrationId,
                name: integration.name,
                config: integration.config,
                status: integration.status
              });
          }
        }

        // Update documents
        if (contact.documents) {
          // Delete existing documents
          await supabase
            .from('agent_documents')
            .delete()
            .eq('agent_id', contact.id);

          // Insert new documents
          for (const doc of contact.documents) {
            await supabase
              .from('agent_documents')
              .insert({
                agent_id: contact.id,
                name: doc.name,
                original_filename: doc.name,
                file_type: doc.type,
                file_size: doc.size,
                content: doc.content,
                processing_status: 'completed'
              });
          }
        }

        setContacts(prev => prev.map(c => c.id === contact.id ? contact : c));
      } else {
        // Create new agent
        const { data: newAgent, error: insertError } = await supabase
          .from('user_agents')
          .insert({
            user_id: user?.id,
            template_id: templateToCreate?.id,
            name: contact.name,
            description: contact.description,
            initials: contact.initials,
            color: contact.color,
            voice: contact.voice,
            avatar_url: contact.avatar,
            status: 'online',
            last_seen: 'now'
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating agent:', insertError);
          return;
        }

        const newContact = { ...contact, id: newAgent.id };

        // Save integrations
        if (contact.integrations) {
          for (const integration of contact.integrations) {
            await supabase
              .from('agent_integrations')
              .insert({
                agent_id: newAgent.id,
                template_id: integration.integrationId,
                name: integration.name,
                config: integration.config,
                status: integration.status
              });
          }
        }

        // Save documents
        if (contact.documents) {
          for (const doc of contact.documents) {
            await supabase
              .from('agent_documents')
              .insert({
                agent_id: newAgent.id,
                name: doc.name,
                original_filename: doc.name,
                file_type: doc.type,
                file_size: doc.size,
                content: doc.content,
                processing_status: 'completed'
              });
          }
        }

        setContacts(prev => [...prev, newContact]);
      }

      setCurrentScreen('dashboard');
      setTemplateToCreate(null);
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  const handleSendMessage = (content: string, documents?: DocumentInfo[]) => {
    const userMessage = {
      id: Date.now().toString(),
      content,
      sender: 'user' as const,
      timestamp: new Date(),
      contactId: selectedContact?.id || '',
      attachments: documents
    };

    setMessages(prev => [...prev, userMessage]);

    // Add new documents to conversation documents
    if (documents && documents.length > 0) {
      setConversationDocuments(prev => [...prev, ...documents]);
    }

    // Simulate AI response
    setTimeout(() => {
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: `I understand you're asking about "${content}". Let me help you with that. ${
          documents && documents.length > 0 
            ? `I can see you've shared ${documents.length} document${documents.length > 1 ? 's' : ''} with me. I'll analyze ${documents.length > 1 ? 'them' : 'it'} and incorporate the information into my response.` 
            : ''
        }`,
        sender: 'ai' as const,
        timestamp: new Date(),
        contactId: selectedContact?.id || ''
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleBack = () => {
    setCurrentScreen('dashboard');
    setSelectedContact(null);
  };

  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/*" element={
          <>
            {!user ? (
              <>
                {currentScreen === 'landing' && (
                  <LandingPage 
                    onGetStarted={() => setCurrentScreen('signup')}
                    onSignUp={() => setCurrentScreen('signup')}
                  />
                )}
                {currentScreen === 'signup' && (
                  <SignupPage 
                    onSuccess={() => setCurrentScreen('dashboard')}
                    onBackToLanding={() => setCurrentScreen('landing')}
                    onSignIn={() => setCurrentScreen('signin')}
                  />
                )}
                {currentScreen === 'signin' && (
                  <AuthScreen onSuccess={() => setCurrentScreen('dashboard')} />
                )}
                {currentScreen === 'pricing' && (
                  <PricingPage 
                    onSelectPlan={(plan) => console.log('Selected plan:', plan)}
                    onStayFree={() => setCurrentScreen('dashboard')}
                  />
                )}
              </>
            ) : (
              <div className="h-screen flex bg-glass-bg">
                {/* Left Sidebar - Contacts */}
                <div className="w-1/4 border-r border-slate-700">
                  <ContactSidebar
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onHomeClick={() => setCurrentScreen('dashboard')}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>

                {/* Main Content */}
                <div className={`flex-1 ${showSidebar ? '' : 'mr-0'}`}>
                  {currentScreen === 'dashboard' && (
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

                  {currentScreen === 'chat' && selectedContact && (
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
                  )}

                  {currentScreen === 'call' && selectedContact && (
                    <CallScreen
                      contact={selectedContact}
                      onBack={handleBack}
                    />
                  )}

                  {currentScreen === 'settings' && selectedContact && (
                    <SettingsScreen
                      contact={selectedContact}
                      onBack={handleBack}
                      onSave={handleSaveContact}
                    />
                  )}

                  {currentScreen === 'create' && (
                    <SettingsScreen
                      contact={getContactForCreation()}
                      onBack={handleBack}
                      onSave={handleSaveContact}
                    />
                  )}
                </div>

                {/* Right Sidebar - Settings (only show on chat/call screens) */}
                {(currentScreen === 'chat' || currentScreen === 'call' || currentScreen === 'create') && showSidebar && (
                  <div className="w-1/4 border-l border-slate-700">
                    <SettingsSidebar
                      contact={currentScreen === 'create' ? getContactForCreation() : selectedContact}
                      onSave={handleSaveContact}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        } />
      </Routes>
    </Router>
  );
}