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
    console.log('  [←] or [b] - Rewind');
    console.log('  [→] or [f] - Forward');
    console.log('  [r] - Replay current segment');
    console.log('  [q] - Quit\n');

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    return new Promise<void>((resolve) => {
      const keypressHandler = async (str: string, key: any) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'q') {
          await this.quit();
          cleanup();
          resolve();
        } else {
          await this.handleKeyPress(str, key);
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

  private async handleKeyPress(str: string | undefined, key: any): Promise<void> {
    if (!key || !this.isActive) return;

    switch (key.name) {
      case 'space':
        if (this.speechService.isPaused()) {
          console.log('\nResuming playback...');
          await this.speechService.resume();
        } else {
          console.log('\nPausing playback...');
          await this.speechService.pause();
        }
        break;

      case 'left':
      case 'b':
        console.log('\nRewinding...');
        await this.speechService.rewind();
        break;

      case 'right':
      case 'f':
        console.log('\nForwarding...');
        await this.speechService.forward();
        break;

      case 'r':
        console.log('\nReplaying current segment...');
        await this.speechService.replay(); 
        break;

      case 'q':
        await this.quit();
        break;
    }
  }

  private async quit(): Promise<void> {
    if (!this.isActive) return;
    console.log('\nStopping playback...');
    this.isActive = false;
    await this.speechService.stop();
  }
}
