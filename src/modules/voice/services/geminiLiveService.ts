import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CallState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  isRecording: boolean;
  isSpeaking: boolean;
  error?: string;
  transcript?: string;
  response?: string;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

class GeminiLiveService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isInitialized = false;
  private callState: CallState = {
    status: 'idle',
    isRecording: false,
    isSpeaking: false
  };
  private stateChangeCallbacks: ((state: CallState) => void)[] = [];

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // Subscribe to state changes
  onStateChange(callback: (state: CallState) => void) {
    this.stateChangeCallbacks.push(callback);
    // Immediately call with current state
    callback(this.callState);
    
    // Return unsubscribe function
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  private updateState(updates: Partial<CallState>) {
    this.callState = { ...this.callState, ...updates };
    this.stateChangeCallbacks.forEach(callback => callback(this.callState));
  }

  async initializeAudio(): Promise<void> {
    try {
      console.log('🎤 Starting audio initialization...');
      
      // Create AudioContext with optimal settings
      this.audioContext = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      
      console.log('✅ AudioContext created');

      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('✅ Microphone access granted');

      // Initialize MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.isInitialized = true;
      console.log('🎤 Audio initialized with ULTRA-LOW latency');
      
    } catch (error) {
      console.error('❌ Audio initialization failed:', error);
      this.updateState({ 
        status: 'error', 
        error: `Audio initialization failed: ${error.message}` 
      });
      throw error;
    }
  }

  async startCall(contactName: string, contactDescription?: string): Promise<void> {
    try {
      console.log(`🎤 Starting call with ${contactName}...`);
      
      if (!this.isInitialized) {
        await this.initializeAudio();
      }

      this.updateState({ status: 'connecting' });

      // Initialize the Gemini model for conversation
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        systemInstruction: `You are ${contactName}. ${contactDescription || 'You are a helpful AI assistant.'} 
        
        Keep your responses conversational and natural, as if you're speaking in a voice call. 
        Be concise but engaging. Respond as if you're having a real-time conversation.`
      });

      this.updateState({ 
        status: 'connected',
        transcript: '',
        response: `Connected to ${contactName}. Start speaking!`
      });

      console.log(`✅ Call started with ${contactName}`);
      
    } catch (error) {
      console.error('❌ Failed to start call:', error);
      this.updateState({ 
        status: 'error', 
        error: `Failed to start call: ${error.message}` 
      });
      throw error;
    }
  }

  async endCall(): Promise<void> {
    try {
      console.log('🎤 Ending call...');
      
      // Stop recording if active
      if (this.mediaRecorder && this.callState.isRecording) {
        this.mediaRecorder.stop();
      }

      // Stop audio stream
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }

      // Close audio context
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.mediaRecorder = null;
      this.model = null;
      this.isInitialized = false;

      this.updateState({ 
        status: 'disconnected',
        isRecording: false,
        isSpeaking: false,
        transcript: '',
        response: ''
      });

      console.log('✅ Call ended successfully');
      
    } catch (error) {
      console.error('❌ Error ending call:', error);
      this.updateState({ 
        status: 'error', 
        error: `Error ending call: ${error.message}` 
      });
    }
  }

  async startRecording(): Promise<void> {
    if (!this.mediaRecorder || this.callState.status !== 'connected') {
      throw new Error('Call not active or recorder not available');
    }

    try {
      this.updateState({ isRecording: true });
      
      const audioChunks: Blob[] = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          await this.processAudio(audioBlob);
        } catch (error) {
          console.error('❌ Error processing audio:', error);
          this.updateState({ 
            error: `Audio processing failed: ${error.message}`,
            isRecording: false 
          });
        }
      };

      this.mediaRecorder.start();
      console.log('🎤 Recording started');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.updateState({ 
        isRecording: false,
        error: `Recording failed: ${error.message}` 
      });
      throw error;
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.callState.isRecording) {
      this.mediaRecorder.stop();
      this.updateState({ isRecording: false });
      console.log('🎤 Recording stopped');
    }
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    try {
      console.log('🎤 Processing audio...');
      this.updateState({ isSpeaking: true });

      // Convert audio to text (simplified - in real implementation you'd use speech-to-text)
      const transcript = "User spoke"; // Placeholder
      this.updateState({ transcript });

      // Generate response using Gemini
      if (this.model) {
        const result = await this.model.generateContent(transcript);
        const response = result.response.text();
        
        this.updateState({ 
          response,
          isSpeaking: false 
        });

        // In a real implementation, you'd convert text to speech here
        console.log('🎤 AI Response:', response);
      }
      
    } catch (error) {
      console.error('❌ Audio processing error:', error);
      this.updateState({ 
        isSpeaking: false,
        error: `Processing error: ${error.message}` 
      });
    }
  }

  getCallState(): CallState {
    return this.callState;
  }

  isCallActive(): boolean {
    return this.callState.status === 'connected';
  }

  cleanup(): void {
    if (this.callState.status !== 'idle') {
      this.endCall();
    }
  }
}

// Export singleton instance
export const geminiLiveService = new GeminiLiveService();