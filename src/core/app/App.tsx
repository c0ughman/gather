import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/hooks/useAuth';
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
import { Dashboard, ContactSidebar, SettingsSidebar, SettingsScreen } from '../../modules/ui';
import { ChatScreen } from '../../modules/chat';
import { CallScreen } from '../../modules/voice';
import { AuthScreen } from '../../modules/auth';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [templateToCreate, setTemplateToCreate] = useState<AgentTemplate | null>(null);

  // Load user's contacts when authenticated
  useEffect(() => {
    if (user) {
      loadUserContacts();
    }
  }, [user]);

  const loadUserContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('user_agents')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading contacts:', error);
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
        total_messages: agent.total_messages || 0,
        total_conversations: agent.total_conversations || 0,
        last_used_at: agent.last_used_at ? new Date(agent.last_used_at) : undefined,
        integrations: [], // Will be loaded separately if needed
        documents: [], // Will be loaded separately if needed
        tags: agent.tags || [],
        is_favorite: agent.is_favorite || false,
        folder: agent.folder,
        sort_order: agent.sort_order || 0
      }));

      setContacts(formattedContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const handleCreateFromTemplate = (template: AgentTemplate) => {
    setTemplateToCreate(template);
    setCurrentView('create-agent');
  };

  const handleSaveContact = async (contact: AIContact) => {
    try {
      if (contact.id && contact.id !== 'new') {
        // Update existing contact
        const { error } = await supabase
          .from('user_agents')
          .update({
            name: contact.name,
            description: contact.description,
            initials: contact.initials,
            color: contact.color,
            voice: contact.voice,
            avatar_url: contact.avatar,
            tags: contact.tags,
            is_favorite: contact.is_favorite,
            folder: contact.folder,
            sort_order: contact.sort_order,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Error updating contact:', error);
          return;
        }

        // Update local state
        setContacts(prev => prev.map(c => c.id === contact.id ? contact : c));
      } else {
        // Create new contact
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
            tags: contact.tags,
            is_favorite: contact.is_favorite,
            folder: contact.folder,
            sort_order: contact.sort_order
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating contact:', error);
          return;
        }

        // Create the new contact object
        const newContact: AIContact = {
          id: data.id,
          name: contact.name,
          description: contact.description,
          initials: contact.initials,
          color: contact.color,
          voice: contact.voice,
          avatar: contact.avatar,
          status: 'online',
          lastSeen: 'now',
          total_messages: 0,
          total_conversations: 0,
          integrations: contact.integrations,
          documents: contact.documents,
          tags: contact.tags,
          is_favorite: contact.is_favorite,
          folder: contact.folder,
          sort_order: contact.sort_order
        };

        // Add to local state
        setContacts(prev => [newContact, ...prev]);

        // If we have integrations from template, save them
        if (contact.integrations && contact.integrations.length > 0) {
          for (const integration of contact.integrations) {
            try {
              await supabase
                .from('agent_integrations')
                .insert({
                  agent_id: data.id,
                  template_id: integration.integrationId,
                  name: integration.name,
                  description: integration.config.description,
                  config: integration.config,
                  trigger_type: integration.config.trigger,
                  interval_minutes: integration.config.intervalMinutes,
                  status: 'active'
                });
            } catch (integrationError) {
              console.error('Error saving integration:', integrationError);
            }
          }
        }

        // If we have documents from template, save them
        if (contact.documents && contact.documents.length > 0) {
          for (const document of contact.documents) {
            try {
              await supabase
                .from('agent_documents')
                .insert({
                  agent_id: data.id,
                  name: document.name,
                  original_filename: document.name,
                  file_type: document.type,
                  file_size: document.size,
                  content: document.content,
                  summary: document.summary,
                  extracted_text: document.extractedText,
                  processing_status: 'completed',
                  metadata: document.metadata
                });
            } catch (documentError) {
              console.error('Error saving document:', documentError);
            }
          }
        }
      }

      // Clear template and go back to dashboard
      setTemplateToCreate(null);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Error saving contact:', error);
    }
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

  const handleCreateAgent = () => {
    setTemplateToCreate(null);
    setCurrentView('create-agent');
  };

  const loadMessages = async (contactId: string) => {
    // For now, we'll use mock messages since we don't have a messages table yet
    setMessages([]);
    setConversationDocuments([]);
  };

  const handleSendMessage = async (content: string, documents?: DocumentInfo[]) => {
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

    // Simulate AI response (replace with actual AI integration)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I understand you said: "${content}". This is a simulated response. In the full implementation, this would be processed by the AI with access to the agent's knowledge base and integrations.`,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleBack = () => {
    setCurrentView('dashboard');
    setSelectedContact(null);
    setTemplateToCreate(null);
  };

  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screens for non-authenticated users
  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/pricing" element={
            <PricingPage 
              onSelectPlan={(plan) => console.log('Selected plan:', plan)}
              onStayFree={() => setCurrentView('signup')}
            />
          } />
          <Route path="*" element={
            <>
              {currentView === 'landing' && (
                <LandingPage 
                  onGetStarted={() => setCurrentView('signup')}
                  onSignUp={() => setCurrentView('signup')}
                />
              )}
              {currentView === 'signup' && (
                <SignupPage 
                  onSuccess={() => setCurrentView('dashboard')}
                  onBackToLanding={() => setCurrentView('landing')}
                  onSignIn={() => setCurrentView('signin')}
                />
              )}
              {currentView === 'signin' && (
                <AuthScreen 
                  onSuccess={() => setCurrentView('dashboard')}
                  onBackToLanding={() => setCurrentView('landing')}
                  onSignUp={() => setCurrentView('signup')}
                />
              )}
            </>
          } />
        </Routes>
      </Router>
    );
  }

  // Main app layout for authenticated users
  return (
    <Router>
      <Routes>
        <Route path="/success" element={<SuccessPage />} />
        <Route path="*" element={
          <div className="h-screen flex bg-glass-bg">
            {/* Left Sidebar - Contacts */}
            {(currentView === 'dashboard' || currentView === 'chat' || currentView === 'call') && (
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
            <div className={`flex-1 ${
              currentView === 'dashboard' ? '' : 
              (currentView === 'chat' || currentView === 'call') && showSidebar ? '' : 
              'w-full'
            }`}>
              {currentView === 'dashboard' && (
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
                  showSidebar={showSidebar}
                  onToggleSidebar={handleToggleSidebar}
                />
              )}

              {currentView === 'call' && selectedContact && (
                <CallScreen
                  contact={selectedContact}
                  onBack={handleBack}
                  onEndCall={handleBack}
                  showSidebar={showSidebar}
                  onToggleSidebar={handleToggleSidebar}
                />
              )}

              {currentView === 'settings' && (
                <SettingsScreen
                  contact={selectedContact || contacts[0]}
                  onBack={handleBack}
                  onSave={handleSaveContact}
                />
              )}

              {currentView === 'create-agent' && (
                <CreateAgentScreen
                  template={templateToCreate}
                  onBack={handleBack}
                  onSave={handleSaveContact}
                />
              )}
            </div>

            {/* Right Sidebar - Settings (only for chat/call views) */}
            {(currentView === 'chat' || currentView === 'call') && showSidebar && (
              <div className="w-1/4 border-l border-slate-700">
                <SettingsSidebar
                  contact={selectedContact}
                  onSave={handleSaveContact}
                />
              </div>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}

// Create Agent Screen Component
interface CreateAgentScreenProps {
  template?: AgentTemplate | null;
  onBack: () => void;
  onSave: (contact: AIContact) => void;
}

function CreateAgentScreen({ template, onBack, onSave }: CreateAgentScreenProps) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    color: template?.default_color || '#3b82f6',
    voice: template?.default_voice || 'Puck',
    avatar: template?.default_avatar_url || '',
  });

  const [integrations, setIntegrations] = useState<IntegrationInstance[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);

  // Initialize integrations from template
  useEffect(() => {
    if (template?.suggested_integrations) {
      const templateIntegrations: IntegrationInstance[] = template.suggested_integrations.map((integrationId, index) => {
        const integrationDef = getIntegrationById(integrationId);
        if (!integrationDef) return null;

        return {
          id: `template-${index}`,
          integrationId,
          name: `${integrationDef.name} - ${template.name}`,
          config: {
            integrationId,
            enabled: true,
            settings: {},
            trigger: 'chat-start',
            intervalMinutes: 30,
            description: `Auto-configured from ${template.name} template`
          },
          status: 'active'
        };
      }).filter(Boolean) as IntegrationInstance[];

      setIntegrations(templateIntegrations);
    }
  }, [template]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const newContact: AIContact = {
      id: 'new',
      name: formData.name.trim(),
      description: formData.description.trim(),
      initials: formData.name.trim().split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
      color: formData.color,
      voice: formData.voice,
      avatar: formData.avatar || undefined,
      status: 'online',
      lastSeen: 'now',
      total_messages: 0,
      total_conversations: 0,
      integrations: integrations.length > 0 ? integrations : undefined,
      documents: documents.length > 0 ? documents : undefined,
      tags: template?.tags || [],
      is_favorite: false,
      sort_order: 0
    };

    onSave(newContact);
  };

  return (
    <div className="h-full bg-glass-bg">
      <SettingsScreen
        contact={{
          id: 'new',
          name: formData.name,
          description: formData.description,
          initials: formData.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
          color: formData.color,
          voice: formData.voice,
          avatar: formData.avatar,
          status: 'online',
          lastSeen: 'now',
          total_messages: 0,
          total_conversations: 0,
          integrations,
          documents,
          tags: template?.tags || [],
          is_favorite: false,
          sort_order: 0
        }}
        onBack={onBack}
        onSave={handleSave}
      />
    </div>
  );
}