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
    console.log('\nWhat would you like to do?');
    console.log('1. Read a text file');
    console.log('2. Read web content');
    console.log('3. Read specific text');
    console.log('4. List available voices');
    console.log('5. Exit');

    const choice = await this.question('Enter your choice (1-5): ');
    
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
        await this.listVoices();
        break;
      case '5':
        this.rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid choice. Please try again.');
        await this.showMainMenu();
    }
  }

  private async handleFileReading(): Promise<void> {
    const filePath = await this.question('Enter the path to your text file: ');
    const voice = await this.selectVoice();
    
    try {
      const content = await this.fileReader.readTextFile(filePath);
      const player = new PlayerInterface(this.speechService);
      console.log('\nStarting playback...\n');
      await Promise.all([
        this.speechService.speak(content, voice),
        player.startInteractiveMode()
      ]);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    await this.showMainMenu();
  }

  private async handleWebReading(): Promise<void> {
    const url = await this.question('Enter the webpage URL: ');
    const voice = await this.selectVoice();
    
    try {
      console.log('\nFetching webpage content...');
      const content = await this.webReader.readWebPage(url);
      const player = new PlayerInterface(this.speechService);
      console.log('Starting playback...\n');
      await Promise.all([
        this.speechService.speak(content, voice),
        player.startInteractiveMode()
      ]);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    await this.showMainMenu();
  }

  private async handleDirectText(): Promise<void> {
    const text = await this.question('Enter the text you want to read: ');
    const voice = await this.selectVoice();
    
    try {
      const player = new PlayerInterface(this.speechService);
      console.log('\nStarting playback...\n');
      await Promise.all([
        this.speechService.speak(text, voice),
        player.startInteractiveMode()
      ]);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    await this.showMainMenu();
  }

  private async listVoices(): Promise<void> {
    try {
      const voices = await this.speechService.getVoices();
      console.log('\nAvailable voices:');
      voices.forEach((voice, index) => {
        console.log(`${index + 1}. ${voice.name} (${voice.gender}, ${voice.culture})`);
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    await this.showMainMenu();
  }

  private async selectVoice(): Promise<string | undefined> {
    const useVoice = await this.question('Would you like to select a specific voice? (y/N): ');
    
    if (useVoice.toLowerCase() === 'y') {
      await this.listVoices();
      const voiceName = await this.question('Enter the name of the voice to use: ');
      return voiceName;
    }

    return undefined;
  }

  private question(query: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(query, (answer) => resolve(answer));
    });
  }
}
