import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { geminiLiveService } from '../services/geminiLiveService';

interface CallScreenProps {
  contact: AIContact;
  onBack: () => void;
}

type ConnectionState = 'initializing' | 'connecting' | 'connected' | 'ended' | 'error';
type ServiceState = 'idle' | 'listening' | 'processing' | 'responding';

export default function CallScreen({ contact, onBack }: CallScreenProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('initializing');
  const [serviceState, setServiceState] = useState<ServiceState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  const callStartTime = useRef<number | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  const addDebugInfo = useCallback((info: string) => {
    console.log(`[CallScreen Debug] ${info}`);
    setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${info}`]);
  }, []);

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

  // Initialize call
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initializeCall = async () => {
      try {
        addDebugInfo('Starting call initialization...');
        setConnectionState('initializing');
        setError(null);

        // Check if API key is available
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('Gemini API key not found. Please check your environment variables.');
        }
        addDebugInfo('API key found');

        // Initialize the service with contact information
        addDebugInfo('Initializing Gemini Live service...');
        await geminiLiveService.initialize({
          systemInstruction: `You are ${contact.name}, ${contact.description}. Speak naturally and conversationally. Keep responses concise but engaging.`,
          voice: contact.voice || 'Puck'
        });
        addDebugInfo('Service initialized successfully');

        // Set up event listeners
        geminiLiveService.onStateChange((newState) => {
          addDebugInfo(`Service state changed to: ${newState}`);
          setServiceState(newState);
        });

        geminiLiveService.onError((error) => {
          addDebugInfo(`Service error: ${error}`);
          setError(error);
          setConnectionState('error');
        });

        // Start the connection
        addDebugInfo('Starting Live API connection...');
        setConnectionState('connecting');
        
        const success = await geminiLiveService.startCall();
        
        if (success) {
          addDebugInfo('Live API connection established');
          setConnectionState('connected');
          setServiceState('listening');
          
          // Start call timer
          callStartTime.current = Date.now();
          durationInterval.current = setInterval(() => {
            if (callStartTime.current) {
              setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
            }
          }, 1000);
        } else {
          throw new Error('Failed to establish Live API connection');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        addDebugInfo(`Initialization failed: ${errorMessage}`);
        setError(errorMessage);
        setConnectionState('error');
      }
    };

    initializeCall();

    // Cleanup on unmount
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      geminiLiveService.endCall();
    };
  }, [contact, addDebugInfo]);

  const handleEndCall = useCallback(() => {
    addDebugInfo('Ending call...');
    setConnectionState('ended');
    
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    
    geminiLiveService.endCall();
    onBack();
  }, [onBack, addDebugInfo]);

  const handleMuteToggle = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (newMutedState) {
      addDebugInfo('Microphone muted');
      geminiLiveService.stopListening();
    } else {
      addDebugInfo('Microphone unmuted');
      geminiLiveService.startListening();
    }
  }, [isMuted, addDebugInfo]);

  const handleSpeakerToggle = useCallback(() => {
    setIsSpeakerOn(!isSpeakerOn);
    addDebugInfo(`Speaker ${!isSpeakerOn ? 'enabled' : 'disabled'}`);
  }, [isSpeakerOn, addDebugInfo]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (connectionState === 'error') return error || 'Connection error';
    if (connectionState === 'initializing') return 'Initializing...';
    if (connectionState === 'connecting') return 'Connecting...';
    if (connectionState === 'ended') return 'Call ended';
    
    // Connected state - show service state
    switch (serviceState) {
      case 'listening': return 'Listening...';
      case 'processing': return 'Processing...';
      case 'responding': return 'Speaking...';
      default: return 'Connected';
    }
  };

  const getStatusColor = () => {
    if (connectionState === 'error') return 'text-red-400';
    if (connectionState === 'initializing' || connectionState === 'connecting') return 'text-yellow-400';
    if (connectionState === 'ended') return 'text-slate-400';
    
    switch (serviceState) {
      case 'listening': return 'text-green-400';
      case 'processing': return 'text-blue-400';
      case 'responding': return 'text-purple-400';
      default: return 'text-white';
    }
  };

  return (
    <div className="h-full bg-glass-bg flex flex-col">
      {/* Header */}
      <div className="bg-glass-panel glass-effect border-b border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-xl font-semibold text-white">Voice Call</h1>
        </div>
        
        {connectionState === 'connected' && (
          <div className="text-slate-400 text-sm">
            {formatDuration(callDuration)}
          </div>
        )}
      </div>

      {/* Call Interface */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Agent Avatar */}
        <div className="w-32 h-32 rounded-full mb-6 flex items-center justify-center overflow-hidden shadow-2xl">
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

        {/* Agent Info */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">{contact.name}</h2>
          <p className={`text-lg font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </p>
          {connectionState === 'connected' && (
            <p className="text-slate-400 text-sm mt-2">
              Voice: {contact.voice || 'Puck'}
            </p>
          )}
        </div>

        {/* Debug Info (only show in development) */}
        {import.meta.env.DEV && debugInfo.length > 0 && (
          <div className="mb-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700 max-w-md w-full">
            <h3 className="text-xs font-medium text-slate-400 mb-2">Debug Info:</h3>
            <div className="space-y-1">
              {debugInfo.map((info, index) => (
                <p key={index} className="text-xs text-slate-300 font-mono">{info}</p>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {connectionState === 'error' && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg max-w-md w-full">
            <p className="text-red-300 text-sm text-center">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Call Controls */}
        <div className="flex items-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={handleMuteToggle}
            disabled={connectionState !== 'connected'}
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

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors duration-200"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>

          {/* Speaker Button */}
          <button
            onClick={handleSpeakerToggle}
            disabled={connectionState !== 'connected'}
            className={`p-4 rounded-full transition-all duration-200 ${
              isSpeakerOn
                ? 'bg-slate-700 hover:bg-slate-600'
                : 'bg-slate-600 hover:bg-slate-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSpeakerOn ? (
              <Volume2 className="w-6 h-6 text-white" />
            ) : (
              <VolumeX className="w-6 h-6 text-white" />
            )}
          </button>
        </div>

        {/* Instructions */}
        {connectionState === 'connected' && serviceState === 'listening' && (
          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              Start speaking to begin the conversation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}