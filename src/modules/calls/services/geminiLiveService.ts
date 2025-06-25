import { GoogleGenAI, Modality } from '@google/genai';
import { AIContact, Message } from '../../../types';
import { integrationsService } from '../../../services/integrationsService';
import { documentService } from '../../../services/documentService';

// Configuration for Gemini Live API
interface GeminiLiveConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

// Response types for streaming
interface GeminiLiveResponse {
  text: string;
  isComplete: boolean;
}

class GeminiLiveService {
  private genAI: GoogleGenAI | null = null;
  private activeSession: any = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isRecording: boolean = false;
  private isPlaying: boolean = false;
  private currentContact: AIContact | null = null;
  private isSessionActive: boolean = false;

  // Callbacks
  private onResponseCallback: ((response: GeminiLiveResponse) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onStateChangeCallback: ((state: 'idle' | 'listening' | 'processing' | 'responding') => void) | null = null;

  // Audio processing - ULTRA LOW LATENCY OPTIMIZED
  private audioChunks: Float32Array[] = [];
  private audioQueue: Int16Array[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private processingInterval: number | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;

  constructor(config: GeminiLiveConfig) {
    const apiKey = config.apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    } else {
      console.warn('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env file');
    }
  }

  /**
   * Initialize the audio context and request microphone permissions
   */
  public async initialize(): Promise<boolean> {
    try {
      console.log("🎤 Starting audio initialization...");
      
      // Initialize AudioContext with ULTRA LOW latency settings
      this.audioContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 16000
      });
      
      console.log("✅ AudioContext created");
      
      // Request microphone permissions with ULTRA LOW latency
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          latency: 0.001 // 1ms latency - ULTRA LOW
        } 
      });
      
      console.log("✅ Microphone access granted");
      console.log("🎤 Audio initialized with ULTRA-LOW latency");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize audio:", error);
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error("Failed to initialize audio: " + (error as Error).message));
      }
      return false;
    }
  }

  /**
   * Start a new Live API session
   */
  public async startSession(contact: AIContact): Promise<void> {
    try {
      if (!this.genAI) {
        throw new Error("Gemini API not initialized - check your API key");
      }

      // Wait for audio to be fully ready with timeout
      console.log("🔍 Checking audio initialization status...");
      let attempts = 0;
      const maxAttempts = 10;
      
      while ((!this.audioStream || !this.audioContext) && attempts < maxAttempts) {
        console.log(`⏳ Waiting for audio... attempt ${attempts + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }

      if (!this.audioStream || !this.audioContext) {
        throw new Error("Audio not initialized - call initialize() first");
      }
      
      console.log("✅ Audio is ready, proceeding with session...");

      // Prevent multiple concurrent sessions
      if (this.isSessionActive) {
        console.log("Session already active, ending current session first");
        this.endSession();
        // Minimal cleanup time for fastest restart
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.isSessionActive = true;
      
      // Store the contact
      this.currentContact = contact;
      this.updateState('idle');
      
      // Clear any existing audio queue
      this.audioQueue = [];

      // Check if contact has integrations
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
      
      console.log(`🔍 Contact integrations:`, contact.integrations);
      console.log(`🔍 Has API tool: ${hasApiTool}, Domain tool: ${hasDomainTool}, Webhook tool: ${hasWebhookTool}, Google Sheets: ${hasGoogleSheets}`);

      // Create session config following the docs exactly with ULTRA LOW LATENCY
      const config: any = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.createSystemPrompt(contact),
        // ULTRA-AGGRESSIVE VAD for minimal latency
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            prefixPaddingMs: 10, // MINIMAL padding for fastest response
            silenceDurationMs: 100 // QUICK cutoff for faster turn-taking
          }
        },
        // Speech configuration
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.getVoiceForContact(contact)
            }
          }
        }
      };

      // Add tools if integrations are enabled
      const functionDeclarations = [];

      if (hasApiTool) {
        functionDeclarations.push({
          name: "make_api_request",
          description: "Make an HTTP API request to fetch data from external services",
          parameters: {
            type: "object" as const,
            properties: {
              url: {
                type: "string" as const,
                description: "The URL to make the request to"
              },
              method: {
                type: "string" as const,
                description: "HTTP method (GET, POST, PUT, DELETE)",
                enum: ["GET", "POST", "PUT", "DELETE"]
              },
              headers: {
                type: "object" as const,
                description: "HTTP headers as key-value pairs"
              },
              body: {
                type: "string" as const,
                description: "Request body for POST/PUT requests"
              }
            },
            required: ["url"]
          }
        });
      }

      if (hasDomainTool) {
        functionDeclarations.push({
          name: "check_domain_availability",
          description: "Check domain availability using RDAP with customizable variations",
          parameters: {
            type: "object" as const,
            properties: {
              domain: {
                type: "string" as const,
                description: "Base domain name to check (without TLD)"
              },
              variations: {
                type: "array" as const,
                items: {
                  type: "string" as const
                },
                description: "Optional domain variations to check. Use {domain} as placeholder. If not provided, uses default variations."
              }
            },
            required: ["domain"]
          }
        });
      }

      if (hasWebhookTool) {
        functionDeclarations.push({
          name: "trigger_webhook",
          description: "Trigger a webhook based on natural language commands. Use when user asks to activate, trigger, start, launch, or execute something.",
          parameters: {
            type: "object" as const,
            properties: {
              action: {
                type: "string" as const,
                description: "The action the user wants to perform (e.g., 'activate marketing', 'trigger workflow', 'send notification')"
              }
            },
            required: ["action"]
          }
        });
      }

      if (hasGoogleSheets) {
        functionDeclarations.push({
          name: "manage_google_sheets",
          description: "Read, write, search, and manage Google Sheets data. Use when user asks to view, add, update, search, or modify spreadsheet data. Always provide data as 2D arrays for write/append operations.",
          parameters: {
            type: "object" as const,
            properties: {
              operation: {
                type: "string" as const,
                description: "The operation to perform: 'read' (view data), 'write' (update specific cells), 'append' (add new rows), 'search' (find data), 'info' (get metadata), 'clear' (delete data)",
                enum: ["read", "write", "append", "search", "info", "clear"]
              },
              sheetIndex: {
                type: "number" as const,
                description: "Index of the Google Sheets integration to use (0 for first sheet, 1 for second, etc.)",
                default: 0
              },
              range: {
                type: "string" as const,
                description: "Cell range for read/write operations (e.g., 'A1:C10', 'B5:D5', 'A:A'). Required for write/clear operations. Optional for read (defaults to all data)."
              },
              data: {
                type: "array" as const,
                items: {
                  type: "array" as const,
                  items: {
                    type: "string" as const
                  }
                },
                description: "2D array of data for write/append operations. MUST be array of arrays. Examples: [['John', 'Doe', 'john@email.com']] for one row, [['Name', 'Email'], ['John', 'john@email.com'], ['Jane', 'jane@email.com']] for multiple rows with headers."
              },
              searchTerm: {
                type: "string" as const,
                description: "Search term to find in the spreadsheet (required for search operation)"
              },
              sheetName: {
                type: "string" as const,
                description: "Optional name of the specific sheet/tab to operate on (defaults to first sheet)"
              }
            },
            required: ["operation"]
          }
        });
      }

      if (functionDeclarations.length > 0) {
        config.tools = [{ functionDeclarations }];
        console.log(`🔧 Tools configured: ${functionDeclarations.map(f => f.name).join(', ')}`);
        console.log('🔧 Full tools config:', JSON.stringify(config.tools, null, 2));
      } else {
        console.log('🔧 No tools configured for this contact');
      }

      console.log('🔧 Final session config:', JSON.stringify(config, null, 2));

      // Create Live API session following docs pattern
      this.activeSession = await this.genAI.live.connect({
        model: 'gemini-2.0-flash-live-001', // Use stable Live API model with higher quotas
        config: config,
        callbacks: {
          onopen: () => {
            console.log('✅ Live API session opened');
            this.startAudioCapture();
          },
          onmessage: (message: any) => {
            this.handleMessage(message);
          },
          onerror: (error: any) => {
            console.error('Live API error:', error);
            if (this.onErrorCallback) {
              this.onErrorCallback(new Error(`Live API error: ${error.message}`));
            }
          },
          onclose: (event: any) => {
            console.log('Live API session closed:', event.code, event.reason);
            this.cleanup();
          }
        }
      });
      
      console.log("✅ Gemini Live session started with ULTRA-LOW LATENCY optimizations");
      
    } catch (error) {
      console.error("Failed to start Gemini Live session:", error);
      this.isSessionActive = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error("Failed to start session: " + (error as Error).message));
      }
    }
  }

  /**
   * Handle incoming messages from Live API 
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      // Handle tool calls
      if (message.toolCall && this.activeSession) {
        console.log('🔧 Received tool call:', message.toolCall);
        this.updateState('processing');
        
        const functionResponses = [];
        
        for (const fc of message.toolCall.functionCalls) {
          if (fc.name === 'make_api_request') {
            try {
              const { url, method = 'GET', headers = {}, body } = fc.args;
              console.log(`🌐 Making API request: ${method} ${url}`);
              
              const result = await integrationsService.executeApiRequest(url, method, headers, body);
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: true,
                  data: result
                }
              });
            } catch (error) {
              console.error('❌ API request failed:', error);
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: false,
                  error: (error as Error).message || 'API request failed'
                }
              });
            }
          }
          
          if (fc.name === 'check_domain_availability') {
            try {
              const { domain, variations } = fc.args;
              console.log(`🔍 Checking domain availability for: ${domain}`);
              
              const result = await this.checkDomainAvailability(domain, variations);
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: true,
                  data: result
                }
              });
            } catch (error) {
              console.error('❌ Domain check failed:', error);
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: false,
                  error: (error as Error).message || 'Domain check failed'
                }
              });
            }
          }

          if (fc.name === 'trigger_webhook') {
            try {
              const { action } = fc.args;
              console.log(`🪝 Triggering webhook for action: ${action}`);
              
              const result = await this.triggerWebhook(action);
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: true,
                  data: result
                }
              });
            } catch (error) {
              console.error('❌ Webhook trigger failed:', error);
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: false,
                  error: (error as Error).message || 'Webhook trigger failed'
                }
              });
            }
          }

          if (fc.name === 'manage_google_sheets') {
            try {
              const { operation, sheetIndex = 0, range, data, searchTerm, sheetName } = fc.args;
              console.log(`📊 Managing Google Sheets: ${operation}`);
              
              // Get the Google Sheets integration for this contact
              const sheetsIntegrations = this.currentContact?.integrations?.filter(
                integration => integration.integrationId === 'google-sheets' && integration.config.enabled
              ) || [];
              
              if (sheetsIntegrations.length === 0) {
                throw new Error('No Google Sheets integrations found for this contact');
              }
              
              if (sheetIndex >= sheetsIntegrations.length) {
                throw new Error(`Sheet index ${sheetIndex} is out of range. Available sheets: 0-${sheetsIntegrations.length - 1}`);
              }
              
              const sheetIntegration = sheetsIntegrations[sheetIndex];
              const sheetConfig = sheetIntegration.config.settings;
              
              const result = await integrationsService.executeGoogleSheetsToolOperation(
                operation,
                sheetConfig.sheetUrl,
                sheetConfig.accessLevel || 'read-only',
                sheetName || sheetConfig.defaultSheet,
                range,
                data,
                searchTerm
              );
              
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: true,
                  operation,
                  sheetName: sheetConfig.sheetName || 'Google Sheets',
                  data: result.data
                }
              });
            } catch (error) {
              console.error('❌ Google Sheets operation failed:', error);
              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: {
                  success: false,
                  error: (error as Error).message || 'Google Sheets operation failed'
                }
              });
            }
          }
        }

        if (functionResponses.length > 0) {
          console.log('📤 Sending tool response...');
          this.activeSession.sendToolResponse({ functionResponses });
        }
        return;
      }

      // Handle interruption
      if (message.serverContent && message.serverContent.interrupted) {
        console.log("🛑 Interruption detected");
        this.stopAudioPlayback();
        this.audioQueue = []; // Clear queue on interruption
        this.updateState('listening');
        return;
      }

      // Handle generation complete
      if (message.serverContent && message.serverContent.generationComplete) {
        console.log("✅ Generation complete");
        // Don't change state here, let audio finish playing
        return;
      }

      // Handle turn complete
      if (message.serverContent && message.serverContent.turnComplete) {
        console.log("✅ Turn complete");
        // Start playing queued audio if not already playing
        if (!this.isPlaying && this.audioQueue.length > 0) {
          this.playNextAudioChunk();
        } else if (!this.isPlaying) {
          this.updateState('listening');
        }
        return;
      }

      // Handle model turn with audio/text
      if (message.serverContent && message.serverContent.modelTurn) {
        const modelTurn = message.serverContent.modelTurn;
        
        if (modelTurn.parts) {
          for (const part of modelTurn.parts) {
            // Handle text response
            if (part.text) {
              console.log("📝 Received text:", part.text);
              if (this.onResponseCallback) {
                this.onResponseCallback({
                  text: part.text,
                  isComplete: false
                });
              }
            }
            
            // Handle audio response - IMMEDIATE PLAYBACK for lowest latency
            if (part.inlineData && part.inlineData.data) {
              console.log("🔊 Received audio chunk - IMMEDIATE PLAYBACK");
              this.updateState('responding');
              const audioData = this.base64ToInt16Array(part.inlineData.data);
              this.playAudioImmediately(audioData);
            }
          }
        }
        return;
      }

      // Handle direct audio data (fallback)
      if (message.data) {
        console.log("🔊 Received direct audio data - IMMEDIATE PLAYBACK");
        this.updateState('responding');
        const audioData = this.base64ToInt16Array(message.data);
        this.playAudioImmediately(audioData);
      }

      // Handle direct text (fallback)
      if (message.text) {
        console.log("📝 Received direct text:", message.text);
        if (this.onResponseCallback) {
          this.onResponseCallback({
            text: message.text,
            isComplete: false
          });
        }
      }

    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  /**
   * ULTRA LOW LATENCY audio playback - immediate if nothing playing, otherwise queue
   */
  private playAudioImmediately(audioData: Int16Array): void {
    // Add to queue for sequential playback
    this.audioQueue.push(audioData);
    
    // Start playing immediately if nothing is currently playing
    if (!this.isPlaying) {
      this.playNextAudioChunk();
    }
  }

  /**
   * Play the next audio chunk with ZERO latency
   */
  private playNextAudioChunk(): void {
    if (this.audioQueue.length === 0 || this.isPlaying || !this.audioContext) {
      return;
    }

    try {
      this.isPlaying = true;
      const audioData = this.audioQueue.shift()!;
      
      // Create audio buffer (Native audio outputs at 24kHz)
      const sampleRate = 24000;
      const audioBuffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      // ULTRA-OPTIMIZED conversion loop - fastest possible
      for (let i = 0; i < audioData.length; i++) {
        channelData[i] = audioData[i] * 0.000030517578125; // Faster than division by 32768
      }
      
      // Create and play audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.isPlaying = false;
        
        // Play next chunk IMMEDIATELY if available (ZERO delay for streaming)
        if (this.audioQueue.length > 0) {
          this.playNextAudioChunk();
        } else {
          // Return to listening state
          if (this.activeSession) {
            this.updateState('listening');
          } else {
            this.updateState('idle');
          }
        }
      };
      
      // Start IMMEDIATELY
      source.start(0);
      this.currentSource = source;
      
    } catch (error) {
      console.error("Error playing audio chunk:", error);
      this.isPlaying = false;
      // Continue with next chunk if available
      if (this.audioQueue.length > 0) {
        setTimeout(() => this.playNextAudioChunk(), 1); // Minimal delay
      } else {
        this.updateState('listening');
      }
    }
  }

  /**
   * Start capturing and streaming audio with OPTIMAL settings for ultra-low latency
   */
  private startAudioCapture(): void {
    if (!this.audioStream || !this.audioContext || !this.activeSession) {
      return;
    }

    try {
      console.log("🎤 Starting audio capture");
      this.isRecording = true;
      this.updateState('listening');

      // Create audio source from microphone
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.audioSource = source;
      
      // Use OPTIMAL buffer size - 512 samples (32ms at 16kHz) for best latency/performance balance
      const processor = this.audioContext.createScriptProcessor(512, 1, 1);
      this.audioProcessor = processor;
      
      processor.onaudioprocess = (event) => {
        if (!this.isRecording || !this.activeSession) {
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);
        
        // ULTRA-SENSITIVE voice activity detection for minimal latency
        let hasAudio = false;
        for (let i = 0; i < inputData.length; i++) {
          if (Math.abs(inputData[i]) > 0.002) { // Lower threshold for faster response
            hasAudio = true;
            break;
          }
        }

        if (hasAudio) {
          // Direct copy without extra allocation when possible
          const audioChunk = new Float32Array(inputData);
          this.audioChunks.push(audioChunk);
        }
      };

      // Connect audio processing chain
      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Send audio chunks every 32ms for ultra-low latency streaming
      this.processingInterval = window.setInterval(() => {
        this.sendAudioChunks();
      }, 32);

    } catch (error) {
      console.error("Error starting audio capture:", error);
      this.isRecording = false;
      this.updateState('idle');
    }
  }

  /**
   * Send audio chunks with MINIMAL batching for lowest latency
   */
  private async sendAudioChunks(): Promise<void> {
    if (!this.activeSession || this.audioChunks.length === 0 || !this.isRecording) {
      return;
    }

    try {
      // Send chunks individually for ZERO batching latency
      const chunksToSend = [...this.audioChunks];
      this.audioChunks = []; // Clear immediately
      
      for (const chunk of chunksToSend) {
        // Convert individual chunk directly
        const pcmData = this.fastConvertToPCM16(chunk);
        
        if (pcmData.length === 0) {
          continue;
        }

        // Fast base64 conversion
        const base64Audio = this.fastPcmToBase64(pcmData);

        // Send immediately without waiting
        this.activeSession.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000"
          }
        });
      }

    } catch (error) {
      console.error("Error sending audio:", error);
    }
  }

  /**
   * ULTRA-FAST Float32 to 16-bit PCM conversion (optimized for minimal latency)
   */
  private fastConvertToPCM16(audioData: Float32Array): Int16Array {
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      // Clamp and convert with bitwise operation for speed
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = (sample * 32767) | 0;
    }
    return pcmData;
  }

  /**
   * ULTRA-FAST base64 conversion using direct buffer access
   */
  private fastPcmToBase64(pcmData: Int16Array): string {
    // Direct buffer access - fastest method
    const uint8Array = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
  }

  /**
   * Convert base64 to Int16Array for audio playback
   */
  private base64ToInt16Array(base64: string): Int16Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  /**
   * Stop audio playback (for interruptions)
   */
  private stopAudioPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (error) {
        // Ignore errors when stopping
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  /**
   * Get appropriate voice for contact
   */
  private getVoiceForContact(contact: AIContact): string {
    // Use the contact's selected voice if available, otherwise fall back to auto-selection
    if (contact.voice) {
      return contact.voice;
    }
    
    // Auto-select voice based on name for backward compatibility
    const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];
    const index = contact.name.charCodeAt(0) % voices.length;
    return voices[index];
  }

  /**
   * Check domain availability using RDAP
   */
  private async checkDomainAvailability(baseDomain: string, customVariations?: string[]): Promise<any> {
    try {
      // Get variations from contact integration settings or use provided ones
      let variations: string[] = customVariations || [];
      
      if (variations.length === 0) {
        // Get default variations from contact integration settings
        const domainIntegration = this.currentContact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
        );
        
        if (domainIntegration?.config.settings.variations) {
          variations = domainIntegration.config.settings.variations.split('\n').filter((v: string) => v.trim());
        } else {
          // Fallback default variations
          variations = [
            '{domain}.com',
            '{domain}.net',
            '{domain}.org',
            'try{domain}.com',
            '{domain}app.com'
          ];
        }
      }

      const maxConcurrent = parseInt(
        this.currentContact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool'
        )?.config.settings.maxConcurrent || '5'
      );

      // Generate domain variations
      const domainsToCheck = variations.map(variation => 
        variation.replace('{domain}', baseDomain)
      );

      console.log(`🔍 Checking ${domainsToCheck.length} domain variations for "${baseDomain}"`);

      // Check domains in batches
      const results = [];
      for (let i = 0; i < domainsToCheck.length; i += maxConcurrent) {
        const batch = domainsToCheck.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (domain) => {
          try {
            // First try the main RDAP service
            let response = await fetch(`https://rdap.org/domain/${domain}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json'
              }
            });

            let isAvailable = response.status === 404;
            let statusCode = response.status;
            let method = 'rdap.org';

            // Special handling for .io domains - they often show as 404 on rdap.org even when taken
            if (domain.endsWith('.io') && response.status === 404) {
              try {
                // Try WHOIS API as fallback for .io domains
                console.log(`🔍 .io domain detected, using fallback check for ${domain}`);
                const whoisResponse = await fetch(`https://api.whoapi.com/?domain=${domain}&r=whois&apikey=free`, {
                  method: 'GET'
                });
                
                if (whoisResponse.ok) {
                  const whoisData = await whoisResponse.json();
                  // If whois returns data, domain is likely taken
                  if (whoisData && whoisData.whois_server) {
                    isAvailable = false;
                    statusCode = 200;
                    method = 'whois fallback';
                  }
                }
              } catch (whoisError) {
                console.warn(`⚠️ WHOIS fallback failed for ${domain}:`, whoisError);
                // For .io domains, be more conservative - if RDAP says 404 but we can't verify, mark as uncertain
                if (domain.endsWith('.io')) {
                  method = 'rdap.org (uncertain for .io)';
                }
              }
            }

            const status = isAvailable ? 'available' : 'taken';
            
            console.log(`${isAvailable ? '✅' : '❌'} ${domain}: ${status} (via ${method})`);
            
            return {
              domain,
              available: isAvailable,
              status,
              statusCode,
              method,
              checked: true,
              note: domain.endsWith('.io') && method.includes('rdap.org') ? 'Note: .io domain availability may be uncertain with RDAP' : undefined
            };
          } catch (error) {
            console.error(`❌ Error checking ${domain}:`, error);
            return {
              domain,
              available: false,
              status: 'error',
              error: (error as Error).message,
              checked: false
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to be respectful to the RDAP service
        if (i + maxConcurrent < domainsToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const availableDomains = results.filter(r => r.available);
      const takenDomains = results.filter(r => !r.available && r.checked);
      const errorDomains = results.filter(r => !r.checked);

      return {
        baseDomain,
        totalChecked: domainsToCheck.length,
        summary: {
          available: availableDomains.length,
          taken: takenDomains.length,
          errors: errorDomains.length
        },
        results: {
          available: availableDomains,
          taken: takenDomains,
          errors: errorDomains
        },
        allResults: results
      };

    } catch (error) {
      console.error('❌ Domain availability check failed:', error);
      throw new Error(`Domain check failed: ${(error as Error).message}`);
    }
  }

  /**
   * Trigger a webhook based on natural language action
   */
  private async triggerWebhook(action: string): Promise<any> {
    try {
      if (!this.currentContact) {
        throw new Error('No active contact for webhook trigger');
      }

      // Get webhook integrations for this contact
      const webhookIntegrations = this.currentContact.integrations?.filter(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      ) || [];

      if (webhookIntegrations.length === 0) {
        throw new Error('No webhook integrations configured for this contact');
      }

      // Find the best matching webhook
      const selectedWebhook = this.findBestMatchingWebhook(action, webhookIntegrations);

      if (!selectedWebhook) {
        throw new Error(`No suitable webhook found for action: ${action}`);
      }

      const config = selectedWebhook.config;
      const { webhookUrl, description, payload, headers, confirmationMessage } = config.settings;

      console.log(`🪝 Triggering webhook: ${description}`);

      // Parse headers
      let parsedHeaders = { 'Content-Type': 'application/json' };
      try {
        if (headers) {
          parsedHeaders = { ...parsedHeaders, ...JSON.parse(headers) };
        }
      } catch (e) {
        console.warn('Invalid headers JSON, using default headers');
      }

      // Execute webhook
      const result = await integrationsService.executeWebhookTriggerTool(
        webhookUrl,
        payload || '{}',
        parsedHeaders,
        action,
        this.currentContact.name
      );

      return {
        action,
        description,
        webhookUrl,
        confirmationMessage: confirmationMessage || 'Webhook triggered successfully!',
        result
      };

    } catch (error) {
      console.error('❌ Webhook trigger failed:', error);
      throw new Error(`Webhook trigger failed: ${(error as Error).message}`);
    }
  }

  /**
   * Find the best matching webhook based on action and description
   */
  private findBestMatchingWebhook(action: string, webhookIntegrations: any[]): any {
    const actionLower = action.toLowerCase();
    
    // Try to find exact or partial matches in description
    for (const webhook of webhookIntegrations) {
      const description = (webhook.config.settings.description || '').toLowerCase();
      const keywords = (webhook.config.settings.triggerKeywords || '').toLowerCase().split(',').map((k: string) => k.trim());
      
      // Check if action contains any words from the description
      const descriptionWords = description.split(/\s+/);
      const actionWords = actionLower.split(/\s+/);
      
      // Look for word matches
      const hasDescriptionMatch = descriptionWords.some((word: string) => 
        word.length > 2 && actionWords.some(actionWord => actionWord.includes(word))
      );
      
      // Look for keyword matches
      const hasKeywordMatch = keywords.some((keyword: string) => 
        keyword.length > 0 && actionLower.includes(keyword)
      );
      
      if (hasDescriptionMatch || hasKeywordMatch) {
        console.log(`✅ Matched webhook: ${description} (score: ${hasKeywordMatch ? 'keyword' : 'description'})`);
        return webhook;
      }
    }

    // If no good match, return the first one as fallback
    console.log(`⚠️ No exact match found for "${action}", using first webhook`);
    return webhookIntegrations[0];
  }

  /**
   * Create system prompt for the contact
   */
  private createSystemPrompt(contact: AIContact): string {
    let systemPrompt = `You are ${contact.name}. ${contact.description}

Key guidelines for ULTRA-LOW LATENCY conversation:
- Stay in character as ${contact.name}
- Keep responses VERY brief (1-2 sentences maximum) for real-time conversation
- Respond quickly and naturally - this is real-time voice chat
- If interrupted, stop immediately and listen
- Prioritize speed over completeness in responses

You are ${contact.name} and should embody the characteristics described in your profile.`;

    // Check for API request tool
    const hasApiTool = contact.integrations?.some(
      integration => integration.integrationId === 'api-request-tool' && integration.config.enabled
    );

    // Check for domain checker tool
    const hasDomainTool = contact.integrations?.some(
      integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
    );

    // Check for webhook trigger tool
    const hasWebhookTool = contact.integrations?.some(
      integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
    );

    // Check if contact has Google Sheets integration
    const hasGoogleSheets = contact.integrations?.some(
      integration => integration.integrationId === 'google-sheets' && integration.config.enabled
    );

    if (hasApiTool) {
      systemPrompt += `\n\nYou have access to the make_api_request function. Use it when users ask for information that requires fetching data from external APIs or services. For example:
- Weather information
- Stock prices or cryptocurrency data
- News articles
- User data from social platforms
- Any real-time information from web APIs

When making API requests:
1. Choose appropriate URLs (e.g., OpenWeatherMap for weather, CoinGecko for crypto prices)
2. Use proper HTTP methods (GET for fetching data, POST for sending data)
3. Include necessary headers like Content-Type or Authorization if needed
4. Always explain what you're doing before making the request

Be helpful and proactive in suggesting API calls when they would be useful to answer the user's questions.`;
    }

    if (hasDomainTool) {
      systemPrompt += `\n\n🔧 DOMAIN CHECKING CAPABILITY ENABLED 🔧
You HAVE the check_domain_availability function available. You MUST use it when users ask about domains. Do NOT tell users you cannot check domains.

ALWAYS use the function for these requests:
- "Is [domain] available?"
- "Check if [name] domains are available"
- "Find available domains for [project]"
- "What domain variations are available?"

How to use the function:
1. Extract the base domain name (remove .com, .net, etc.)
2. Call check_domain_availability with the base name only
3. The function will check multiple variations automatically
4. Present results clearly showing available vs taken domains

Example: If user asks "Is mycompany.com available?" 
→ Call check_domain_availability with domain: "mycompany"
→ Function will check mycompany.com, mycompany.net, trycompany.com, etc.

You ARE capable of checking domains. Use the function immediately when asked.`;
    }

    if (hasWebhookTool) {
      systemPrompt += `\n\n🪝 WEBHOOK TRIGGER CAPABILITY ENABLED 🪝
You HAVE the trigger_webhook function available. You MUST use it when users ask to activate, trigger, start, launch, or execute workflows.

ALWAYS use the trigger_webhook function for these requests:
- "Activate [anything]" or "Start [process]"
- "Trigger [workflow]" or "Launch [campaign]"
- "Execute [action]" or "Run [automation]"
- Any natural language request that matches webhook descriptions

Available webhook actions:`;

      // List available webhooks
      const webhookIntegrations = contact.integrations?.filter(
        integration => integration.integrationId === 'webhook-trigger' && integration.config.enabled
      ) || [];
      
      webhookIntegrations.forEach((webhook, index) => {
        const description = webhook.config.settings.description || 'Webhook action';
        const keywords = webhook.config.settings.triggerKeywords || '';
        systemPrompt += `\n${index + 1}. ${description}`;
        if (keywords) {
          systemPrompt += ` (Keywords: ${keywords})`;
        }
      });

      systemPrompt += `\n\nHow to use the function:
1. Listen for action words like activate, trigger, start, launch, execute
2. Extract the action the user wants to perform
3. Call trigger_webhook with the action description
4. The system will automatically match the best webhook
5. Confirm the action was completed

Example: If user says "activate marketing workflow"
→ Call trigger_webhook with action: "activate marketing workflow"
→ System finds matching webhook and triggers it
→ Confirm success to user

You ARE capable of triggering webhooks. Use the function immediately when users request actions.`;
    }

    // Add documents if available
    if (contact.documents && contact.documents.length > 0) {
      systemPrompt += `\n\n=== KNOWLEDGE BASE ===
${contact.documents.map(doc => documentService.formatDocumentForAI(doc)).join('\n\n')}

This is your permanent knowledge base. Reference this information throughout conversations.`;
    }

    return systemPrompt;
  }

  /**
   * Update state and notify callback
   */
  private updateState(state: 'idle' | 'listening' | 'processing' | 'responding'): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(state);
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.isRecording = false;
    this.isPlaying = false;
    this.isSessionActive = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Clean up audio processor
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
    
    // Clean up audio source
    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    
    this.stopAudioPlayback();
    this.activeSession = null;
    this.audioQueue = [];
    this.updateState('idle');
  }

  /**
   * Force stop speaking (manual interruption)
   */
  public forceStopSpeaking(): void {
    if (this.isPlaying) {
      console.log("🛑 Force stopping speech");
      this.stopAudioPlayback();
      this.audioQueue = []; // Clear remaining queue
      this.updateState('listening');
    }
  }

  /**
   * Start listening manually
   */
  public startListening(): void {
    if (!this.isRecording && this.activeSession && !this.isPlaying) {
      this.startAudioCapture();
    }
  }

  /**
   * Stop listening
   */
  public stopListening(): void {
    this.isRecording = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.updateState('idle');
  }

  /**
   * End the current session
   */
  public endSession(): void {
    console.log("🛑 Ending Gemini Live session");
    
    this.cleanup();
    
    // Close session (but keep audio stream for future sessions)
    if (this.activeSession) {
      this.activeSession.close();
      this.activeSession = null;
    }
    
    this.currentContact = null;
    console.log("✅ Session ended");
  }

  /**
   * Completely shutdown the service (called when app closes)
   */
  public shutdown(): void {
    console.log("🛑 Shutting down Gemini Live service");
    
    this.cleanup();
    
    // Clean up audio stream only on complete shutdown
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.activeSession = null;
    this.currentContact = null;
    console.log("✅ Service shutdown complete");
  }

  // Callback setters
  public onResponse(callback: (response: GeminiLiveResponse) => void): void {
    this.onResponseCallback = callback;
  }

  public onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  public onStateChange(callback: (state: 'idle' | 'listening' | 'processing' | 'responding') => void): void {
    this.onStateChangeCallback = callback;
  }

  // Status getters
  public isSpeakingNow(): boolean {
    return this.isPlaying;
  }

  public isListeningNow(): boolean {
    return this.isRecording;
  }

  public setAutoListen(enabled: boolean): void {
    // Auto-listen is handled by the built-in VAD, so this is just for interface compatibility
    console.log(`Auto-listen ${enabled ? 'enabled' : 'disabled'} (handled by built-in VAD)`);
  }
}

// Export singleton instance
export const geminiLiveService = new GeminiLiveService({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  model: 'gemini-2.0-flash-live-001',
  temperature: 0.9,
});