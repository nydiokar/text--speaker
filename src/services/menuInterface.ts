import * as readline from 'readline';
import { FileReader } from './fileReader';
import { WebReader } from './webReader';
import { SpeechService } from './speechService';
import { PlayerInterface } from './playerInterface';

export class MenuInterface {
  private rl: readline.Interface;
  private speechService: SpeechService;
  private fileReader: FileReader;
  private webReader: WebReader;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.speechService = new SpeechService();
    this.fileReader = new FileReader();
    this.webReader = new WebReader();
  }

  public async start(): Promise<void> {
    console.log('\nWelcome to Speaker AI!');
    await this.showMainMenu();
  }

  private async showMainMenu(): Promise<void> {
    await this.speechService.stop(); // Ensure any previous playback is stopped

    while (true) {
      console.log('\nMain Menu:');
      console.log('1. Read a text file');
      console.log('2. Read web content');
      console.log('3. Read specific text');
      console.log('4. Exit');

      const choice = await this.question('Enter your choice (1-4): ');
      
      switch (choice) {
        case '1':
          await this.handleFileReading();
          break;
        case '2':
          await this.handleWebReading();
          break;
        case '3':
          await this.handleDirectText();
          break;
        case '4':
          this.rl.close();
          process.exit(0);
          break;
        default:
          console.log('Invalid choice. Please try again.');
          continue;
      }
      break;
    }
  }

  private async handleFileReading(): Promise<void> {
    try {
      const filePath = await this.question('Enter the path to your text file: ');
      const voice = await this.selectVoiceFromList();
      const content = await this.fileReader.readTextFile(filePath);
      await this.handlePlayback(content, voice);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
  }

  private async handleWebReading(): Promise<void> {
    try {
      // Get URL and voice selection first
      const url = await this.question('Enter the webpage URL: ');
      const voice = await this.selectVoiceFromList();
      
      // Fetch content before starting playback
      console.log('\nFetching webpage content...');
      const content = await this.webReader.readWebPage(url);
      
      await this.handlePlayback(content, voice);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
  }

  private async handleDirectText(): Promise<void> {
    try {
      const text = await this.question('Enter the text you want to read: ');
      const voice = await this.selectVoiceFromList();
      await this.handlePlayback(text, voice);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
  }

  private async handlePlayback(content: string, voice: string | undefined): Promise<void> {
    console.log('\nStarting playback...\n');
    const player = new PlayerInterface(this.speechService);

    try {
        // Only pass voice if it's valid
        const validVoice = voice && voice !== 'undefined' ? voice : undefined;
        
        // Start the player interface first
        const playerPromise = player.startInteractiveMode();
        
        // Start speech after a short delay to ensure player is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        const speechPromise = this.speechService.speak(content, validVoice);

        // Wait for both to complete
        await Promise.all([
            playerPromise,
            speechPromise
        ]).catch(async (error) => {
            // Ensure speech is stopped on error
            await this.speechService.stop();
            throw error;
        });
    } catch (error) {
        console.error('Error during playback:', error);
    } finally {
        // Small delay before showing menu to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.showMainMenu();
    }
  }

  private async selectVoiceFromList(): Promise<string> {
    try {
      const voices = await this.speechService.getVoices();
  
      voices.forEach((voice, index) => {
        console.log(`${index + 1}. ${voice.name} (${voice.gender}, ${voice.culture})`);
      });

      while (true) {
        const selection = await this.question('\nSelect a voice number: ');
        const index = parseInt(selection, 10) - 1;
        
        if (index >= 0 && index < voices.length) {
          return voices[index].name;
        }
        console.log('Invalid selection. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  private question(query: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(query, (answer) => resolve(answer));
    });
  }
}
