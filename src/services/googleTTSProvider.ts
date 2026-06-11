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
  private static readonly MAX_CHUNK_LENGTH = 180;
  private static readonly MIN_PLAYBACK_TIMEOUT_MS = 30000;
  private static readonly PLAYBACK_TIMEOUT_MS_PER_CHAR = 140;

  private client: TextToSpeechClient;
  private currentState: SpeechState = 'stopped';
  private currentSentences: string[] = [];
  private currentSentenceIndex: number = 0;
  private currentProcess: ChildProcess | null = null;
  private resolveSpeakPromise: (() => void) | null = null;
  private isProcessExiting: boolean = false;
  private playbackInterrupted: boolean = false;

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
      .flatMap(s => this.splitLongSentence(s.trim()))
      .filter(s => s.length > 0);
  }

  private splitLongSentence(text: string): string[] {
    if (text.length <= GoogleTTSProvider.MAX_CHUNK_LENGTH) {
      return [text];
    }

    const chunks: string[] = [];
    const delimiters = /([:;,]\s+|\s+-\s+|\n+)/g;
    const parts = text.split(delimiters).filter(part => part.trim().length > 0);
    let currentChunk = '';

    const pushChunk = () => {
      const trimmed = currentChunk.trim();
      if (trimmed) {
        chunks.push(trimmed);
      }
      currentChunk = '';
    };

    for (const part of parts) {
      const candidate = currentChunk ? `${currentChunk}${part}` : part;
      if (candidate.trim().length <= GoogleTTSProvider.MAX_CHUNK_LENGTH) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        pushChunk();
      }

      if (part.trim().length <= GoogleTTSProvider.MAX_CHUNK_LENGTH) {
        currentChunk = part;
        continue;
      }

      const words = part.trim().split(/\s+/);
      for (const word of words) {
        const wordCandidate = currentChunk ? `${currentChunk} ${word}` : word;
        if (wordCandidate.length <= GoogleTTSProvider.MAX_CHUNK_LENGTH) {
          currentChunk = wordCandidate;
        } else {
          pushChunk();
          currentChunk = word;
        }
      }
    }

    pushChunk();
    return chunks;
  }

  async speak(text: string): Promise<void> {
    await this.stop(); // Ensure a clean state
    this.currentSentences = this.splitIntoSentences(text);
    this.currentSentenceIndex = 0;
    this.currentState = 'playing';
    this.isProcessExiting = false;
    this.playbackInterrupted = false;
    
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
        if (this.playbackInterrupted) {
          this.playbackInterrupted = false;
          this.speakCurrentSentence();
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 350));
        this.currentSentenceIndex++;
        this.speakCurrentSentence(); // Continue the loop
      }
    } catch (error) {
        // Handle ffplay errors more gracefully - just skip to next sentence
        if (this.currentState === 'playing') {
            if (this.playbackInterrupted) {
                this.playbackInterrupted = false;
                this.speakCurrentSentence();
                return;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Skipping sentence ${this.currentSentenceIndex} due to playback error:`, errorMessage);
            // Move to next sentence and continue
            this.currentSentenceIndex++;
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

    const tempPath = path.join(os.tmpdir(), `speech_${Date.now()}_${this.currentSentenceIndex}.mp3`);
    await fs.writeFile(tempPath, response.audioContent, 'binary');

    return new Promise((resolve, reject) => {
      const args = ['-nodisp', '-autoexit', '-i', tempPath];
      const process = spawn(ffplay.default, args, {
        stdio: 'ignore', // Reduce noise from ffplay
        windowsHide: true // Hide the ffplay window on Windows
      });
      this.currentProcess = process;

      let hasResolved = false;
      let timeoutId: NodeJS.Timeout | null = null;
      const playbackTimeout = Math.max(
        GoogleTTSProvider.MIN_PLAYBACK_TIMEOUT_MS,
        text.length * GoogleTTSProvider.PLAYBACK_TIMEOUT_MS_PER_CHAR
      );

      const cleanup = () => {
        if (hasResolved) return;
        hasResolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (this.currentProcess === process) {
          this.currentProcess = null;
        }
        this.cleanupTempFile(tempPath)
          .then(() => {
            if (!this.isProcessExiting) {
              resolve();
            }
          })
          .catch(reject);
      };

      // Add a timeout to prevent hanging
      timeoutId = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          if (this.currentProcess === process) {
            this.currentProcess = null;
          }
          if (!process.killed) {
            process.kill('SIGKILL');
          }
          this.cleanupTempFile(tempPath)
            .then(() => {
              reject(new Error(`ffplay timeout after ${playbackTimeout}ms`));
            })
            .catch(reject);
        }
      }, playbackTimeout);

      process.on('close', (code) => {
        // Handle null exit code (process killed) more gracefully
        if (code === null || code === 0) {
          cleanup();
        } else {
          if (!hasResolved) {
            hasResolved = true;
            if (this.currentProcess === process) {
              this.currentProcess = null;
            }
            this.cleanupTempFile(tempPath)
              .then(() => {
                reject(new Error(`ffplay exited with code ${code}`));
              })
              .catch(reject);
          }
        }
      });

      process.on('error', (err) => {
        if (!hasResolved) {
          hasResolved = true;
          if (this.currentProcess === process) {
            this.currentProcess = null;
          }
          this.cleanupTempFile(tempPath)
            .then(() => {
              reject(err);
            })
            .catch(reject);
        }
      });

      // Handle process exit more gracefully
      process.on('exit', (code) => {
        if (code === null || code === 0) {
          cleanup();
        }
      });
    });
  }

  private async cleanupTempFile(pathToDelete: string | null): Promise<void> {
    if (!pathToDelete) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 5;
    const delay = 100; // ms

    while (attempts < maxAttempts) {
      try {
        await fs.unlink(pathToDelete);
        return;
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return;
        }

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

  async stop(): Promise<boolean> {
    this.isProcessExiting = true;
    this.playbackInterrupted = false;
    this.currentState = 'stopped';
    if (this.currentProcess) {
      this.currentProcess.kill('SIGKILL');
      this.currentProcess = null;
    }
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
    this.playbackInterrupted = true;
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
            this.playbackInterrupted = true;
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
            this.playbackInterrupted = true;
            this.currentProcess.kill('SIGKILL');
        } else if (this.currentState === 'paused') {
            this.resume();
        }
        return true;
    }
    return false;
  }
} 
