import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff, Settings, Volume2, VolumeX, MoreVertical } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { geminiLiveService } from '../services/geminiLiveService';
import { useMobile } from '../../../core/hooks/useLocalStorage';

interface CallScreenProps {
  contact: AIContact;
  onBack: () => void;
  onEndCall: () => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export default function CallScreen({ 
  contact, 
  onBack, 
  onEndCall,
  showSidebar = true,
  onToggleSidebar
}: CallScreenProps) {
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [responseText, setResponseText] = useState<string>("");
  const [serviceState, setServiceState] = useState<'idle' | 'listening' | 'processing' | 'responding'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const serviceInitialized = useRef(false);
  const initializationInProgress = useRef(false);
  const isMobile = useMobile();

  // Early return if required props are not available
  if (!contact) {
    return (
      <div className="h-full bg-glass-bg flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  useEffect(() => {
    setPulseAnimation(true);
    
    // Initialize the Gemini Live service when component mounts
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
            setIsConnected(true);
            setPulseAnimation(false);
            console.log("✅ Service fully initialized");
          } else {
            console.error("❌ Audio initialization failed");
            setResponseText("Could not access microphone. Please check permissions.");
            setPulseAnimation(false);
          }
        } catch (error) {
          console.error("❌ Failed to initialize Gemini Live service:", error);
          setResponseText("Failed to start voice chat. Please try again.");
          setPulseAnimation(false);
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

  const getStatusText = () => {
    if (!isConnected) {
      return 'Connecting...';
    }
    return 'Connected';
  };

  const getStatusColor = () => {
    if (!isConnected) {
      return 'text-yellow-400';
    }
    return 'text-green-400';
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
        return isConnected ? "💬 Ready to chat" : getStatusText();
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
    if (isMuted && serviceInitialized.current && isConnected) {
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
    onEndCall();
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

  // Center content within available space
  const mainContentClass = "max-w-2xl mx-auto";

  return (
    <div className="h-full bg-glass-bg flex flex-col">
      {/* Header */}
      <div className={`p-6 flex items-center justify-between border-b border-slate-700 bg-glass-panel glass-effect ${isMobile ? 'safe-area-top' : ''}`}>
        <button
          onClick={onBack}
          className="p-3 rounded-full hover:bg-slate-800 transition-colors duration-200"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="text-center">
          <h2 className="text-white text-xl font-semibold">{contact.name}</h2>
          <p className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>
        
        {!isMobile && (
          <button 
            onClick={toggleSidebar}
            className="p-3 rounded-full hover:bg-slate-800 transition-colors duration-200"
          >
            <MoreVertical className="w-6 h-6 text-slate-400" />
          </button>
        )}
        
        {isMobile && (
          <div className="w-12 h-12" /> // Spacer to center the title
        )}
      </div>

      {/* Main Call Area */}
      <div className={`flex-1 flex flex-col items-center justify-center px-8 ${mainContentClass}`}>
        {/* Avatar */}
        <div className="relative mb-8">
          <div
            className={`w-40 h-40 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 overflow-hidden ${
              pulseAnimation ? 'animate-pulse scale-110' : ''
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
          {!isConnected && (
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
            isConnected ? 'border-green-500' : 'border-slate-600'
          }`}>
            <span className={`text-lg font-medium ${getServiceStateColor()}`}>
              {getServiceStateText()}
            </span>
          </div>
        </div>
        
        {/* Response Text */}
        {responseText && isConnected && (
          <div className="mb-8 max-w-md bg-slate-800 bg-opacity-70 p-4 rounded-lg border border-slate-700">
            <p className="text-slate-300 text-sm italic">"{responseText}"</p>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className={`pb-8 px-8 ${isMobile ? 'safe-area-bottom' : ''}`}>
        <div className="flex items-center justify-center space-x-6">
          {/* Mute Button */}
          <button
            onClick={handleMicToggle}
            disabled={!isConnected}
            className={`p-4 rounded-full transition-all duration-200 ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-700 hover:bg-slate-600'
            } ${
              !isConnected ? 'opacity-50 cursor-not-allowed' : ''
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
            disabled={!isConnected}
            className={`p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 ${
              !isConnected ? 'opacity-50 cursor-not-allowed' : ''
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
  );
}