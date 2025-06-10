import { EventEmitter } from 'events';
import { TTSProvider } from './ttsProvider';
import { WindowsTTSProvider } from './windowsTTSProvider';

export class SpeechService extends EventEmitter {
  private ttsProvider: TTSProvider;

  constructor(provider: TTSProvider = new WindowsTTSProvider()) {
    super();
    this.ttsProvider = provider;
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
