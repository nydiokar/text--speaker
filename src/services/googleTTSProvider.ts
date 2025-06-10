import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { EventEmitter } from 'events';
import { TTSProvider } from './ttsProvider';
import * as sound from 'sound-play';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync, unlinkSync } from 'fs';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

dotenv.config();

const writeFileAsync = promisify(writeFileSync);
const unlinkAsync = promisify(unlinkSync);

type SpeechState = 'stopped' | 'playing' | 'paused';

export class GoogleTTSProvider extends EventEmitter implements TTSProvider {
  private client: TextToSpeechClient;
  private currentProcess: any | null = null;
  private currentState: SpeechState = 'stopped';
  private currentSentences: string[] = [];
  private currentSentenceIndex: number = 0;
  private isProcessing: boolean = false;
  private tempFilePath: string | null = null;

  constructor() {
    super();
    this.client = new TextToSpeechClient();
  }

  public get isPaused(): boolean {
    return this.currentState === 'paused';
  }

  public getCurrentProcess(): any | null {
    return this.currentProcess;
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  async speak(text: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.stop();
      this.currentSentences = this.splitIntoSentences(text);
      this.currentSentenceIndex = 0;
      this.currentState = 'playing';
      await this.speakCurrentSentence();
    } catch (error) {
      console.error('Speak error:', error);
      this.currentState = 'stopped';
    } finally {
      this.isProcessing = false;
    }
  }

  private async speakCurrentSentence(): Promise<void> {
    if (this.currentState !== 'playing' || this.currentSentenceIndex >= this.currentSentences.length) {
      this.currentState = 'stopped';
      this.emit('done');
      return;
    }
  
    const text = this.currentSentences[this.currentSentenceIndex];
  
    try {
      await this.speakText(text);
      if (this.currentState === 'playing') {
        this.currentSentenceIndex++;
        await this.speakCurrentSentence();
      }
    } catch (error) {
        if (this.currentState !== 'stopped') {
            console.error('Error in speakCurrentSentence:', error);
            this.currentState = 'stopped';
        }
    }
  }

  async forward(): Promise<boolean> {
    if (this.currentState !== 'playing' || this.isProcessing) return false;
    if (this.currentSentenceIndex < this.currentSentences.length - 1) {
      this.isProcessing = true;
      await this.stop(true); // Stop current playback without changing state
      this.currentSentenceIndex++;
      await this.speakCurrentSentence();
      this.isProcessing = false;
      return true;
    }
    return false;
  }

  async rewind(): Promise<boolean> {
    if (this.currentState !== 'playing' || this.isProcessing) return false;
    if (this.currentSentenceIndex > 0) {
      this.isProcessing = true;
      await this.stop(true); // Stop current playback without changing state
      this.currentSentenceIndex--;
      await this.speakCurrentSentence();
      this.isProcessing = false;
      return true;
    }
    return false;
  }

  private async speakText(text: string): Promise<void> {
    if (!text) {
      return;
    }

    try {
        const request = {
            input: { text: text },
            voice: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
            audioConfig: { audioEncoding: 'MP3' as const },
          };
      
          const [response] = await this.client.synthesizeSpeech(request);
          this.tempFilePath = join(tmpdir(), `speech_${Date.now()}.mp3`);
          await writeFileAsync(this.tempFilePath, response.audioContent as Uint8Array, 'binary');
          
          await new Promise<void>((resolve, reject) => {
              this.currentProcess = sound.play(this.tempFilePath as string);
              this.currentProcess.on('exit', (code: number | null) => {
                  if (code === 0) {
                      resolve();
                  } else {
                      // Don't reject on non-zero exit code if we stopped it manually
                      if (this.currentState !== 'stopped' && this.currentState !== 'paused') {
                          reject(new Error(`Audio player exited with code ${code}`));
                      } else {
                          resolve();
                      }
                  }
                  this.currentProcess = null;
                  this.cleanupTempFile();
              });
              this.currentProcess.on('error', (err: Error) => {
                reject(err);
                this.currentProcess = null;
                this.cleanupTempFile();
              });
          });

    } catch(error){
        console.error('Error in speakText:', error);
        throw error;
    }
  }

  async pause(): Promise<boolean> {
    if (this.currentState !== 'playing' || this.isProcessing) return false;
    this.currentState = 'paused';
    if (this.currentProcess) {
      this.currentProcess.kill();
    }
    return true;
  }

  async resume(): Promise<boolean> {
    if (this.currentState !== 'paused' || this.isProcessing) return false;
    this.currentState = 'playing';
    await this.speakCurrentSentence();
    return true;
  }

  async stop(keepState: boolean = false): Promise<boolean> {
    if (!keepState) {
        this.currentState = 'stopped';
    }
    this.currentSentences = [];
    this.currentSentenceIndex = 0;
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
        this.currentProcess = null;
      } catch (error) {
          console.error("Failed to kill process", error)
      }
    }
    await this.cleanupTempFile();
    return true;
  }

  private async cleanupTempFile(): Promise<void> {
    if (this.tempFilePath) {
      try {
        await unlinkAsync(this.tempFilePath);
        this.tempFilePath = null;
      } catch (error) {
        // Ignore errors if file doesn't exist
        if (error.code !== 'ENOENT') {
          console.error('Failed to clean up temp file:', error);
        }
      }
    }
  }
} 