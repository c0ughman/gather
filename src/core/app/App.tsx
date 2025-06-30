import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/hooks/useAuth';
import { AIContact, Message } from './types/types';
import { DocumentInfo } from '../modules/fileManagement/types/documents';
import { documentContextService } from '../modules/fileManagement/services/documentContextService';
import { geminiService } from '../modules/fileManagement/services/geminiService';
import { integrationsService } from '../modules/integrations/core/integrationsService';
import { getIntegrationById } from '../modules/integrations/data/integrations';
import { supabase } from '../modules/database/lib/supabase';

// Import components
import AuthScreen from '../modules/auth/components/AuthScreen';
import CallScreen from '../modules/voice/components/CallScreen';
import { ChatScreen } from '../modules/chat';
import { Dashboard, ContactSidebar, SettingsSidebar, SettingsScreen } from '../modules/ui';
import LandingPage from '../components/LandingPage';
import SignupPage from '../components/SignupPage';
import PricingPage from '../components/PricingPage';
import SuccessPage from '../components/SuccessPage';
import OAuthCallback from '../modules/oauth/components/OAuthCallback';

// Mobile components
import MobileContactsScreen from '../modules/ui/components/MobileContactsScreen';
import MobileLibraryScreen from '../modules/ui/components/MobileLibraryScreen';
import MobileNavigation from '../modules/ui/components/MobileNavigation';

// Hook to detect mobile
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
  const isMobile = useMobile();
  
  // App state
  const [currentView, setCurrentView] = useState<'landing' | 'signup' | 'signin' | 'pricing' | 'dashboard' | 'chat' | 'call' | 'settings' | 'create-agent' | 'mobile-contacts' | 'mobile-library'>('landing');
  const [mobileView, setMobileView] = useState<'contacts' | 'library'>('library');
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<AIContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationDocuments, setConversationDocuments] = useState<DocumentInfo[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [newAgentData, setNewAgentData] = useState<Partial<AIContact> | null>(null);

  // Load user agents from Supabase
  const loadUserAgents = async () => {
    try {
      console.log('Loading user agents from Supabase...');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        return;
      }

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

      // Transform the data to match our AIContact interface
      const transformedContacts: AIContact[] = (agents || []).map(agent => {
        // Transform documents
        const documents: DocumentInfo[] = (agent.agent_documents || []).map(doc => ({
          id: doc.id,
          name: doc.name,
          type: doc.file_type,
          size: doc.file_size,
          content: doc.content || doc.extracted_text || '',
          uploadedAt: new Date(doc.uploaded_at),
          metadata: {
            ...doc.metadata,
            extractionQuality: doc.extraction_quality,
            extractionSuccess: doc.processing_status === 'completed'
          }
        }));

        // Transform integrations
        const integrations = (agent.agent_integrations || []).map(integration => ({
          id: integration.id,
          integrationId: integration.template_id,
          name: integration.name,
          config: {
            integrationId: integration.template_id,
            enabled: integration.status === 'active',
            settings: integration.config || {},
            trigger: integration.trigger_type || 'chat-start',
            intervalMinutes: integration.interval_minutes || 30,
            description: integration.description || '',
            oauthTokenId: integration.credentials?.oauthTokenId,
            oauthConnected: !!integration.credentials?.oauthTokenId
          },
          status: integration.status as 'active' | 'inactive' | 'error' | 'pending'
        }));

        return {
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
          documents: documents.length > 0 ? documents : undefined,
          integrations: integrations.length > 0 ? integrations : undefined
        };
      });

      console.log('Transformed contacts:', transformedContacts);
      setContacts(transformedContacts);
    } catch (error) {
      console.error('Error loading user agents:', error);
    }
  };

  // Load agents when user is authenticated
  useEffect(() => {
    if (user) {
      loadUserAgents();
    }
  }, [user]);

  // Set initial view based on authentication and device
  useEffect(() => {
    if (authLoading) return;
    
    if (user) {
      if (isMobile) {
        setCurrentView('mobile-library');
      } else {
        setCurrentView('dashboard');
      }
    } else {
      setCurrentView('landing');
    }
  }, [user, authLoading, isMobile]);

  // Handle mobile view changes
  useEffect(() => {
    if (isMobile && user) {
      if (mobileView === 'contacts') {
        setCurrentView('mobile-contacts');
      } else {
        setCurrentView('mobile-library');
      }
    }
  }, [mobileView, isMobile, user]);

  const handleChatClick = (contact: AIContact) => {
    setSelectedContact(contact);
    setMessages([]);
    setConversationDocuments([]);
    setCurrentView('chat');
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
    setIsCreatingAgent(true);
    setNewAgentData({
      name: '',
      description: '',
      color: '#3b82f6',
      voice: 'Puck',
      initials: 'AI',
      status: 'online',
      lastSeen: 'now',
      totalConversations: 0,
      totalMessages: 0,
      isFavorite: false,
      sortOrder: 0,
      tags: []
    });
    setSelectedContact(null);
    setCurrentView('create-agent');
  };

  const handleCreateFromTemplate = (template: AgentTemplate) => {
    setIsCreatingAgent(true);
    setNewAgentData({
      name: template.name,
      description: template.description,
      color: template.default_color,
      voice: template.default_voice,
      avatar: template.default_avatar_url,
      initials: template.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
      status: 'online',
      lastSeen: 'now',
      totalConversations: 0,
      totalMessages: 0,
      isFavorite: false,
      sortOrder: 0,
      tags: template.tags || []
    });
    setSelectedContact(null);
    setCurrentView('create-agent');
  };

  const handleSaveAgent = async (agentData: AIContact) => {
    try {
      console.log('Saving agent:', agentData);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting user:', userError);
        alert('You must be logged in to save an agent');
        return;
      }

      if (isCreatingAgent) {
        // Create new agent
        const { data: newAgent, error } = await supabase
          .from('user_agents')
          .insert({
            user_id: user.id,
            name: agentData.name,
            description: agentData.description,
            initials: agentData.initials,
            color: agentData.color,
            voice: agentData.voice,
            avatar_url: agentData.avatar,
            status: agentData.status,
            last_seen: agentData.lastSeen,
            personality_prompt: agentData.personalityPrompt,
            system_instructions: agentData.systemInstructions,
            custom_settings: agentData.customSettings,
            folder: agentData.folder,
            tags: agentData.tags,
            is_favorite: agentData.isFavorite,
            sort_order: agentData.sortOrder
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating agent:', error);
          alert('Failed to create agent. Please try again.');
          return;
        }

        console.log('Agent created successfully:', newAgent);
        
        // Add to local state
        const newContact: AIContact = {
          ...agentData,
          id: newAgent.id
        };
        
        setContacts(prev => [newContact, ...prev]);
        setIsCreatingAgent(false);
        setNewAgentData(null);
        setCurrentView(isMobile ? 'mobile-contacts' : 'dashboard');
      } else {
        // Update existing agent
        const { error } = await supabase
          .from('user_agents')
          .update({
            name: agentData.name,
            description: agentData.description,
            initials: agentData.initials,
            color: agentData.color,
            voice: agentData.voice,
            avatar_url: agentData.avatar,
            status: agentData.status,
            last_seen: agentData.lastSeen,
            personality_prompt: agentData.personalityPrompt,
            system_instructions: agentData.systemInstructions,
            custom_settings: agentData.customSettings,
            folder: agentData.folder,
            tags: agentData.tags,
            is_favorite: agentData.isFavorite,
            sort_order: agentData.sortOrder,
            updated_at: new Date().toISOString()
          })
          .eq('id', agentData.id);

        if (error) {
          console.error('Error updating agent:', error);
          alert('Failed to update agent. Please try again.');
          return;
        }

        console.log('Agent updated successfully');
        
        // Update local state
        setContacts(prev => prev.map(contact => 
          contact.id === agentData.id ? agentData : contact
        ));
        
        if (selectedContact?.id === agentData.id) {
          setSelectedContact(agentData);
        }
      }
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const handleDeleteAgent = (contactId: string) => {
    // Remove from local state
    setContacts(prev => prev.filter(contact => contact.id !== contactId));
    
    // Clear selected contact if it was deleted
    if (selectedContact?.id === contactId) {
      setSelectedContact(null);
    }
    
    // Navigate back to appropriate view
    setCurrentView(isMobile ? 'mobile-contacts' : 'dashboard');
  };

  const handleSendMessage = async (content: string, attachedDocuments?: DocumentInfo[]) => {
    if (!selectedContact) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: selectedContact.id,
      attachments: attachedDocuments
    };

    setMessages(prev => [...prev, userMessage]);

    // Add attached documents to conversation context
    if (attachedDocuments && attachedDocuments.length > 0) {
      setConversationDocuments(prev => [...prev, ...attachedDocuments]);
    }

    try {
      // Prepare context for AI
      const allDocuments = [
        ...(selectedContact.documents || []),
        ...conversationDocuments,
        ...(attachedDocuments || [])
      ];

      // Get integration data if available
      let integrationContext = '';
      if (selectedContact.integrations) {
        for (const integration of selectedContact.integrations) {
          if (integration.status === 'active') {
            try {
              const integrationDef = getIntegrationById(integration.integrationId);
              if (integrationDef) {
                const data = await integrationsService.executeIntegration(integrationDef, integration.config);
                integrationContext += `\n\n${integrationDef.name} Data:\n${JSON.stringify(data, null, 2)}`;
              }
            } catch (error) {
              console.error(`Error executing integration ${integration.integrationId}:`, error);
            }
          }
        }
      }

      // Build context from documents
      const documentContext = documentContextService.buildContext(allDocuments);
      
      // Prepare the full context
      const fullContext = `
${selectedContact.personalityPrompt ? `Personality: ${selectedContact.personalityPrompt}\n` : ''}
${selectedContact.systemInstructions ? `Instructions: ${selectedContact.systemInstructions}\n` : ''}
${documentContext ? `Available Documents:\n${documentContext}\n` : ''}
${integrationContext ? `Live Data:${integrationContext}\n` : ''}

Previous conversation:
${messages.map(m => `${m.sender}: ${m.content}`).join('\n')}

User: ${content}
AI:`;

      // Get AI response
      const aiResponse = await geminiService.generateResponse(fullContext);

      // Add AI message
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleBack = () => {
    if (isCreatingAgent) {
      setIsCreatingAgent(false);
      setNewAgentData(null);
    }
    
    if (isMobile) {
      setCurrentView(mobileView === 'contacts' ? 'mobile-contacts' : 'mobile-library');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const handleCloseSidebar = () => {
    if (isCreatingAgent) {
      setIsCreatingAgent(false);
      setNewAgentData(null);
      setCurrentView(isMobile ? 'mobile-library' : 'dashboard');
    }
  };

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

  // Router for handling URL-based navigation
  return (
    <Router>
      <Routes>
        <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/*" element={
          <>
            {/* Landing Page */}
            {currentView === 'landing' && (
              <LandingPage 
                onGetStarted={() => setCurrentView('signup')}
                onSignUp={() => setCurrentView('signup')}
              />
            )}

            {/* Signup Page */}
            {currentView === 'signup' && (
              <SignupPage 
                onSuccess={() => setCurrentView(isMobile ? 'mobile-library' : 'dashboard')}
                onBackToLanding={() => setCurrentView('landing')}
                onSignIn={() => setCurrentView('signin')}
              />
            )}

            {/* Sign In Page */}
            {currentView === 'signin' && (
              <AuthScreen 
                onSuccess={() => setCurrentView(isMobile ? 'mobile-library' : 'dashboard')}
                onBackToLanding={() => setCurrentView('landing')}
                onSignUp={() => setCurrentView('signup')}
              />
            )}

            {/* Pricing Page */}
            {currentView === 'pricing' && (
              <PricingPage 
                onSelectPlan={(plan) => console.log('Selected plan:', plan)}
                onStayFree={() => setCurrentView(isMobile ? 'mobile-library' : 'dashboard')}
              />
            )}

            {/* Mobile Views */}
            {isMobile && currentView === 'mobile-contacts' && (
              <div className="h-screen flex flex-col">
                <MobileContactsScreen
                  contacts={contacts}
                  onChatClick={handleChatClick}
                  onCallClick={handleCallClick}
                  onCreateAgent={handleCreateAgent}
                />
                <MobileNavigation
                  currentView="contacts"
                  onViewChange={setMobileView}
                  onCreateAgent={handleCreateAgent}
                />
              </div>
            )}

            {isMobile && currentView === 'mobile-library' && (
              <div className="h-screen flex flex-col">
                <MobileLibraryScreen
                  contacts={contacts}
                  onChatClick={handleChatClick}
                  onCallClick={handleCallClick}
                  onSettingsClick={handleSettingsClick}
                  onCreateAgent={handleCreateAgent}
                />
                <MobileNavigation
                  currentView="library"
                  onViewChange={setMobileView}
                  onCreateAgent={handleCreateAgent}
                />
              </div>
            )}

            {/* Desktop Views */}
            {!isMobile && currentView === 'dashboard' && (
              <div className="h-screen flex">
                <div className="w-80 flex-shrink-0">
                  <ContactSidebar
                    contacts={contacts}
                    onChatClick={handleChatClick}
                    onCallClick={handleCallClick}
                    onSettingsClick={handleSettingsClick}
                    onHomeClick={() => setCurrentView('dashboard')}
                    onCreateAgent={handleCreateAgent}
                  />
                </div>
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

            {/* Chat View */}
            {currentView === 'chat' && selectedContact && (
              <div className="h-screen flex">
                {!isMobile && (
                  <div className="w-80 flex-shrink-0">
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
                <div className="flex-1 relative">
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
                {!isMobile && showSidebar && (
                  <div className="w-80 flex-shrink-0">
                    <SettingsSidebar
                      contact={selectedContact}
                      onSave={handleSaveAgent}
                      onDelete={handleDeleteAgent}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Call View */}
            {currentView === 'call' && selectedContact && (
              <div className="h-screen">
                <CallScreen
                  contact={selectedContact}
                  onBack={handleBack}
                />
              </div>
            )}

            {/* Settings View */}
            {currentView === 'settings' && selectedContact && (
              <SettingsScreen
                contact={selectedContact}
                onBack={handleBack}
                onSave={handleSaveAgent}
                onDelete={handleDeleteAgent}
              />
            )}

            {/* Create Agent View */}
            {currentView === 'create-agent' && (
              <div className="h-screen flex">
                {!isMobile && (
                  <div className="w-80 flex-shrink-0">
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
                {!isMobile && (
                  <div className="w-80 flex-shrink-0">
                    <SettingsSidebar
                      contact={newAgentData as AIContact}
                      onSave={handleSaveAgent}
                      onClose={handleCloseSidebar}
                      onDelete={handleDeleteAgent}
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