import { app } from 'electron';
import { ChildProcess } from 'child_process';
import { SpeechService } from '../../../src/services/speechService';
import { WindowsTTSProvider } from '../../../src/services/windowsTTSProvider';
import type { PlaybackState } from '../renderer/types';
import { EventEmitter } from 'events';
import * as path from 'path';

interface StateData {
  sentenceIndex: number;
}

interface StateChangeEvent {
  state: PlaybackState;
  data: StateData;
  error?: Error;
}

export class SpeechBridge extends EventEmitter {
  private speechService!: SpeechService;
  private isInitialized: boolean = false;
  private isCleaning: boolean = false;
  private currentState: PlaybackState = 'stopped';
  private stateData: StateData = {
    sentenceIndex: 0
  };
  private cleanupHandlers: (() => void)[] = [];
  private isProcessing: boolean = false;

  constructor() {
    super();
    console.log('Initializing SpeechBridge...');
    try {
      // Set Google Cloud credentials path for Electron app
      const credentialsPath = path.join(__dirname, '../../../google-credentials.json');
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
      console.log('Set GOOGLE_APPLICATION_CREDENTIALS to:', credentialsPath);
      
      this.initializeSpeechService();
      this.setupCleanupHandlers();
      console.log('SpeechBridge initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SpeechBridge:', error);
      throw error;
    }
  }

  private initializeSpeechService() {
    // Use Windows TTS provider for Electron app - no external dependencies needed
    this.speechService = new SpeechService(new WindowsTTSProvider());
    
    // Map service states to UI states
    this.speechService.on('stateChanged', (event: any) => {
      let uiState: PlaybackState = 'stopped';
      
      switch (event.newState) {
        case 'playing':
          uiState = 'playing';
          break;
        case 'paused':
          uiState = 'paused';
          break;
        case 'stopped':
          uiState = 'stopped';
          break;
      }

      this.currentState = uiState;
      this.stateData = { ...event.data };
      
      this.emit('stateChanged', {
        state: uiState,
        data: this.stateData,
        error: event.error
      });
    });

    this.isInitialized = true;
  }

  private setupCleanupHandlers() {
    const beforeQuitHandler = async () => {
      console.log('Before quit detected, starting cleanup...');
      await this.cleanup();
    };
    app.on('before-quit', beforeQuitHandler);
    this.cleanupHandlers.push(() => app.removeListener('before-quit', beforeQuitHandler));

    const willQuitHandler = async () => {
      console.log('Will quit detected, ensuring cleanup...');
      await this.cleanup();
    };
    app.on('will-quit', willQuitHandler);
    this.cleanupHandlers.push(() => app.removeListener('will-quit', willQuitHandler));

    const windowAllClosedHandler = async () => {
      console.log('All windows closed, cleaning up...');
      await this.cleanup();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    };
    app.on('window-all-closed', windowAllClosedHandler);
    this.cleanupHandlers.push(() => app.removeListener('window-all-closed', windowAllClosedHandler));

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, cleaning up...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, cleaning up...');
      await this.cleanup();
      process.exit(0);
    });
  }

  private ensureInitialized() {
    if (!this.isInitialized || !this.speechService) {
      this.initializeSpeechService();
    }
  }

  getCurrentProcess(): ChildProcess | null {
    return this.speechService.getCurrentProcess();
  }

  get isPaused(): boolean {
    return this.currentState === 'paused';
  }

  get isActive(): boolean {
    return this.currentState === 'playing' || this.currentState === 'paused';
  }

  async speak(text: string): Promise<boolean> {
    if (this.isCleaning || this.isProcessing) {
      return false;
    }
    
    try {
      this.isProcessing = true;
      console.log('speak called:', { text: text.substring(0, 50) + '...' });
      this.ensureInitialized();
      await this.speechService.speak(text);
      return true;
    } catch (error) {
      console.error('speak error:', error);
      this.emit('error', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async pause(): Promise<boolean> {
    if (this.isCleaning || this.currentState !== 'playing' || this.isProcessing) {
      return false;
    }

    try {
      this.isProcessing = true;
      this.ensureInitialized();
      return await this.speechService.pause();
    } catch (error) {
      console.error('pause error:', error);
      this.emit('error', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async resume(): Promise<boolean> {
    if (this.isCleaning || this.currentState !== 'paused' || this.isProcessing) {
      return false;
    }

    try {
      this.isProcessing = true;
      this.ensureInitialized();
      return await this.speechService.resume();
    } catch (error) {
      console.error('resume error:', error);
      this.emit('error', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async stop(): Promise<boolean> {
    if (this.currentState === 'stopped' || this.isProcessing) {
      return true;
    }

    try {
      this.isProcessing = true;
      this.ensureInitialized();
      return await this.speechService.stop();
    } catch (error) {
      console.error('stop error:', error);
      this.emit('error', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async rewind(): Promise<boolean> {
    if (this.isCleaning || !this.isActive || this.isProcessing) {
      return false;
    }

    try {
      this.isProcessing = true;
      this.ensureInitialized();
      return await this.speechService.rewind();
    } catch (error) {
      console.error('rewind error:', error);
      this.emit('error', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async forward(): Promise<boolean> {
    if (this.isCleaning || !this.isActive || this.isProcessing) {
      return false;
    }

    try {
      this.isProcessing = true;
      this.ensureInitialized();
      return await this.speechService.forward();
    } catch (error) {
      console.error('forward error:', error);
      this.emit('error', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.isCleaning) return;
    
    this.isCleaning = true;
    console.log('Starting cleanup...');

    try {
      if (this.isInitialized) {
        await this.stop();
        this.cleanupHandlers.forEach(handler => handler());
        this.cleanupHandlers = [];
        this.speechService.removeAllListeners();
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      this.emit('error', error);
    } finally {
      this.isCleaning = false;
      console.log('Cleanup completed');
    }
  }
}
