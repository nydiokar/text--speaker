import * as readline from 'readline';
import { SpeechService } from './speechService';

export class PlayerInterface {
  private rl: readline.Interface;
  private speechService: SpeechService;

  constructor(speechService: SpeechService) {
    this.speechService = speechService;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  public async startInteractiveMode(): Promise<void> {
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

    process.stdin.on('keypress', async (str, key) => {
      if (key.ctrl && key.name === 'c') {
        await this.quit();
      } else {
        await this.handleKeyPress(str, key);
      }
    });
  }

  private async handleKeyPress(str: string | undefined, key: any): Promise<void> {
    if (!key) return;

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
    console.log('\nStopping playback...');
    await this.speechService.stop();
    this.rl.close();
    process.exit(0);
  }
}
