import * as path from 'path';
import * as nodeProcess from 'process';
import { ChildProcess } from 'child_process';
import { SpeechService } from '../../../src/services/speechService';
import type { Voice } from '../renderer/types';

export class SpeechBridge {
  private speechService: SpeechService;
  private isInitialized: boolean = false;
  private currentVoice: string | undefined;
  private rootDir: string;

  constructor() {
    console.log('Initializing SpeechBridge...');
    try {
      this.rootDir = path.resolve(__dirname, '../../..');
      nodeProcess.chdir(this.rootDir);

      const tempDir = path.join(this.rootDir, 'temp_speech');
      if (!require('fs').existsSync(tempDir)) {
        require('fs').mkdirSync(tempDir, { recursive: true });
      }

      this.speechService = new SpeechService();
      this.isInitialized = true;
      console.log('SpeechBridge initialized with available methods:', 
        Object.getOwnPropertyNames(SpeechService.prototype));
    } catch (error) {
      console.error('Failed to initialize SpeechBridge:', error);
      throw error;
    }
  }

  private ensureInitialized() {
    if (!this.isInitialized || !this.speechService) {
      nodeProcess.chdir(this.rootDir);
      this.speechService = new SpeechService();
      this.isInitialized = true;
    }
  }

  async getVoices(): Promise<Voice[]> {
    this.ensureInitialized();
    return this.speechService.getVoices();
  }

  getCurrentProcess(): ChildProcess | null {
    return this.speechService.getCurrentProcess();
  }

  get isPaused(): boolean {
    return this.speechService.isPaused;
  }

  async speak(text: string, voice?: string): Promise<boolean> {
    console.log('speak called:', { text: text.substring(0, 50) + '...', voice });
    try {
      this.ensureInitialized();
      nodeProcess.chdir(this.rootDir);

      const speechProcess = await this.speechService.speak(text, voice);
      return speechProcess !== null;
    } catch (error) {
      console.error('speak error:', error);
      return false;
    }
  }

  async pause(): Promise<boolean> {
    try {
      this.ensureInitialized();
      return await this.speechService.pause();
    } catch (error) {
      console.error('pause error:', error);
      return false;
    }
  }

  async resume(): Promise<boolean> {
    try {
      this.ensureInitialized();
      return await this.speechService.resume();
    } catch (error) {
      console.error('resume error:', error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    try {
      this.ensureInitialized();
      return await this.speechService.stop();
    } catch (error) {
      console.error('stop error:', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.isInitialized) {
      await this.stop();
      this.isInitialized = false;
    }
  }
}
