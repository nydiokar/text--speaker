import { EventEmitter } from 'events';
import { TTSProvider } from './ttsProvider';
// import { WindowsTTSProvider } from './windowsTTSProvider'; // No longer default
import { GoogleTTSProvider } from './googleTTSProvider';

export class SpeechService extends EventEmitter {
  private ttsProvider: TTSProvider;

  constructor(provider: TTSProvider = new GoogleTTSProvider()) {
    super();
    this.ttsProvider = provider;
    // Forward events from the provider
    if (this.ttsProvider instanceof EventEmitter) {
      this.ttsProvider.on('done', () => this.emit('done'));
    }
  }

  public get isPaused(): boolean {
    return this.ttsProvider.isPaused;
  }

  public getCurrentProcess(): any {
    return this.ttsProvider.getCurrentProcess();
  }

  async speak(text: string): Promise<void> {
    await this.ttsProvider.speak(text);
  }

  async forward(): Promise<boolean> {
    return this.ttsProvider.forward();
  }

  async rewind(): Promise<boolean> {
    return this.ttsProvider.rewind();
  }

  async pause(): Promise<boolean> {
    return this.ttsProvider.pause();
  }

  async resume(): Promise<boolean> {
    return this.ttsProvider.resume();
  }

  async stop(): Promise<boolean> {
    return this.ttsProvider.stop();
  }
}
