import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff, Settings, Volume2, VolumeX, MoreVertical } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { geminiLiveService } from '../services/geminiLiveService';
import { useMobile } from '../../../core/hooks/useLocalStorage';

interface CallScreenProps {
  contact: AIContact;
  onBack: () => void;
  onEndCall?: () => void; // Make optional with default
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export default function CallScreen({ 
  contact, 
  onBack, 
  onEndCall = () => {}, // Provide default empty function
  showSidebar = true,
  onToggleSidebar
}: CallScreenProps) {
  // Internal state management
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [serviceState, setServiceState] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [responseText, setResponseText] = useState<string>("");
  const [duration, setDuration] = useState(0);
  
  const serviceInitialized = useRef(false);
  const initializationInProgress = useRef(false);
  const durationInterval = useRef<number | null>(null);
  const isMobile = useMobile();

  // Start duration timer when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      durationInterval.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [connectionState]);

  // Initialize service when component mounts
  useEffect(() => {
    const initService = async () => {
      if (!serviceInitialized.current && !initializationInProgress.current) {
        initializationInProgress.current = true;
        try {
          console.log("🚀 Starting service initialization...");
          
          // Set up event handlers first
          geminiLiveService.onResponse((response) => {
            setResponseText(response.text);
          });
          
          geminiLiveService.onError((error) => {
            console.error("Gemini Live error:", error);
            setResponseText("I'm having trouble with the connection. Let's try again.");
            setConnectionState('ended');
          });
          
          geminiLiveService.onStateChange((state) => {
            console.log(`🔄 Service state changed to: ${state}`);
            setServiceState(state);
          });
          
          // Initialize audio
          const initialized = await geminiLiveService.initialize();
          if (initialized) {
            console.log("✅ Audio initialized, starting session...");
            await geminiLiveService.startSession(contact);
            serviceInitialized.current = true;
            setConnectionState('connected');
            console.log("✅ Service fully initialized");
          } else {
            console.error("❌ Audio initialization failed");
            setResponseText("Could not access microphone. Please check permissions.");
            setConnectionState('ended');
          }
        } catch (error) {
          console.error("❌ Failed to initialize Gemini Live service:", error);
          setResponseText("Failed to start voice chat. Please try again.");
          setConnectionState('ended');
        } finally {
          initializationInProgress.current = false;
        }
      }
    };
    
    initService();
    
    return () => {
      // Clean up when component unmounts
      if (serviceInitialized.current) {
        geminiLiveService.endSession();
        serviceInitialized.current = false;
      }
    };
  }, [contact.id]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return formatDuration(duration);
      case 'ended':
        return 'Call ended';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connecting':
        return 'text-yellow-400';
      case 'connected':
        return 'text-green-400';
      case 'ended':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getServiceStateText = () => {
    switch (serviceState) {
      case 'listening':
        return "🎤 Listening...";
      case 'processing':
        return "🧠 Processing...";
      case 'responding':
        return "🗣️ Speaking...";
      case 'idle':
        return connectionState === 'connected' ? "💬 Ready to chat" : getStatusText();
      default:
        return getStatusText();
    }
  };

  const getServiceStateColor = () => {
    switch (serviceState) {
      case 'listening':
        return 'text-[#186799]';
      case 'processing':
        return 'text-yellow-400';
      case 'responding':
        return 'text-green-400';
      case 'idle':
        return getStatusColor();
      default:
        return getStatusColor();
    }
  };

  const handleMicToggle = async () => {
    setIsMuted(!isMuted);
    
    // If we're unmuting, start listening
    if (isMuted && serviceInitialized.current && connectionState === 'connected') {
      try {
        await geminiLiveService.startListening();
      } catch (error) {
        console.error("Failed to start listening:", error);
      }
    } else if (!isMuted && serviceInitialized.current) {
      geminiLiveService.stopListening();
    }
  };

  const handleEndCall = () => {
    if (serviceInitialized.current) {
      geminiLiveService.endSession();
      serviceInitialized.current = false;
    }
    setConnectionState('ended');
    
    // Call the onEndCall prop if it's a function
    if (typeof onEndCall === 'function') {
      onEndCall();
    } else {
      // Fallback to onBack if onEndCall is not provided
      onBack();
    }
  };

  const toggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
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

  return (
    <div className="h-full bg-glass-bg flex flex-col relative">
      {/* Header */}
      <div className="border-b border-slate-700 p-4 flex items-center justify-between bg-slate-900/50 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        
        <div className="text-center">
          <h2 className="text-white text-lg font-semibold">{contact.name}</h2>
          <p className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>
        
        {!isMobile && (
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors duration-200"
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
        )}
        
        {isMobile && (
          <div className="w-10 h-10" /> // Spacer to center the title
        )}
      </div>

      {/* Main Call Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center">
          {/* Avatar */}
          <div className="relative mb-8">
            <div
              className={`w-40 h-40 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 overflow-hidden ${
                connectionState === 'connecting' ? 'animate-pulse scale-110' : ''
              } ${
                serviceState === 'listening' ? 'ring-4 ring-[#186799] ring-opacity-75' : ''
              } ${
                serviceState === 'responding' ? 'ring-4 ring-green-400 ring-opacity-75' : ''
              } ${
                serviceState === 'processing' ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''
              }`}
            >
              {contact.avatar ? (
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <div
                  className="w-full h-full rounded-2xl"
                  style={{ background: createAgentGradient(contact.color) }}
                />
              )}
            </div>
            
            {/* Pulse rings for connecting state */}
            {connectionState === 'connecting' && (
              <>
                <div 
                  className="absolute inset-0 rounded-2xl border-4 animate-ping opacity-50"
                  style={{ borderColor: contact.color }}
                ></div>
                <div 
                  className="absolute inset-0 rounded-2xl border-2 animate-ping opacity-30"
                  style={{ borderColor: contact.color, animationDelay: '0.5s' }}
                ></div>
              </>
            )}

            {/* State indicators */}
            {serviceState === 'listening' && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#186799] rounded-full flex items-center justify-center animate-pulse">
                <Mic className="w-4 h-4 text-white" />
              </div>
            )}

            {serviceState === 'responding' && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                <Volume2 className="w-4 h-4 text-white" />
              </div>
            )}

            {serviceState === 'processing' && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center animate-spin">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">{contact.name}</h1>
            <p className="text-slate-300 text-base max-w-md mx-auto leading-relaxed">
              {contact.description}
            </p>
          </div>

          {/* Status Indicator */}
          <div className="mb-8">
            <div className={`px-6 py-3 rounded-full bg-slate-800 border ${
              connectionState === 'connected' ? 'border-green-500' : 'border-slate-600'
            }`}>
              <span className={`text-lg font-medium ${getServiceStateColor()}`}>
                {getServiceStateText()}
              </span>
            </div>
          </div>
          
          {/* Response Text */}
          {responseText && connectionState === 'connected' && (
            <div className="mb-8 max-w-md bg-slate-800 bg-opacity-70 p-4 rounded-lg border border-slate-700">
              <p className="text-slate-300 text-sm italic">"{responseText}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Call Controls */}
      <div className="p-6 bg-slate-900/50 backdrop-blur-sm border-t border-slate-700">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center space-x-6">
            {/* Mute Button */}
            <button
              onClick={handleMicToggle}
              disabled={connectionState !== 'connected'}
              className={`p-4 rounded-full transition-all duration-200 ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-slate-700 hover:bg-slate-600'
              } ${
                connectionState !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
              } shadow-lg hover:shadow-xl hover:scale-105`}
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
              className="p-6 rounded-full bg-red-600 hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 group"
            >
              <PhoneOff className="w-8 h-8 text-white group-hover:rotate-12 transition-transform duration-200" />
            </button>

            {/* Speaker Button */}
            <button
              disabled={connectionState !== 'connected'}
              className={`p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
                connectionState !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Volume2 className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Control Labels */}
          <div className="flex items-center justify-center space-x-6 mt-4">
            <span className="text-slate-400 text-sm w-16 text-center">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
            <span className="text-slate-400 text-sm w-20 text-center">End Call</span>
            <span className="text-slate-400 text-sm w-16 text-center">Speaker</span>
          </div>
        </div>
      </div>
    </div>
  );
}