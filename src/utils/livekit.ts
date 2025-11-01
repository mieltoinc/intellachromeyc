/**
 * LiveKit Voice Chat Integration
 * Handles real-time voice communication with the AI agent
 */

import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';

export interface LiveKitConfig {
  wsUrl: string;
  token: string;
  apiKey?: string;
  userId?: string;
}

export class LiveKitVoiceChat {
  private room: Room | null = null;
  private isConnected = false;
  private onMessageCallback?: (message: string) => void;

  constructor() {
    this.room = new Room();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      console.log('🎙️ Connected to LiveKit room');
      this.isConnected = true;
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('🎙️ Disconnected from LiveKit room');
      this.isConnected = false;
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        console.log('🔊 Audio track received from agent');
        const audioElement = track.attach();
        document.body.appendChild(audioElement);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach();
    });

    // Handle data messages from the agent
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      const message = new TextDecoder().decode(payload);
      console.log('📨 Received message from agent:', message);
      
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });
  }

  async connect(config: LiveKitConfig): Promise<void> {
    if (!this.room) {
      throw new Error('Room not initialized');
    }

    try {
      console.log('🔗 Connecting to LiveKit with config:', { 
        wsUrl: config.wsUrl, 
        hasToken: !!config.token,
        hasApiKey: !!config.apiKey 
      });

      await this.room.connect(config.wsUrl, config.token, {
        autoSubscribe: true,
      });

      console.log('🔗 Connected to LiveKit with API key in participant attributes');

    } catch (error) {
      console.error('❌ Failed to connect to LiveKit:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.isConnected = false;
    }
  }

  async enableMicrophone(): Promise<void> {
    if (!this.room) return;

    try {
      // First request microphone permission explicitly
      console.log('🎤 Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the test stream immediately (LiveKit will handle the actual stream)
      stream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone permission granted');

      // Now enable microphone in LiveKit
      await this.room.localParticipant.setMicrophoneEnabled(true);
      console.log('🎤 Microphone enabled in LiveKit');
    } catch (error) {
      console.error('❌ Failed to enable microphone:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('Microphone permission was denied. Please allow microphone access and try again.');
      }
      throw error;
    }
  }

  async disableMicrophone(): Promise<void> {
    if (!this.room) return;

    try {
      await this.room.localParticipant.setMicrophoneEnabled(false);
      console.log('🎤 Microphone disabled');
    } catch (error) {
      console.error('❌ Failed to disable microphone:', error);
      throw error;
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.room || !this.isConnected) {
      throw new Error('Not connected to room');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    await this.room.localParticipant.publishData(data, { reliable: true });
  }

  onMessage(callback: (message: string) => void): void {
    this.onMessageCallback = callback;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get microphoneEnabled(): boolean {
    return this.room?.localParticipant.isMicrophoneEnabled ?? false;
  }
}

/**
 * Creates a LiveKit room token by calling LiveKit Cloud sandbox service
 */
export async function createLiveKitToken(_apiKey: string, _userId?: string): Promise<{ token: string; wsUrl: string }> {
  try {
    console.log('🔗 Creating LiveKit token using sandbox API...');
    
    // Generate unique room and participant names
    const roomName = `voice-chat-${Date.now()}`;
    const participantName = `user-${Date.now()}`;
    
    // Call LiveKit Cloud sandbox API to generate the token
    const response = await fetch('https://cloud-api.livekit.io/api/sandbox/connection-details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sandbox-ID': 'intellayc-2arwvh'
      },
      body: JSON.stringify({
        room_name: roomName,
        participant_name: participantName,
        participant_attributes: {
          api_key: _apiKey
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create token: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ LiveKit token created successfully:', {
      roomName: data.roomName,
      participantName: data.participantName,
      hasToken: !!data.participantToken,
      serverUrl: data.serverUrl
    });
    
    return {
      token: data.participantToken,
      wsUrl: data.serverUrl
    };
  } catch (error) {
    console.error('❌ Failed to create LiveKit token:', error);
    throw error;
  }
}