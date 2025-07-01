import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff, Pause, Play, Settings } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { geminiLiveService } from '../services/geminiLiveService';
import { DocumentInfo } from '../../fileManagement/types/documents';
import DocumentDisplay from './DocumentDisplay';

interface CallScreenProps {
  contact: AIContact;
  onBack: () => void;
  onSettingsClick: (contact: AIContact) => void;
}

export default function CallScreen({ contact, onBack, onSettingsClick }: CallScreenProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [currentDocument, setCurrentDocument] = useState<DocumentInfo | null>(null);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to create radial gradient for agents without avatars
  const createAgentGradient = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const compR = Math.round(255 - r * 0.3);
    const compG = Math.round(255 - g * 0.3);
    const compB = Math.round(255 - b * 0.3);
    
    const lightCompR = Math.round(compR + (255 - compR) * 0.8);
    const lightCompG = Math.round(compG + (255 - compG) * 0.8);
    const lightCompB = Math.round(compB + (255 - compB) * 0.8);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  useEffect(() => {
    // Initialize the call when component mounts
    startCall();

    return () => {
      // Cleanup when component unmounts
      endCall();
    };
  }, []);

  const startCall = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      console.log('Starting call with contact:', contact.name);
      
      // Initialize Gemini Live service
      await geminiLiveService.initialize({
        voice: contact.voice || 'Puck',
        systemInstructions: contact.description,
        documents: contact.documents || [],
        onDocumentReference: setCurrentDocument,
        onSpeakingStateChange: setIsAISpeaking
      });

      // Start the call
      await geminiLiveService.startCall();
      
      setIsConnected(true);
      setIsConnecting(false);
      
      // Start call duration timer
      callStartTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start call:', error);
      setConnectionError(error.message || 'Failed to start call');
      setIsConnecting(false);
    }
  };

  const endCall = async () => {
    try {
      await geminiLiveService.endCall();
      setIsConnected(false);
      
      // Clear duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      callStartTimeRef.current = null;
      setCallDuration(0);
      
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const toggleMute = async () => {
    try {
      if (isMuted) {
        await geminiLiveService.unmute();
      } else {
        await geminiLiveService.mute();
      }
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const togglePause = async () => {
    try {
      if (isPaused) {
        await geminiLiveService.resume();
        setIsPaused(false);
      } else {
        await geminiLiveService.pause();
        setIsPaused(true);
      }
    } catch (error) {
      console.error('Error toggling pause:', error);
    }
  };

  const handleEndCall = async () => {
    await endCall();
    onBack();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex flex-col">
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Voice Call</h1>
          {isConnected && (
            <p className="text-slate-400 text-sm">{formatDuration(callDuration)}</p>
          )}
        </div>

        <button
          onClick={() => onSettingsClick(contact)}
          className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
        >
          <Settings className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Contact Avatar */}
        <div className="relative mb-8">
          <div 
            className={`w-48 h-48 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
              isAISpeaking ? 'ring-4 ring-[#186799] ring-opacity-50 scale-105' : ''
            }`}
          >
            {contact.avatar ? (
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div 
                className="w-full h-full rounded-full"
                style={{ background: createAgentGradient(contact.color) }}
              />
            )}
          </div>
          
          {/* Speaking indicator */}
          {isAISpeaking && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-[#186799] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[#186799] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-[#186799] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">{contact.name}</h2>
          <p className="text-slate-400 text-lg mb-4">{contact.description}</p>
          
          {/* Connection Status */}
          {isConnecting && (
            <div className="flex items-center justify-center space-x-2 text-yellow-400">
              <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Connecting...</span>
            </div>
          )}
          
          {connectionError && (
            <div className="text-red-400 text-sm">
              {connectionError}
            </div>
          )}
          
          {isConnected && !isPaused && (
            <div className="text-green-400 text-sm">
              Connected • {contact.voice || 'Puck'} voice
            </div>
          )}
          
          {isPaused && (
            <div className="text-yellow-400 text-sm">
              Call paused
            </div>
          )}
        </div>

        {/* Document Display */}
        {currentDocument && (
          <div className="mb-8 w-full max-w-md">
            <DocumentDisplay document={currentDocument} />
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="p-8">
        <div className="flex items-center justify-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            disabled={!isConnected}
            className={`p-4 rounded-full transition-all duration-200 ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-700 hover:bg-slate-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Pause/Resume Button */}
          <button
            onClick={togglePause}
            disabled={!isConnected}
            className={`p-4 rounded-full transition-all duration-200 ${
              isPaused
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-slate-700 hover:bg-slate-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isPaused ? 'Resume AI' : 'Pause AI'}
          >
            {isPaused ? (
              <Play className="w-6 h-6 text-white" />
            ) : (
              <Pause className="w-6 h-6 text-white" />
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all duration-200"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Control Labels */}
        <div className="flex items-center justify-center space-x-6 mt-4">
          <span className="text-slate-400 text-sm w-16 text-center">
            {isMuted ? 'Unmute' : 'Mute'}
          </span>
          <span className="text-slate-400 text-sm w-16 text-center">
            {isPaused ? 'Resume' : 'Pause'}
          </span>
          <span className="text-slate-400 text-sm w-16 text-center">
            End Call
          </span>
        </div>
      </div>
    </div>
  );
}