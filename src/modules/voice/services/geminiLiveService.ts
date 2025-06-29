import { AIContact } from '../../../core/types/types';
import { documentContextService } from '../../fileManagement/services/documentContextService';

type ServiceState = 'idle' | 'listening' | 'processing' | 'responding';

interface VoiceResponse {
  text: string;
  isComplete: boolean;
}

class GeminiLiveService {
  private apiKey: string;
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isInitialized = false;
  private isSessionActive = false;
  private currentState: ServiceState = 'idle';
  private responseCallback: ((response: VoiceResponse) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private stateCallback: ((state: ServiceState) => void) | null = null;
  private currentContact: AIContact | null = null;
  private isListening = false;
  private audioProcessor: ScriptProcessorNode | null = null;
  private autoListenTimeout: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  onResponse(callback: (response: VoiceResponse) => void) {
    this.responseCallback = callback;
  }

  onError(callback: (error: Error) => void) {
    this.errorCallback = callback;
  }

  onStateChange(callback: (state: ServiceState) => void) {
    this.stateCallback = callback;
  }

  private setState(state: ServiceState) {
    console.log(`🔄 State change: ${this.currentState} → ${state}`);
    this.currentState = state;
    if (this.stateCallback) {
      this.stateCallback(state);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🎤 Starting audio initialization...');
      
      // Create AudioContext with ultra-low latency settings
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 16000
      });
      
      console.log('✅ AudioContext created');
      
      // Request microphone access with optimal settings
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      console.log('✅ Microphone access granted');
      console.log('🎤 Audio initialized with ULTRA-LOW latency');
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Audio initialization failed:', error);
      if (this.errorCallback) {
        this.errorCallback(new Error('Failed to initialize audio: ' + error.message));
      }
      return false;
    }
  }

  async startSession(contact: AIContact): Promise<void> {
    console.log('🔍 Checking audio initialization status...');
    
    if (!this.isInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio not properly initialized');
    }

    console.log('✅ Audio is ready, proceeding with session...');
    
    this.currentContact = contact;
    this.reconnectAttempts = 0;

    try {
      // Build system instruction with document context
      const documentContext = await documentContextService.getAgentDocumentContext(contact);
      let systemInstruction = documentContext.formattedContext;

      // Add tool instructions if contact has integrations
      const hasApiTool = contact.integrations?.some(
        integration => integration.integrationId === 'api-request-tool' && integration.config.enabled
      );

      const hasDomainTool = contact.integrations?.some(
        integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
      );

      const hasWebhookTool = contact.integrations?.some(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      );

      const hasGoogleSheets = contact.integrations?.some(
        integration => integration.integrationId === 'google-sheets' && integration.config.enabled
      );

      const hasNotionSource = contact.integrations?.some(
        integration => integration.integrationId === 'notion-oauth-source' && integration.config.enabled
      );

      const hasNotionAction = contact.integrations?.some(
        integration => integration.integrationId === 'notion-oauth-action' && integration.config.enabled
      );

      const hasNotion = hasNotionSource || hasNotionAction;

      console.log('🔍 Contact integrations:', contact.integrations?.length || 0);
      console.log('🔍 Has API tool:', hasApiTool, 'Domain tool:', hasDomainTool, 'Webhook tool:', hasWebhookTool, 'Google Sheets:', hasGoogleSheets, 'Notion:', hasNotion);

      // Add tool instructions
      if (hasApiTool) {
        systemInstruction += '\n\n🔧 API REQUEST TOOL AVAILABLE 🔧\nYou can make HTTP requests to fetch real-time information when users ask for current data.';
      }

      if (hasDomainTool) {
        systemInstruction += '\n\n🔧 DOMAIN CHECKING AVAILABLE 🔧\nYou can check domain availability when users ask about domains.';
      }

      if (hasWebhookTool) {
        systemInstruction += '\n\n🪝 WEBHOOK TRIGGERS AVAILABLE 🔧\nYou can trigger workflows when users ask to activate, start, or execute processes.';
      }

      if (hasGoogleSheets) {
        systemInstruction += '\n\n📊 GOOGLE SHEETS ACCESS AVAILABLE 🔧\nYou can read and modify Google Sheets data when users ask about spreadsheet operations.';
      }

      if (hasNotion) {
        systemInstruction += '\n\n📝 NOTION INTEGRATION AVAILABLE 🔧\nYou can access and manage Notion content when users ask about their workspace.';
      }

      // Add general instruction
      systemInstruction += '\n\nAlways be helpful, engaging, and use the tools when appropriate to provide accurate, real-time information.';

      await this.connectWebSocket(systemInstruction);

    } catch (error) {
      console.error('❌ Failed to start session:', error);
      if (this.errorCallback) {
        this.errorCallback(new Error('Failed to start session: ' + error.message));
      }
      throw error;
    }
  }

  private async connectWebSocket(systemInstruction: string): Promise<void> {
    try {
      // Create WebSocket connection to Gemini Live API
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      
      console.log('🔌 Connecting to WebSocket:', wsUrl.substring(0, wsUrl.indexOf('?')));
      
      // Close existing WebSocket if any
      if (this.ws) {
        try {
          this.ws.close();
        } catch (e) {
          console.warn('⚠️ Error closing existing WebSocket:', e);
        }
        this.ws = null;
      }
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected to Gemini Live API');
        this.setupSession(this.currentContact!, systemInstruction);
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        
        // Log more details about the error
        console.error('❌ WebSocket error details:', {
          readyState: this.ws?.readyState,
          url: wsUrl.substring(0, wsUrl.indexOf('?')),
          apiKeyLength: this.apiKey.length,
          hasCallback: !!this.errorCallback
        });
        
        if (this.errorCallback) {
          this.errorCallback(new Error('WebSocket connection failed'));
        }
        
        // Try to reconnect if appropriate
        this.attemptReconnect(systemInstruction);
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket connection closed: ${event.code} ${event.reason}`);
        console.log(`🔌 WebSocket close details: wasClean=${event.wasClean}, code=${event.code}`);
        
        this.isSessionActive = false;
        this.setState('idle');
        
        // Clear any pending auto-listen timeout
        if (this.autoListenTimeout) {
          clearTimeout(this.autoListenTimeout);
          this.autoListenTimeout = null;
        }
        
        // Try to reconnect if it wasn't a clean close
        if (!event.wasClean && event.code !== 1000) {
          this.attemptReconnect(systemInstruction);
        }
      };
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      throw error;
    }
  }

  private attemptReconnect(systemInstruction: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
      
      setTimeout(() => {
        if (this.isSessionActive) {
          console.log('🔄 Reconnecting WebSocket...');
          this.connectWebSocket(systemInstruction).catch(err => {
            console.error('❌ Reconnection failed:', err);
          });
        }
      }, delay);
    } else {
      console.error(`❌ Maximum reconnection attempts (${this.maxReconnectAttempts}) reached`);
      if (this.errorCallback) {
        this.errorCallback(new Error('Failed to establish a stable connection after multiple attempts'));
      }
    }
  }

  private setupSession(contact: AIContact, systemInstruction: string) {
    if (!this.ws) return;

    // Define tools based on contact integrations
    const tools: any[] = [];

    // Add tools based on integrations (simplified for voice)
    const hasApiTool = contact.integrations?.some(
      integration => integration.integrationId === 'api-request-tool' && integration.config.enabled
    );

    if (hasApiTool) {
      tools.push({
        functionDeclarations: [{
          name: "make_api_request",
          description: "Make an HTTP API request to fetch real-time data",
          parameters: {
            type: "object",
            properties: {
              url: { type: "string", description: "The URL to request" },
              method: { type: "string", description: "HTTP method", enum: ["GET", "POST"] }
            },
            required: ["url"]
          }
        }]
      });
    }

    // Session configuration
    const sessionConfig = {
      responseModalities: ["AUDIO"],
      systemInstruction: systemInstruction,
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          prefixPaddingMs: 10,
          silenceDurationMs: 100
        }
      },
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: contact.voice || "Puck"
          }
        }
      }
    };

    // Add tools if available
    if (tools.length > 0) {
      console.log('🔧 Adding tools to session:', tools.length);
      (sessionConfig as any).tools = tools;
    } else {
      console.log('🔧 No tools configured for this contact');
    }

    console.log('🔧 Final session config:', JSON.stringify(sessionConfig, null, 2));

    try {
      // Send session setup
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          setup: sessionConfig
        }));
        console.log('✅ Live API session setup sent');
        this.isSessionActive = true;
      } else {
        console.error('❌ WebSocket not open, cannot send setup');
        if (this.errorCallback) {
          this.errorCallback(new Error('WebSocket not open, cannot start session'));
        }
      }
    } catch (error) {
      console.error('❌ Error sending session setup:', error);
      if (this.errorCallback) {
        this.errorCallback(new Error('Failed to send session setup: ' + error.message));
      }
    }
  }

  private handleWebSocketMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      
      if (data.setupComplete) {
        console.log('✅ Gemini Live session started with ULTRA-LOW LATENCY optimizations');
        this.setState('idle');
        
        // Automatically start listening after session is ready
        this.autoListenTimeout = window.setTimeout(() => {
          console.log('🔄 Auto-starting listening after setup...');
          this.startListening().catch(err => {
            console.error('❌ Auto-listen failed:', err);
          });
        }, 1000);
        return;
      }

      if (data.serverContent) {
        if (data.serverContent.modelTurn) {
          console.log('🤖 AI is responding...');
          this.setState('responding');
        }
        
        if (data.serverContent.turnComplete) {
          console.log('✅ AI response complete');
          this.setState('idle');
          
          // Automatically start listening again after response
          this.autoListenTimeout = window.setTimeout(() => {
            console.log('🔄 Auto-restarting listening after response...');
            if (this.isSessionActive && !this.isListening) {
              this.startListening().catch(err => {
                console.error('❌ Auto-restart listen failed:', err);
              });
            }
          }, 1000);
        }
      }

      if (data.serverContent?.modelTurn?.parts) {
        const parts = data.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.text) {
            console.log('📝 AI response text:', part.text);
            if (this.responseCallback) {
              this.responseCallback({
                text: part.text,
                isComplete: data.serverContent.turnComplete || false
              });
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
      console.error('Raw message data:', event.data);
    }
  }

  async startListening(): Promise<void> {
    if (!this.isSessionActive) {
      console.warn('⚠️ Cannot start listening - session not active');
      return;
    }
    
    if (!this.audioContext || !this.mediaStream) {
      console.error('❌ Audio context or media stream not available');
      return;
    }
    
    if (this.isListening) {
      console.log('⚠️ Already listening, ignoring duplicate start request');
      return;
    }

    try {
      console.log('🎤 Starting to listen...');
      this.isListening = true;
      this.setState('listening');

      // Clear any existing processor
      if (this.audioProcessor) {
        try {
          this.audioProcessor.disconnect();
        } catch (e) {
          console.warn('⚠️ Error disconnecting previous processor:', e);
        }
        this.audioProcessor = null;
      }

      // Create audio processing pipeline
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.audioProcessor.onaudioprocess = (event) => {
        if (!this.isListening || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        // Send audio data to Gemini Live API
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{
                  mimeType: "audio/pcm",
                  data: btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)))
                }]
              }
            }));
          } catch (error) {
            console.error('❌ Error sending audio data:', error);
            // Don't stop listening on a single error, just log it
          }
        }
      };

      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);

      console.log('✅ Audio processing started');

    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      this.isListening = false;
      this.setState('idle');
      if (this.errorCallback) {
        this.errorCallback(new Error('Failed to start listening: ' + error.message));
      }
    }
  }

  stopListening(): void {
    if (!this.isListening) {
      console.log('⚠️ Not currently listening, ignoring stop request');
      return;
    }

    console.log('🛑 Stopping listening...');
    this.isListening = false;

    if (this.audioProcessor) {
      try {
        this.audioProcessor.disconnect();
      } catch (e) {
        console.warn('⚠️ Error disconnecting processor:', e);
      }
      this.audioProcessor = null;
    }

    // Clear any pending auto-listen timeout
    if (this.autoListenTimeout) {
      clearTimeout(this.autoListenTimeout);
      this.autoListenTimeout = null;
    }

    this.setState('idle');
    console.log('✅ Stopped listening');
  }

  endSession(): void {
    console.log('🔚 Ending Gemini Live session...');
    
    // Clear any pending auto-listen timeout
    if (this.autoListenTimeout) {
      clearTimeout(this.autoListenTimeout);
      this.autoListenTimeout = null;
    }
    
    this.stopListening();
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn('⚠️ Error closing WebSocket:', e);
      }
      this.ws = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('⚠️ Error stopping media tracks:', e);
      }
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close().catch(err => {
          console.warn('⚠️ Error closing AudioContext:', err);
        });
      } catch (e) {
        console.warn('⚠️ Error closing AudioContext:', e);
      }
      this.audioContext = null;
    }

    this.isSessionActive = false;
    this.isInitialized = false;
    this.currentContact = null;
    this.setState('idle');
    this.reconnectAttempts = 0;
    
    console.log('✅ Session ended and resources cleaned up');
  }

  getCurrentState(): ServiceState {
    return this.currentState;
  }

  isActive(): boolean {
    return this.isSessionActive;
  }
}

export const geminiLiveService = new GeminiLiveService();