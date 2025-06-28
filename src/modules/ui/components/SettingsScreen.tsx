import React, { useState } from 'react';
import { ArrowLeft, Save, Palette, User, FileText, Settings as SettingsIcon, Upload, Trash2, Plus, Database, Volume2, ChevronDown } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { DocumentInfo } from '../../fileManagement/types/documents';
import { Integration, IntegrationConfig, IntegrationInstance } from '../../integrations/types/integrations';
import DocumentUpload, { DocumentList } from './DocumentUpload';
import IntegrationsLibrary from './IntegrationsLibrary';
import IntegrationSetup from './IntegrationSetup';
import { getIntegrationById } from '../../integrations/data/integrations';

interface SettingsScreenProps {
  contact: AIContact;
  onBack: () => void;
  onSave: (contact: AIContact) => void;
}

const availableColors = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple  
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
];

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

export default function SettingsScreen({ contact, onBack, onSave }: SettingsScreenProps) {
  const [formData, setFormData] = useState({
    name: contact.name,
    description: contact.description,
    color: contact.color,
    voice: contact.voice || 'Puck', // Default to Puck if no voice is set
    avatar: contact.avatar || '',
  });

  const [integrations, setIntegrations] = useState<IntegrationInstance[]>(contact.integrations || []);
  const [documents, setDocuments] = useState<DocumentInfo[]>(contact.documents || []);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'integrations' | 'documents'>('basic');
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Integration setup state
  const [showIntegrationsLibrary, setShowIntegrationsLibrary] = useState(false);
  const [setupIntegration, setSetupIntegration] = useState<Integration | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationInstance | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

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

  const handleClearAllDocuments = () => {
    if (confirm('Are you sure you want to remove all documents? This action cannot be undone.')) {
      setDocuments([]);
      setHasChanges(true);
    }
  };

  const handleSelectIntegration = (integration: Integration) => {
    setSetupIntegration(integration);
    setShowIntegrationsLibrary(false);
  };

  const handleSaveIntegration = (config: IntegrationConfig) => {
    const integrationInstance: IntegrationInstance = {
      id: Date.now().toString(),
      integrationId: config.integrationId,
      name: `${getIntegrationById(config.integrationId)?.name} - ${contact.name}`,
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
    if (confirm('Are you sure you want to remove this integration?')) {
      setIntegrations(prev => prev.filter(int => int.id !== integrationId));
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    const updatedContact: AIContact = {
      ...contact,
      name: formData.name.trim(),
      description: formData.description.trim(),
      color: formData.color,
      initials: formData.name.trim().split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
      integrations: integrations.length > 0 ? integrations : undefined,
      documents: documents.length > 0 ? documents : undefined,
      voice: formData.voice,
      avatar: formData.avatar || undefined,
    };
    
    onSave(updatedContact);
    setHasChanges(false);
  };

  const handleColorSelect = (color: string) => {
    handleInputChange('color', color);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Please select an image file (PNG, JPG, etc.)');
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Image must be smaller than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        handleInputChange('avatar', base64);
        setUploadError(null);
      };
      reader.onerror = () => {
        setUploadError('Failed to read the image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    handleInputChange('avatar', '');
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

  // Show integration setup modal
  if (setupIntegration) {
    return (
      <div className="h-full bg-glass-bg flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
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
      <div className="h-full bg-glass-bg flex flex-col">
        <div className="bg-glass-panel glass-effect border-b border-slate-700 p-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Add Integration</h1>
          <button
            onClick={() => setShowIntegrationsLibrary(false)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          <IntegrationsLibrary 
            onSelectIntegration={handleSelectIntegration}
            selectedIntegrations={integrations.map(int => int.integrationId)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-glass-bg flex flex-col">
      {/* Header */}
      <div className="bg-glass-panel glass-effect border-b border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-xl font-semibold text-white">Contact Settings</h1>
        </div>
        
        {hasChanges && (
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-glass-panel glass-effect border-b border-slate-700 px-4">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${
              activeTab === 'basic'
                ? 'text-blue-400 border-blue-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Persona</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${
              activeTab === 'integrations'
                ? 'text-blue-400 border-blue-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Integrations ({integrations.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 ${
              activeTab === 'documents'
                ? 'text-blue-400 border-blue-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Documents ({documents.length})</span>
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {activeTab === 'basic' ? (
            <>
              {/* Contact Preview */}
              <div className="bg-glass-panel glass-effect rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Preview</span>
                </h2>
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden">
                    {formData.avatar ? (
                      <img
                        src={formData.avatar}
                        alt="Profile"
                        className="w-full h-full object-cover rounded-xl"
                      />
                                         ) : (
                       <div
                         className="w-full h-full rounded-xl"
                         style={{ background: createAgentGradient(formData.color) }}
                       />
                     )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{formData.name || 'AI Assistant'}</h3>
                    <p className="text-slate-400">{formData.description || 'No description provided'}</p>
                  </div>
                </div>
              </div>

              {/* Avatar Upload */}
              <div className="bg-glass-panel glass-effect rounded-xl p-6 border border-slate-700">
                <label className="block text-sm font-medium text-white mb-4 flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Profile Picture</span>
                </label>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors duration-200"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Image</span>
                    </label>
                    {formData.avatar && (
                      <button
                        onClick={handleRemoveAvatar}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-red-400 text-sm">{uploadError}</p>
                  )}
                  <p className="text-slate-400 text-sm">
                    Upload a PNG, JPG, or other image file. Maximum size: 5MB.
                  </p>
                </div>
              </div>

              {/* Name Field */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <label className="block text-sm font-medium text-white mb-3 flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Contact Name</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter contact name"
                  className="w-full bg-glass-panel glass-effect text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200"
                />
              </div>

              {/* Description Field */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <label className="block text-sm font-medium text-white mb-3 flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Description</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe this AI's personality and capabilities..."
                  rows={4}
                  className="w-full bg-glass-panel glass-effect text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200 resize-none"
                />
              </div>

              {/* Color Selection */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <label className="block text-sm font-medium text-white mb-4 flex items-center space-x-2">
                  <Palette className="w-4 h-4" />
                  <span>Avatar Color</span>
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={`w-12 h-12 rounded-lg transition-all duration-200 hover:scale-110 ${
                        formData.color === color 
                          ? 'ring-4 ring-white ring-opacity-50 scale-110' 
                          : 'hover:ring-2 hover:ring-white hover:ring-opacity-30'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Voice Selection */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <label className="block text-sm font-medium text-white mb-4 flex items-center space-x-2">
                  <Volume2 className="w-4 h-4" />
                  <span>Voice</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.voice}
                    onChange={(e) => handleInputChange('voice', e.target.value)}
                    className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200 text-sm appearance-none cursor-pointer"
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
            </>
          ) : activeTab === 'integrations' ? (
            <>
              {/* Integrations Header */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-white" />
                    <h2 className="text-lg font-semibold text-white">Data Integrations</h2>
                  </div>
                  <button
                    onClick={() => setShowIntegrationsLibrary(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Integration</span>
                  </button>
                </div>
                <p className="text-slate-400 text-sm">
                  Connect this AI to external data sources to enhance its knowledge and capabilities.
                </p>
              </div>

              {/* Active Integrations */}
              {integrations.length > 0 ? (
                <div className="space-y-4">
                  {integrations.map((integration) => {
                    const integrationDef = getIntegrationById(integration.integrationId);
                    if (!integrationDef) return null;

                    return (
                      <div key={integration.id} className="bg-glass-panel glass-effect rounded-xl p-6 border border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div
                              className="p-2 rounded-lg"
                              style={{ backgroundColor: integrationDef.color + '20', color: integrationDef.color }}
                            >
                              <Database className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{integrationDef.name}</h3>
                              <p className="text-slate-400 text-sm">{integrationDef.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditIntegration(integration)}
                              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors duration-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveIntegration(integration.id)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors duration-200"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-400">Trigger:</span>
                            <span className="text-white ml-2 capitalize">{integration.config.trigger}</span>
                          </div>
                          {integration.config.intervalMinutes && (
                            <div>
                              <span className="text-slate-400">Interval:</span>
                              <span className="text-white ml-2">{integration.config.intervalMinutes} minutes</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-400">Status:</span>
                            <span className={`ml-2 capitalize ${
                              integration.status === 'active' ? 'text-green-400' : 
                              integration.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {integration.status}
                            </span>
                          </div>
                        </div>

                        {integration.config.description && (
                          <div className="mt-3 pt-3 border-t border-slate-700">
                            <p className="text-slate-300 text-sm">{integration.config.description}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-glass-panel glass-effect rounded-xl p-8 border border-slate-700 text-center">
                  <Database className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400 mb-4">No integrations configured</p>
                  <button
                    onClick={() => setShowIntegrationsLibrary(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Your First Integration</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Documents Tab */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-white" />
                    <h2 className="text-lg font-semibold text-white">Document Library</h2>
                  </div>
                  {documents.length > 0 && (
                    <button
                      onClick={handleClearAllDocuments}
                      className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>
                <p className="text-slate-400 text-sm mb-4">
                  Upload documents that this AI can reference and analyze. Supported formats include text files, code, JSON, CSV, and more.
                </p>
                
                {uploadError && (
                  <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg">
                    <p className="text-red-300 text-sm">{uploadError}</p>
                  </div>
                )}
                
                <DocumentUpload
                  onDocumentUploaded={handleDocumentUploaded}
                  onError={handleDocumentError}
                  className="mb-6"
                />
                
                <DocumentList
                  documents={documents}
                  onRemoveDocument={handleRemoveDocument}
                />
                
                {documents.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No documents uploaded yet</p>
                    <p className="text-sm">Upload files to enhance this AI's knowledge base</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Save Button (Mobile) */}
          {hasChanges && (
            <div className="md:hidden">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-semibold"
              >
                <Save className="w-5 h-5" />
                <span>Save Changes</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}