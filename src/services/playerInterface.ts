import * as readline from 'readline';
import { SpeechService } from './speechService';

export class PlayerInterface {
  private speechService: SpeechService;
  private isActive: boolean = true;

  constructor(speechService: SpeechService) {
    this.speechService = speechService;
  }

  public async startInteractiveMode(): Promise<void> {
    this.isActive = true;
    console.log('\nPlayback Controls:');
    console.log('  [space] - Pause/Resume');
    console.log('  [←/→]  - Previous/Next sentence');
    console.log('  [q]    - Quit\n');
    
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    return new Promise<void>((resolve) => {
      const keypressHandler = async (_: string, key: any) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'q') {
          await this.stop();
          cleanup();
          resolve();
        } else {
          await this.handleKeyPress(key);
        }
      };

      const cleanup = () => {
        process.stdin.removeListener('keypress', keypressHandler);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        this.isActive = false;
      };

      process.stdin.on('keypress', keypressHandler);
    });
  }

  private async handleKeyPress(key: any): Promise<void> {
    if (!key || !this.isActive) return;

    switch (key.name) {
      case 'space':
        if (this.speechService.isPaused) {
          console.log('\nResuming playback...');
          await this.speechService.resume();
        } else {
          console.log('\nPausing playback...');
          await this.speechService.pause();
        }
        break;

      case 'right':
        await this.speechService.forward();
        break;

      case 'left':
        await this.speechService.rewind();
        break;

      case 'q':
        await this.stop();
        break;
    }
  }

  private async stop(): Promise<void> {
    if (!this.isActive) return;
    console.log('\nStopping playback...');
    this.isActive = false;
    await this.speechService.stop();
  }
}
