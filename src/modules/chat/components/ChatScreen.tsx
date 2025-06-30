import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Bot, Loader2, Paperclip, X, MessageSquarePlus, Phone, ChevronRight, ChevronLeft, MoreVertical, Settings } from 'lucide-react';
import { AIContact, Message } from '../../../core/types/types';
import { DocumentInfo } from '../../fileManagement/types/documents';
import DocumentUpload, { DocumentList } from '../../ui/components/DocumentUpload';
import { getIntegrationById } from '../../integrations/data/integrations';
import { useMobile } from '../../../core/hooks/useLocalStorage';

interface ChatScreenProps {
  contact: AIContact;
  messages: Message[];
  conversationDocuments: DocumentInfo[]; // All conversation documents accumulated over time
  onBack: () => void;
  onSendMessage: (content: string, documents?: DocumentInfo[]) => void;
  onSettingsClick: (contact: AIContact) => void;
  onNewChatClick: (contact: AIContact) => void;
  onCallClick: (contact: AIContact) => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export default function ChatScreen({ 
  contact, 
  messages, 
  conversationDocuments,
  onBack, 
  onSendMessage, 
  onSettingsClick, 
  onNewChatClick,
  onCallClick,
  showSidebar = true,
  onToggleSidebar
}: ChatScreenProps) {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<DocumentInfo[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Get active integrations
  const activeIntegrations = contact.integrations?.filter(i => i.status === 'active') || [];

  // Check if AI is currently generating a response
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.sender === 'user') {
      setIsTyping(true);
      // Set a timeout to stop typing indicator if no response comes
      const timeout = setTimeout(() => {
        setIsTyping(false);
      }, 10000); // 10 seconds timeout

      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim() || pendingDocuments.length > 0) {
      onSendMessage(inputValue.trim(), pendingDocuments.length > 0 ? pendingDocuments : undefined);
      setInputValue('');
      setPendingDocuments([]);
      setShowDocumentUpload(false);
      setUploadError(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDocumentUploaded = (document: DocumentInfo) => {
    setPendingDocuments(prev => [...prev, document]);
    setUploadError(null);
  };

  const handleDocumentError = (error: string) => {
    setUploadError(error);
  };

  const handleRemoveDocument = (documentId: string) => {
    setPendingDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const toggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  // Get document color based on file type
  const getDocumentColor = (doc: DocumentInfo) => {
    const extension = doc.name.toLowerCase().split('.').pop();
    
    if (extension === 'pdf' || doc.type.includes('pdf')) {
      return 'bg-red-700/30 text-red-300 border border-red-700/50'; // PDF - red
    } else if (['xlsx', 'xls', 'csv'].includes(extension || '') || doc.type.includes('spreadsheet') || doc.type.includes('excel') || doc.type.includes('csv')) {
      return 'bg-green-700/30 text-green-300 border border-green-700/50'; // Excel/spreadsheet - green
    } else if (['docx', 'doc'].includes(extension || '') || doc.type.includes('word') || doc.type.includes('document')) {
      return 'bg-blue-700/30 text-blue-300 border border-blue-700/50'; // Word/document - blue
    } else {
      return 'bg-slate-700/30 text-slate-300 border border-slate-700/50'; // Default - gray
    }
  };

  // Helper function to create radial gradient for agents without avatars
  const createAgentGradient = (color: string) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Create complementary color by shifting hue and make it lighter
    const compR = Math.round(255 - r * 0.3); // Softer complement
    const compG = Math.round(255 - g * 0.3);
    const compB = Math.round(255 - b * 0.3);
    
    // Make complementary color lighter than the main color
    const lightCompR = Math.round(compR + (255 - compR) * 0.8);
    const lightCompG = Math.round(compG + (255 - compG) * 0.8);
    const lightCompB = Math.round(compB + (255 - compB) * 0.8);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  // Helper function to get user bubble gradient based on agent color
  const getUserBubbleGradient = (color: string) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Create a subtle gradient using the agent's color
    const lightR = Math.round(r + (255 - r) * 0.2);
    const lightG = Math.round(g + (255 - g) * 0.2);
    const lightB = Math.round(b + (255 - b) * 0.2);
    
    return `linear-gradient(135deg, rgb(${r}, ${g}, ${b}) 0%, rgb(${lightR}, ${lightG}, ${lightB}) 100%)`;
  };

    // Helper function to render AI message with ChatGPT-style markdown support
  const renderAIMessage = (content: string) => {
    // Split content into paragraphs first
    const paragraphs = content.split(/\n\s*\n/);
    
    const formattedParagraphs = paragraphs.map((paragraph, index) => {
      // Apply markdown formatting to each paragraph
      let formattedContent = paragraph
        // Bold text: **text** or __text__
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
        .replace(/__(.*?)__/g, '<strong class="font-semibold">$1</strong>')
        // Italic text: *text* or _text_
        .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
        .replace(/_(.*?)_/g, '<em class="italic">$1</em>')
        // Code: `code`
        .replace(/`(.*?)`/g, '<code class="bg-slate-700 text-[#186799] px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
        // Single line breaks within paragraphs
        .replace(/\n/g, '<br>');

      // Return paragraph with proper spacing
      return `<p class="${index === 0 ? 'mt-0' : 'mt-5'} mb-2 last:mb-0">${formattedContent}</p>`;
    });

    return (
      <div 
        className="text-white prose prose-invert max-w-none break-words leading-7"
        style={{ 
          fontSize: '1rem',
          lineHeight: '1.75',
          color: 'var(--text-primary, #fff)'
        }}
        dangerouslySetInnerHTML={{ __html: formattedParagraphs.join('') }}
      />
    );
  };

  // Count total documents available to this AI
  const permanentDocuments = contact.documents?.length || 0;
  const totalConversationDocuments = conversationDocuments.length;
  const pendingDocumentsCount = pendingDocuments.length;

  // Header and input positioning - adjust for sidebar on desktop, full width on mobile
  const headerClass = isMobile ? "left-0 right-0" : (showSidebar ? "left-80 right-80" : "left-80 right-0");

  return (
    <div className="h-full bg-glass-bg flex flex-col font-inter">
      {/* Header - Fixed at top with glass effect and backdrop blur */}
      <div 
        className={`fixed top-0 ${headerClass} z-20 border-b border-slate-700 p-3 flex items-center space-x-3 ${isMobile ? 'safe-area-top' : ''}`}
        style={{
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          backgroundColor: 'rgba(2, 10, 22, 0.08)'
        }}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        
        <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
          {contact.avatar ? (
            <img
              src={contact.avatar}
              alt={contact.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div 
              className="w-full h-full rounded-lg"
              style={{ background: createAgentGradient(contact.color) }}
            />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold truncate">{contact.name}</h2>
          </div>
          <p className="text-slate-400 text-sm truncate mt-0.5 font-inter">
            {isTyping ? (
              <span className="flex items-center space-x-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Analyzing and typing...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <span>{contact.lastSeen}</span>
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onNewChatClick(contact)}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
            title="Start new conversation"
          >
            <MessageSquarePlus className="w-4 h-4 text-slate-400" />
          </button>
          
          <button
            onClick={() => onCallClick(contact)}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
            title="Start call"
          >
            <Phone className="w-4 h-4 text-slate-400" />
          </button>

          {isMobile ? (
            /* Mobile: Show settings button instead of three dots */
            <button
              onClick={() => onSettingsClick(contact)}
              className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
              title="Agent settings"
            >
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
          ) : (
            /* Desktop: Show three dots for sidebar toggle */
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
              title={showSidebar ? "Hide sidebar" : "Show sidebar"}
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area - Scrollable with padding for fixed input */}
      <div className={`flex-1 overflow-y-auto pt-20 pb-32 px-4 ${isMobile ? 'mobile-scroll' : ''}`}>
        <div className="p-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-24 h-24 rounded-xl mx-auto mb-6 flex items-center justify-center shadow-lg overflow-hidden">
                {contact.avatar ? (
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div 
                    className="w-full h-full rounded-xl"
                    style={{ background: createAgentGradient(contact.color) }}
                  />
                )}
              </div>
              <h3 className="text-white text-2xl font-semibold mb-3">{contact.name}</h3>
              <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed mb-6">
                {contact.description.length > 120 
                  ? `${contact.description.substring(0, 120)}...` 
                  : contact.description
                }
              </p>
              
              {/* Document and Integration Pills */}
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {contact.documents && contact.documents.slice(0, 5).map((doc) => (
                  <span key={doc.id} className={`px-2 py-1 ${getDocumentColor(doc)} rounded-full text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]`}>
                    {doc.name}
                  </span>
                ))}
                {contact.documents && contact.documents.length > 5 && (
                  <span className="px-2 py-1 bg-slate-700/30 text-slate-300 border border-slate-700/50 rounded-full text-xs">
                    +{contact.documents.length - 5} more
                  </span>
                )}
                
                {activeIntegrations.slice(0, 5).map((integration) => {
                  const integrationDef = getIntegrationById(integration.integrationId);
                  if (!integrationDef) return null;
                  return (
                    <span key={integration.id} className="px-2 py-1 rounded-full text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" style={{backgroundColor: `${integrationDef.color}30`, color: integrationDef.color, borderColor: `${integrationDef.color}80`, border: '1px solid'}}>
                      {integration.name}
                    </span>
                  );
                })}
                {activeIntegrations.length > 5 && (
                  <span className="px-2 py-1 bg-slate-700/30 text-slate-300 border border-slate-700/50 rounded-full text-xs">
                    +{activeIntegrations.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id}>
                {message.sender === 'user' ? (
                  // User message - bubble style with agent color gradient
                  <div className="flex justify-end">
                    <div
                      className="max-w-xs lg:max-w-md px-4 py-3 rounded-3xl text-white shadow-lg"
                      style={{ background: getUserBubbleGradient(contact.color) }}
                    >
                      <div 
                        className="prose prose-invert max-w-none break-words leading-7"
                        style={{ 
                          fontSize: '1rem',
                          lineHeight: '1.75',
                          color: '#fff'
                        }}
                      >
                        <p className="my-0">{message.content}</p>
                      </div>
                      
                      {/* Show attached documents (only newly attached in this message) */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-opacity-20 border-white">
                          <p className="text-xs opacity-75 mb-1">New documents shared:</p>
                          {message.attachments.map((doc) => (
                            <div key={doc.id} className="text-xs opacity-90 bg-black bg-opacity-20 rounded px-2 py-1 mb-1">
                              {doc.name} ({Math.round(doc.size / 1024)}KB)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // AI message - full width with padding, no background
                  <div className="w-full px-4 py-2">
                    {renderAIMessage(message.content)}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="w-full px-4 py-2">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-slate-400 text-sm">
                    AI analyzing{totalConversationDocuments > 0 ? ` ${totalConversationDocuments + permanentDocuments} docs` : ''}...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Document Upload Section - Show above input when expanded */}
      {showDocumentUpload && (
        <div className="relative z-10 p-4 bg-glass-bg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Upload Conversation Documents</h3>
            <button
              onClick={() => {
                setShowDocumentUpload(false);
                setUploadError(null);
              }}
              className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          
          <p className="text-slate-400 text-sm mb-4">
            These documents will be available throughout this conversation. For permanent knowledge, use Settings.
          </p>
          
          {uploadError && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg">
              <p className="text-red-300 text-sm">{uploadError}</p>
            </div>
          )}
          
          <DocumentUpload
            onDocumentUploaded={handleDocumentUploaded}
            onError={handleDocumentError}
            className="mb-4"
          />
          
          <DocumentList
            documents={pendingDocuments}
            onRemoveDocument={handleRemoveDocument}
          />
        </div>
      )}

      {/* Input Area - Fixed at bottom */}
      <div className={`fixed bottom-0 z-10 p-4 ${headerClass} ${isMobile ? 'safe-area-bottom' : ''}`}>
        <div className="relative">
          <div 
            className="relative flex items-center rounded-full border border-slate-600 focus-within:border-[#186799] transition-colors duration-200 shadow-lg"
            style={{
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              backgroundColor: 'rgba(2, 10, 22, 0.08)'
            }}
          >
            {/* File Upload Button - Inside input */}
            <button
              onClick={() => setShowDocumentUpload(!showDocumentUpload)}
              className={`ml-4 p-2 rounded-full transition-colors duration-200 ${
                showDocumentUpload || pendingDocuments.length > 0
                  ? 'text-[#186799] hover:text-[#1a5a7a]'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              title="Upload conversation documents"
            >
              <Paperclip className="w-4 h-4" />
              {pendingDocuments.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingDocuments.length}
                </span>
              )}
            </button>
            
            {/* Input Field - Smaller and scrollable */}
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message ${contact.name}...`}
                disabled={isTyping}
                className="w-full bg-transparent text-white px-4 py-3 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-400 resize-none max-h-24 overflow-y-auto"
                rows={1}
                style={{ minHeight: '42px' }}
              />
            </div>
            
            {/* Send Button - Inside input */}
            <button
              onClick={handleSend}
              disabled={(!inputValue.trim() && pendingDocuments.length === 0) || isTyping}
              className="mr-4 p-2 bg-[#186799] hover:bg-[#1a5a7a] disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-full transition-colors duration-200 flex items-center justify-center"
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          
          {/* Status indicators below input */}
          {(pendingDocuments.length > 0 || totalConversationDocuments > 0 || permanentDocuments > 0) && (
            <div className="mt-2 flex items-center justify-center space-x-4 text-xs">
              {pendingDocuments.length > 0 && (
                <span className="text-yellow-400">
                  {pendingDocuments.length} new document{pendingDocuments.length > 1 ? 's' : ''} ready to send
                </span>
              )}
              {totalConversationDocuments > 0 && (
                <span className="text-green-400">
                  {totalConversationDocuments} conversation document{totalConversationDocuments > 1 ? 's' : ''} available
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Show existing conversation documents */}
      {totalConversationDocuments > 0 && !showDocumentUpload && (
        <div className={`fixed bottom-20 z-10 p-4 ${headerClass}`}>
          <div 
            className="rounded-lg border border-slate-700 p-4"
            style={{
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              backgroundColor: 'rgba(2, 10, 22, 0.8)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white text-sm font-medium">Conversation Documents ({totalConversationDocuments})</h4>
              <button
                onClick={() => setShowDocumentUpload(true)}
                className="text-xs text-[#186799] hover:text-[#1a5a7a]"
              >
                Add more
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {conversationDocuments.slice(0, 5).map((doc) => (
                <div key={doc.id} className={`text-xs ${getDocumentColor(doc)} px-2 py-1 rounded-full`}>
                  {doc.name}
                </div>
              ))}
              {totalConversationDocuments > 5 && (
                <div className="text-xs text-slate-400 px-2 py-1">
                  +{totalConversationDocuments - 5} more
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}