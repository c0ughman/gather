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
  const [contacts, setContacts] = useState<AIContact[]>([]);
  const [messages, setMessages] = useLocalStorage<Message[]>('gather-messages', []);
  const [conversationDocuments, setConversationDocuments] = useState<Record<string, DocumentInfo[]>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    duration: 0,
    isMuted: false,
    status: 'ended'
  });
  const [showSidebar, setShowSidebar] = useState(true);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);

  // Update call duration
  useEffect(() => {
    let interval: number;
    if (callState.isActive && callState.status === 'connected') {
      interval = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState.isActive, callState.status]);

  // Load user data when authenticated
  useEffect(() => {
    if (user && !dataLoading) {
      loadUserData();
    } else if (!user) {
      setContacts([]);
      setMessages([]);
      setConversationDocuments({});
    }
  }, [user]);

  useEffect(() => {
    if (user && (currentView === 'landing' || currentView === 'signup' || currentView === 'login')) {
      setCurrentView('dashboard');
    }
  }, [user, currentView]);

  // Handle OAuth success/error messages
  useEffect(() => {
    const handleLocationState = () => {
      const state = window.history.state?.usr;
      if (state?.oauthSuccess) {
        setOauthMessage(`✅ ${state.provider} connected successfully!`);
        // Mark as connected in localStorage for the OAuth component
        if (user) {
          localStorage.setItem(`oauth_connected_${state.provider}_${user.id}`, 'true');
        }
        // Clear the state
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => setOauthMessage(null), 5000);
      } else if (state?.oauthError) {
        setOauthMessage(`❌ OAuth error: ${state.error}`);
        // Clear the state
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => setOauthMessage(null), 8000);
      }
    };

    handleLocationState();
  }, [user]);

  const loadUserData = async () => {
    if (!user || dataLoading) return;

    try {
      setDataLoading(true);
      console.log('🔄 Loading user data for:', user.email);

      // Test database connection
      const connectionOk = await supabaseService.testConnection();
      if (!connectionOk) {
        console.error('❌ Database connection failed');
        // Continue with empty data for now
        setContacts([]);
        return;
      }

      console.log('✅ Database connection successful');

      // Load user agents from Supabase
      const userAgents = await supabaseService.getUserAgents(user.id);
      console.log('📊 Loaded agents:', userAgents.length);

      // Transform Supabase data to AIContact format
      const transformedContacts: AIContact[] = userAgents.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        initials: agent.initials,
        color: agent.color,
        voice: agent.voice,
        avatar: agent.avatar_url,
        status: agent.status as 'online' | 'busy' | 'offline',
        lastSeen: formatLastSeen(agent.last_seen, agent.last_used_at),
        total_messages: agent.total_messages,
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
          uploadedAt: new Date(doc.uploaded_at),
          content: doc.content || '',
          summary: doc.summary,
          extractedText: doc.extracted_text,
          metadata: doc.metadata || {}
        }))
      }));

      setContacts(transformedContacts);
      
      // Initialize integrations
      transformedContacts.forEach(contact => {
        if (contact.integrations) {
          contact.integrations.forEach(integrationInstance => {
            const integration = getIntegrationById(integrationInstance.integrationId);
            if (integration && integrationInstance.config.enabled && integration.category !== 'action') {
              integrationsService.startPeriodicExecution(
                contact.id, 
                integration, 
                integrationInstance.config, 
                (contactId, data) => {
                  console.log(`Integration data updated for contact ${contactId}`);
                }
              );
            }
          });
        }
      });

      console.log('✅ User data loaded successfully');

    } catch (error) {
      console.error('❌ Error loading user data:', error);
      // Set empty contacts on error
      setContacts([]);
    } finally {
      setDataLoading(false);
    }
  };

  const formatLastSeen = (lastSeen: string, lastUsedAt: string | null): string => {
    if (lastSeen === 'now') return 'now';
    
    if (lastUsedAt) {
      const lastUsed = new Date(lastUsedAt);
      const now = new Date();
      const diffMs = now.getTime() - lastUsed.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return lastUsed.toLocaleDateString();
    }

    return lastSeen;
  };

  const handleGetStarted = () => {
    setCurrentView('signup');
  };

  const handleSignUp = () => {
    setCurrentView('signup');
  };

  const handleSignIn = () => {
    setCurrentView('login');
  };

  const handleSignupSuccess = () => {
    setCurrentView('pricing');
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
  };

  const handleSelectPlan = (plan: string) => {
    // Here you would implement the logic to set the user's plan
    console.log(`Selected plan: ${plan}`);
    // For now, just redirect to dashboard
    setCurrentView('dashboard');
  };

  const handleStayFree = () => {
    // User chooses to stay with the free plan
    setCurrentView('dashboard');
  };

  const handleChatClick = async (contact: AIContact) => {
    setSelectedContact(contact);
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
    if (callState.isActive && callState.status !== 'ended') {
      handleEndCall();
      setTimeout(() => {
        startNewCall(contact);
      }, 200);
    } else {
      startNewCall(contact);
    }
  };

  const startNewCall = (contact: AIContact) => {
    setSelectedContact(contact);
    setCallState({
      isActive: true,
      duration: 0,
      isMuted: false,
      status: 'connecting'
    });
    setCurrentView('call');
    
    geminiLiveService.initialize().then(initialized => {
      if (initialized) {
        geminiLiveService.startSession(contact).then(() => {
          setTimeout(() => {
            setCallState(prev => ({ ...prev, status: 'connected' }));
          }, 2000);
        });
      } else {
        setTimeout(() => {
          setCallState(prev => ({ ...prev, status: 'ended' }));
          handleEndCall();
        }, 2000);
      }
    });
  };

  const handleEndCall = () => {
    geminiLiveService.endSession();
    setCallState({
      isActive: false,
      duration: 0,
      isMuted: false,
      status: 'ended'
    });
    setCurrentView('dashboard');
    setSelectedContact(null);
  };

  const handleToggleMute = () => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const handleSettingsClick = (contact?: AIContact) => {
    if (contact) {
      setSelectedContact(contact);
      setCurrentView('settings');
    }
  };

  const handleNewChatClick = async (contact: AIContact) => {
    // Clear messages for this contact to start fresh
    const otherMessages = messages.filter(m => m.contactId !== contact.id);
    setMessages(otherMessages);
    
    // Clear conversation documents for this contact
    setConversationDocuments(prev => {
      const updated = { ...prev };
      delete updated[contact.id];
      return updated;
    });
    
    handleChatClick(contact);
  };

  const handleBack = () => {
    if (currentView === 'call') {
      handleEndCall();
    } else {
      setCurrentView('dashboard');
      setSelectedContact(null);
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

  const handleSendMessage = async (content: string, documents?: DocumentInfo[]) => {
    if (!selectedContact) return;

    const existingConversationDocs = conversationDocuments[selectedContact.id] || [];

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      contactId: selectedContact.id,
      attachments: documents
    };

    setMessages(prev => [...prev, userMessage]);

    // Add new documents to conversation documents
    if (documents && documents.length > 0) {
      try {
        console.log(`💾 Saving ${documents.length} conversation documents to Supabase`);
        
        // Save each document to Supabase
        for (const doc of documents) {
          await documentContextService.saveConversationDocument(selectedContact, doc);
        }
        
        const updatedConversationDocs = [...existingConversationDocs];
        
        documents.forEach(newDoc => {
          if (!updatedConversationDocs.find(doc => doc.id === newDoc.id)) {
            updatedConversationDocs.push(newDoc);
          }
        });
        
        setConversationDocuments(prev => ({
          ...prev,
          [selectedContact.id]: updatedConversationDocs
        }));
        
        console.log(`✅ Saved conversation documents to Supabase`);
      } catch (error) {
        console.error('❌ Failed to save conversation documents:', error);
        // Continue with the conversation even if document saving fails
      }
    }

    try {
      // Get conversation history for this contact
      const contactMessages = messages.filter(m => m.contactId === selectedContact.id);
      const chatHistory = [...contactMessages, userMessage];

      // Get fresh document context from Supabase for AI
      const documentContext = await documentContextService.getAgentDocumentContext(selectedContact);

      // Generate AI response using the enhanced service
      const response = await geminiService.generateResponse(
        selectedContact,
        content,
        chatHistory,
        documentContext.allDocuments
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, aiMessage]);

      // Update contact's last used timestamp in Supabase
      if (user) {
        try {
          await supabaseService.updateUserAgent(selectedContact.id, {
            last_used_at: new Date().toISOString(),
            last_seen: 'now'
          });

          // Update local state
          setContacts(prev => prev.map(contact => 
            contact.id === selectedContact.id 
              ? { ...contact, lastSeen: 'now' }
              : contact
          ));
        } catch (error) {
          console.warn('Failed to update agent last used time:', error);
        }
      }

    } catch (error) {
      console.error('Error generating AI response:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        sender: 'ai',
        timestamp: new Date(),
        contactId: selectedContact.id
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSaveContact = async (contact: AIContact) => {
    try {
      if (!user) {
        console.error('No user found for saving contact');
        return;
      }

      console.log('💾 Saving contact:', contact.name);

      // Check if this is a new contact or existing one
      const existingContact = contacts.find(c => c.id === contact.id);
      
      if (existingContact && !contact.id.startsWith('temp_') && !contact.id.startsWith('new-')) {
        // Update existing contact in Supabase
        await supabaseService.updateUserAgent(contact.id, {
          name: contact.name,
          description: contact.description,
          initials: contact.initials,
          color: contact.color,
          voice: contact.voice,
          avatar_url: contact.avatar,
          status: contact.status
        });

        // Handle integrations updates
        if (contact.integrations) {
          // For simplicity, we'll delete all existing integrations and recreate them
          if (existingContact?.integrations) {
            for (const integration of existingContact.integrations) {
              try {
                await supabaseService.deleteAgentIntegration(integration.id);
              } catch (error) {
                console.error(`Failed to delete integration ${integration.id}:`, error);
              }
            }
          }

          // Create new integrations
          const savedIntegrations = [];
          for (const integration of contact.integrations) {
            try {
              const savedIntegration = await supabaseService.createAgentIntegration(contact.id, integration);
              savedIntegrations.push({
                id: savedIntegration.id,
                integrationId: integration.integrationId,
                name: integration.name,
                config: integration.config,
                status: savedIntegration.status
              });
            } catch (error) {
              console.error(`Failed to save integration ${integration.name}:`, error);
            }
          }
          
          contact.integrations = savedIntegrations;
        }

        // Handle documents updates
        if (contact.documents) {
          // For simplicity, we'll delete all existing documents and recreate them
          if (existingContact?.documents) {
            for (const document of existingContact.documents) {
              try {
                await supabaseService.deleteAgentDocument(document.id);
              } catch (error) {
                console.error(`Failed to delete document ${document.id}:`, error);
              }
            }
          }

          // Create new documents
          const savedDocuments = [];
          for (const document of contact.documents) {
            try {
              const savedDocument = await supabaseService.createAgentDocument(contact.id, document);
              savedDocuments.push({
                id: savedDocument.id,
                name: document.name,
                type: document.type,
                size: document.size,
                uploadedAt: new Date(savedDocument.uploaded_at),
                content: document.content,
                summary: document.summary,
                extractedText: document.extractedText,
                metadata: document.metadata
              });
            } catch (error) {
              console.error(`Failed to save document ${document.name}:`, error);
            }
          }
          
          contact.documents = savedDocuments;
        }

        console.log('✅ Updated existing contact in Supabase');
      } else {
        // Create new contact in Supabase
        const newAgent = await supabaseService.createUserAgent(user.id, contact);
        contact.id = newAgent.id; // Update with the database ID

        // Save integrations if any
        if (contact.integrations && contact.integrations.length > 0) {
          const savedIntegrations = [];
          for (const integration of contact.integrations) {
            try {
              const savedIntegration = await supabaseService.createAgentIntegration(newAgent.id, integration);
              savedIntegrations.push({
                id: savedIntegration.id,
                integrationId: integration.integrationId,
                name: integration.name,
                config: integration.config,
                status: savedIntegration.status
              });
            } catch (integrationError) {
              console.error(`Failed to save integration ${integration.name}:`, integrationError);
            }
          }
          
          contact.integrations = savedIntegrations;
        }

        // Save documents if any
        if (contact.documents && contact.documents.length > 0) {
          const savedDocuments = [];
          for (const document of contact.documents) {
            try {
              const savedDocument = await supabaseService.createAgentDocument(newAgent.id, document);
              savedDocuments.push({
                id: savedDocument.id,
                name: document.name,
                type: document.type,
                size: document.size,
                uploadedAt: new Date(savedDocument.uploaded_at),
                content: document.content,
                summary: document.summary,
                extractedText: document.extractedText,
                metadata: document.metadata
              });
            } catch (documentError) {
              console.error(`Failed to save document ${document.name}:`, documentError);
            }
          }
          
          contact.documents = savedDocuments;
        }
        
        console.log('✅ Created new contact in Supabase with ID:', newAgent.id);
      }

      // Update local state
      setContacts(prev => {
        const existingIndex = prev.findIndex(c => c.id === contact.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = contact;
          return updated;
        } else {
          return [...prev, contact];
        }
      });

      // Restart integrations with new configuration
      if (contact.integrations) {
        contact.integrations.forEach(integrationInstance => {
          const integration = getIntegrationById(integrationInstance.integrationId);
          if (integration && integrationInstance.config.enabled && integration.category !== 'action') {
            integrationsService.startPeriodicExecution(
              contact.id, 
              integration, 
              integrationInstance.config, 
              (contactId, data) => {
                console.log(`Integration data updated for contact ${contactId}`);
              }
            );
          }
        });
      }

      setSelectedContact(contact);
      console.log('✅ Contact saved successfully');

    } catch (error) {
      console.error('❌ Error saving contact:', error);
      alert('Failed to save contact. Please try again.');
    }
  };

  const handleCreateNewAgent = () => {
    const newAgent: AIContact = {
      id: `temp_${Date.now()}`, // Temporary ID, will be replaced when saved
      name: 'New AI Assistant',
      description: 'A helpful AI assistant ready to be customized.',
      initials: 'AI',
      color: '#3b82f6',
      status: 'online',
      lastSeen: 'now',
      voice: 'Puck'
    };
    
    setSelectedContact(newAgent);
    setCurrentView('settings');
  };

  // Loading state
  if (loading || dataLoading) {
    return (
      <div className="h-screen bg-glass-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#186799] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">
            {loading ? 'Loading...' : 'Loading your AI agents...'}
          </p>
          {dataLoading && (
            <p className="text-slate-400 text-sm mt-2">
              Connecting to database...
            </p>
          )}
        </div>
      </div>
    );
  }

  // If not authenticated, show landing page or signup page based on currentView
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