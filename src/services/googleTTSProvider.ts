import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { EventEmitter } from 'events';
import { TTSProvider } from './ttsProvider';
import * as dotenv from 'dotenv';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ChildProcess, spawn } from 'child_process';
const ffplay = require('ffplay-static');

dotenv.config();

type SpeechState = 'stopped' | 'playing' | 'paused';

export class GoogleTTSProvider extends EventEmitter implements TTSProvider {
  private client: TextToSpeechClient;
  private currentState: SpeechState = 'stopped';
  private currentSentences: string[] = [];
  private currentSentenceIndex: number = 0;
  private currentProcess: ChildProcess | null = null;
  private currentTempPath: string | null = null;
  private resolveSpeakPromise: (() => void) | null = null;

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
    await this.stop(); // Ensure a clean state
    this.currentSentences = this.splitIntoSentences(text);
    this.currentSentenceIndex = 0;
    this.currentState = 'playing';
    
    return new Promise((resolve) => {
        this.resolveSpeakPromise = resolve;
        this.speakCurrentSentence();
    });
  }

  private async speakCurrentSentence(): Promise<void> {
    if (this.currentState !== 'playing' || this.currentSentenceIndex >= this.currentSentences.length) {
      this.currentState = 'stopped';
      this.emit('done');
      if (this.resolveSpeakPromise) {
          this.resolveSpeakPromise();
          this.resolveSpeakPromise = null;
      }
      return;
    }
  
    const text = this.currentSentences[this.currentSentenceIndex];
  
    try {
      await this.speakText(text);
      // If we are still playing, move to the next sentence
      if (this.currentState === 'playing') {
        await new Promise(resolve => setTimeout(resolve, 350));
        this.currentSentenceIndex++;
        this.speakCurrentSentence(); // Continue the loop
      }
    } catch (error) {
        // This block is entered when ffplay is killed or exits with an error.
        // It acts as the signal handler for the state machine.
        if (this.currentState === 'playing') {
            // This happens on forward/rewind. The index is already updated, so we just continue the loop.
            this.speakCurrentSentence();
        } else {
            // This happens on a hard stop or a real error. We resolve the master promise.
            if (this.resolveSpeakPromise) {
                this.resolveSpeakPromise();
                this.resolveSpeakPromise = null;
            }
        }
    }
  }

  private async speakText(text: string): Promise<void> {
    if (!text) return;
  
    console.log(`[GoogleTTSProvider] Requesting speech for: "${text.substring(0, 70)}..."`);
    const [response] = await this.client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.9
      },
    });
  
    if (!response.audioContent) {
      throw new Error('API response did not contain audio content.');
    }

    this.currentTempPath = path.join(os.tmpdir(), `speech_${Date.now()}.mp3`);
    await fs.writeFile(this.currentTempPath, response.audioContent, 'binary');

    return new Promise((resolve, reject) => {
      const args = ['-nodisp', '-autoexit', '-i', this.currentTempPath as string];
      this.currentProcess = spawn(ffplay.default, args);

      this.currentProcess.on('close', (code) => {
        this.cleanupTempFile().then(() => {
          if (code === 0) {
            resolve();
          } else {
            // A non-zero exit code will trigger the catch block in speakCurrentSentence
            reject(new Error(`ffplay exited with code ${code}`));
          }
        });
      });

      this.currentProcess.on('error', (err) => {
        this.cleanupTempFile().then(() => {
          reject(err);
        });
      });
    });
  }

  private async cleanupTempFile(): Promise<void> {
    const pathToDelete = this.currentTempPath;
    if (pathToDelete) {
        this.currentTempPath = null; // Prevent re-entry
        let attempts = 0;
        const maxAttempts = 5;
        const delay = 100; // ms
  
        while(attempts < maxAttempts) {
          try {
            await fs.unlink(pathToDelete);
            return; // Success
          } catch (err: any) {
            if (err.code === 'EBUSY' && attempts < maxAttempts - 1) {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              // On the last attempt or for other errors, log it but don't crash
              console.error(`Failed to cleanup temp file '${pathToDelete}' after ${attempts + 1} attempts:`, err);
              return;
            }
          }
        }
      }
  }

  async stop(): Promise<boolean> {
    this.currentState = 'stopped';
    if (this.currentProcess) {
      this.currentProcess.kill('SIGKILL');
      this.currentProcess = null;
    }
    await this.cleanupTempFile();
    this.currentSentences = [];
    this.currentSentenceIndex = 0;
    
    // Explicitly resolve the main promise on stop
    if (this.resolveSpeakPromise) {
        this.resolveSpeakPromise();
        this.resolveSpeakPromise = null;
    }
    return true;
  }

  async pause(): Promise<boolean> {
    if (this.currentState !== 'playing' || !this.currentProcess) return false;
    this.currentState = 'paused';
    this.currentProcess.kill('SIGKILL');
    this.currentProcess = null;
    console.log("Playback paused.");
    return true;
  }

  async resume(): Promise<boolean> {
    if (this.currentState !== 'paused') return false;
    this.currentState = 'playing';
    console.log("Resuming playback...");
    // The main loop will be kicked off from the current index.
    this.speakCurrentSentence();
    return true;
  }
  
  async forward(): Promise<boolean> {
    if (this.currentState === 'stopped') return false;
    if (this.currentSentenceIndex < this.currentSentences.length - 1) {
        this.currentSentenceIndex++;
        if (this.currentProcess) {
            // Killing the process will trigger the catch block in speakCurrentSentence,
            // which will then call speakCurrentSentence again with the new index.
            this.currentProcess.kill('SIGKILL');
        } else if (this.currentState === 'paused') {
            this.resume();
        }
        return true;
    }
    return false;
  }

  async rewind(): Promise<boolean> {
    if (this.currentState === 'stopped') return false;
    if (this.currentSentenceIndex > 0) {
        this.currentSentenceIndex--;
        if (this.currentProcess) {
            this.currentProcess.kill('SIGKILL');
        } else if (this.currentState === 'paused') {
            this.resume();
        }
        return true;
    }
    return false;
  }
} 