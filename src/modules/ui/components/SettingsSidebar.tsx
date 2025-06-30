import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Save, User, Database, FileText, Plus, Trash2, Settings, X, Upload, Volume2, AlertTriangle } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { DocumentInfo } from '../../fileManagement/types/documents';
import { IntegrationInstance } from '../../integrations/types/integrations';
import { getIntegrationById } from '../../integrations/data/integrations';
import DocumentUpload, { DocumentList } from './DocumentUpload';
import IntegrationsLibrary from './IntegrationsLibrary';
import IntegrationSetup from './IntegrationSetup';
import { Integration, IntegrationConfig } from '../../integrations/types/integrations';
import { supabase } from '../../database/lib/supabase';

interface SettingsSidebarProps {
  contact: AIContact | null;
  onSave: (contact: AIContact) => void;
  onClose?: () => void;
  onDelete?: (contactId: string) => void;
  className?: string;
}

export default function SettingsSidebar({ contact, onSave, onClose, onDelete, className = '' }: SettingsSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    integrations: true,
    documents: true,
    danger: false
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    voice: 'Puck'
  });

  // Available voices from Gemini Live API
  const availableVoices = [
    { id: 'Puck', name: 'Puck', description: 'Playful and energetic', gender: 'Male' },
    { id: 'Charon', name: 'Charon', description: 'Deep and mysterious', gender: 'Male' },
    { id: 'Kore', name: 'Kore', description: 'Warm and friendly', gender: 'Female' },
    { id: 'Fenrir', name: 'Fenrir', description: 'Strong and confident', gender: 'Male' },
    { id: 'Aoede', name: 'Aoede', description: 'Melodic and soothing', gender: 'Female' },
    { id: 'Leda', name: 'Leda', description: 'Gentle and calm', gender: 'Female' },
    { id: 'Orus', name: 'Orus', description: 'Clear and articulate', gender: 'Male' },
    { id: 'Zephyr', name: 'Zephyr', description: 'Light and airy', gender: 'Female' }
  ];

  const [integrations, setIntegrations] = useState<IntegrationInstance[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Integration setup state
  const [showIntegrationsLibrary, setShowIntegrationsLibrary] = useState(false);
  const [setupIntegration, setSetupIntegration] = useState<Integration | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationInstance | null>(null);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Update form data when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        description: contact.description,
        voice: contact.voice || 'Puck'
      });
      setIntegrations(contact.integrations || []);
      setDocuments(contact.documents || []);
      setHasChanges(false);
      setDeleteConfirmation('');
    }
  }, [contact]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!contact) return;

    const updatedContact: AIContact = {
      ...contact,
      name: formData.name.trim(),
      description: formData.description.trim(),
      voice: formData.voice,
      initials: formData.name.trim().split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
      integrations: integrations.length > 0 ? integrations : undefined,
      documents: documents.length > 0 ? documents : undefined
    };
    
    onSave(updatedContact);
    setHasChanges(false);
  };

  const handleDeleteAgent = async () => {
    if (!contact || deleteConfirmation !== contact.name || isDeleting) return;

    try {
      setIsDeleting(true);
      console.log(`Deleting agent: ${contact.id}`);

      // Delete from Supabase
      const { error } = await supabase
        .from('user_agents')
        .delete()
        .eq('id', contact.id);

      if (error) {
        console.error('Error deleting agent:', error);
        alert('Failed to delete agent. Please try again.');
        return;
      }

      console.log('Agent deleted successfully');
      
      // Call the onDelete callback if provided
      if (onDelete) {
        onDelete(contact.id);
      }
      
      // Close sidebar
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation('');
    }
  };

  // Document handlers
  const handleDocumentUploaded = (document: DocumentInfo) => {
    setDocuments(prev => [...prev, document]);
    setHasChanges(true);
    setUploadError(null);
  };

  const handleDocumentError = (error: string) => {
    setUploadError(error);
  };

  const handleRemoveDocument = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    setHasChanges(true);
  };

  // Integration handlers
  const handleSelectIntegration = (integration: Integration) => {
    setSetupIntegration(integration);
    setShowIntegrationsLibrary(false);
  };

  const handleSaveIntegration = (config: IntegrationConfig) => {
    const integrationInstance: IntegrationInstance = {
      id: Date.now().toString(),
      integrationId: config.integrationId,
      name: `${getIntegrationById(config.integrationId)?.name} - ${contact?.name}`,
      config,
      status: 'active'
    };

    if (editingIntegration) {
      setIntegrations(prev => prev.map(int => 
        int.id === editingIntegration.id ? { ...integrationInstance, id: editingIntegration.id } : int
      ));
    } else {
      setIntegrations(prev => [...prev, integrationInstance]);
    }

    setSetupIntegration(null);
    setEditingIntegration(null);
    setHasChanges(true);
  };

  const handleEditIntegration = (integrationInstance: IntegrationInstance) => {
    const integration = getIntegrationById(integrationInstance.integrationId);
    if (integration) {
      setSetupIntegration(integration);
      setEditingIntegration(integrationInstance);
    }
  };

  const handleRemoveIntegration = (integrationId: string) => {
    if (confirm('Remove this integration?')) {
      setIntegrations(prev => prev.filter(int => int.id !== integrationId));
      setHasChanges(true);
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

  if (!contact) {
    return (
      <div className={`h-full bg-glass-panel glass-effect flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <Settings className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 font-inter">Select a contact to view settings</p>
        </div>
      </div>
    );
  }

  // Show integration setup modal
  if (setupIntegration) {
    return (
      <div className={`h-full bg-glass-panel glass-effect flex flex-col ${className}`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-semibold font-inter">Setup Integration</h3>
          <button
            onClick={() => {
              setSetupIntegration(null);
              setEditingIntegration(null);
            }}
            className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-md mx-auto">
            <IntegrationSetup
              integration={setupIntegration}
              existingConfig={editingIntegration?.config}
              onSave={handleSaveIntegration}
              onCancel={() => {
                setSetupIntegration(null);
                setEditingIntegration(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show integrations library modal
  if (showIntegrationsLibrary) {
    return (
      <div className={`h-full bg-glass-panel glass-effect flex flex-col ${className}`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-semibold font-inter">Add Integration</h3>
          <button
            onClick={() => setShowIntegrationsLibrary(false)}
            className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-md mx-auto">
            <IntegrationsLibrary 
              onSelectIntegration={handleSelectIntegration}
              selectedIntegrations={integrations.map(int => int.integrationId)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full bg-glass-panel glass-effect flex flex-col font-inter ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-glass-panel glass-effect">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
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
            <div className="min-w-0 flex-1">
              <h2 className="text-white font-semibold truncate">{contact.name}</h2>
              <p className="text-slate-400 text-xs">Settings</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <button
                onClick={handleSave}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full transition-colors duration-200 text-sm"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Content - Scrollable */}
      <div className="flex-1 overflow-y-auto bg-glass-panel glass-effect">
        {/* Basic Info Section */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('basic')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-white font-medium">Persona</span>
            </div>
            {expandedSections.basic ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.basic && (
            <div className="px-4 pb-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full bg-glass-panel glass-effect text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full bg-glass-panel glass-effect text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 text-sm resize-none"
                />
              </div>

              {/* Voice */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center space-x-1">
                  <Volume2 className="w-3 h-3" />
                  <span>Voice</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.voice}
                    onChange={(e) => handleInputChange('voice', e.target.value)}
                    className="w-full bg-glass-panel glass-effect text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 text-sm appearance-none cursor-pointer"
                  >
                    {availableVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} ({voice.gender}) - {voice.description}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Integrations Section */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('integrations')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-white font-medium">Integrations</span>
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {integrations.length}
              </span>
            </div>
            {expandedSections.integrations ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.integrations && (
            <div className="px-4 pb-4 space-y-3">
              <button
                onClick={() => setShowIntegrationsLibrary(true)}
                className="w-full flex items-center justify-center space-x-2 p-2 border border-dashed border-slate-600 rounded-lg hover:border-slate-500 hover:bg-white/5 transition-colors duration-200 text-sm"
              >
                <Plus className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">Add Integration</span>
              </button>

              {integrations.map((integration) => {
                const integrationDef = getIntegrationById(integration.integrationId);
                if (!integrationDef) return null;

                return (
                  <div key={integration.id} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: integrationDef.color + '20', color: integrationDef.color }}
                        >
                          <Database className="w-3 h-3" />
                        </div>
                        <span className="text-white text-sm font-medium truncate">{integrationDef.name}</span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          onClick={() => handleEditIntegration(integration)}
                          className="p-1 hover:bg-slate-600 rounded text-xs text-slate-400 hover:text-white transition-colors duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveIntegration(integration.id)}
                          className="p-1 hover:bg-slate-600 rounded text-xs text-red-400 hover:text-red-300 transition-colors duration-200"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Documents Section */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('documents')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-white font-medium">Documents</span>
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {documents.length}
              </span>
            </div>
            {expandedSections.documents ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.documents && (
            <div className="px-4 pb-4 space-y-3">
              {uploadError && (
                <div className="p-2 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-300 text-xs">
                  {uploadError}
                </div>
              )}
              
              <DocumentUpload
                onDocumentUploaded={handleDocumentUploaded}
                onError={handleDocumentError}
                className="text-xs"
              />
              
              <DocumentList
                documents={documents}
                onRemoveDocument={handleRemoveDocument}
                className="text-xs"
              />
              
              {documents.length === 0 && (
                <div className="text-center py-4 text-slate-500">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No documents uploaded</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Danger Zone Section */}
        <div>
          <button
            onClick={() => toggleSection('danger')}
            className="w-full p-4 flex items-center justify-between hover:bg-red-900/10 transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 font-medium">Danger Zone</span>
            </div>
            {expandedSections.danger ? (
              <ChevronDown className="w-4 h-4 text-red-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-red-400" />
            )}
          </button>
          
          {expandedSections.danger && (
            <div className="px-4 pb-4 space-y-4 bg-red-900/5 border-t border-red-700/30">
              <div className="pt-4">
                <h4 className="text-red-400 font-medium text-sm mb-2">Delete Agent</h4>
                <p className="text-slate-400 text-xs mb-3">
                  Permanently delete this agent and all associated data. This action cannot be undone.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-red-400 mb-2">
                      Type the agent name to confirm deletion:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder={contact.name}
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-red-700 focus:border-red-500 focus:outline-none transition-colors duration-200 text-sm"
                      disabled={isDeleting}
                    />
                    <p className="text-slate-500 text-xs mt-1">
                      Type "{contact.name}" exactly as shown above
                    </p>
                  </div>
                  
                  <button
                    onClick={handleDeleteAgent}
                    disabled={deleteConfirmation !== contact.name || isDeleting}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 text-sm"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3" />
                        <span>Delete Agent</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}