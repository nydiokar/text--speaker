import { exec, execSync, ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import { TTSProvider } from './ttsProvider';

const execAsync = promisify(exec);

type SpeechState = 'stopped' | 'playing' | 'paused';

export class WindowsTTSProvider extends EventEmitter implements TTSProvider {
  private powershellPath: string;
  private currentProcess: ChildProcess | null = null;
  private currentState: SpeechState = 'stopped';
  private currentText: string = '';
  private currentSentences: string[] = [];
  private currentSentenceIndex: number = 0;
  private isProcessing: boolean = false;
  
  constructor() {
    super();
    try {
      this.powershellPath = execSync('where powershell.exe').toString().trim();
    } catch (error) {
      console.error('SpeechService initialization error:', error);
      throw error;
    }
  }

  public get isPaused(): boolean {
    return this.currentState === 'paused';
  }

  public getCurrentProcess(): ChildProcess | null {
    return this.currentProcess;
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  async speak(text: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.cleanupProcess();
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
    if (this.currentSentenceIndex >= this.currentSentences.length) {
      this.currentState = 'stopped';
      return;
    }

    this.currentText = this.currentSentences[this.currentSentenceIndex];
    await this.speakText();

    if (this.currentState === 'playing') {
      this.currentSentenceIndex++;
      await this.speakCurrentSentence();
    }
  }

  async forward(): Promise<boolean> {
    if (this.currentState !== 'playing' || this.isProcessing) return false;

    try {
      this.isProcessing = true;
      if (this.currentSentenceIndex < this.currentSentences.length - 1) {
        this.currentSentenceIndex++;
        await this.speakCurrentSentence();
        return true;
      }
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async rewind(): Promise<boolean> {
    if (this.currentState !== 'playing' || this.isProcessing) return false;

    try {
      this.isProcessing = true;
      if (this.currentSentenceIndex > 0) {
        this.currentSentenceIndex--;
        await this.speakCurrentSentence();
        return true;
      }
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  private async speakText(): Promise<void> {
    if (!this.currentText) {
      this.currentState = 'stopped';
      return;
    }

    await this.cleanupProcess();

    return new Promise((resolve, reject) => {
      const tempFile = join(tmpdir(), `speech_${Date.now()}.txt`);
      writeFileSync(tempFile, '\ufeff' + this.currentText, 'utf16le');
      
      const script = `
        Try {
          Add-Type -AssemblyName System.Speech
          $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
          $synth.Rate = 0
          $synth.Volume = 100
          $text = [IO.File]::ReadAllText('${tempFile.replace(/\\/g, '\\\\')}', [Text.Encoding]::Unicode)
          $synth.Speak($text)
        } Finally {
          if ($synth) {
            $synth.Dispose()
          }
          if (Test-Path '${tempFile.replace(/\\/g, '\\\\')}') {
            Remove-Item -Path '${tempFile.replace(/\\/g, '\\\\')}' -Force
          }
          Write-Output 'DONE'
        }
      `;

      const process = spawn(this.powershellPath, ['-NoProfile', '-Command', script]);
      this.currentProcess = process;

      process.stdout.on('data', (data) => {
        if (data.toString().includes('DONE')) {
          resolve();
        }
      });

      process.stderr.on('data', (data) => {
        console.error('Speech error:', data.toString());
      });

      process.on('error', (error) => {
        console.error('Process error:', error);
        reject(error);
      });

      process.on('exit', (code) => {
        this.currentProcess = null;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  private async cleanupProcess(): Promise<void> {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
        await new Promise<void>((resolve) => {
          this.currentProcess?.on('exit', () => resolve());
          setTimeout(resolve, 1000);
        });
      } catch (error) {
        console.error('Process cleanup error:', error);
      } finally {
        this.currentProcess = null;
      }
    }

    try {
      const script = `
        Get-Process | Where-Object { 
          $_.Name -match 'SpeechRuntime|Speech_OneCore|SpeechSynthesizer'
        } | ForEach-Object {
          try { 
            $_.Kill()
            $_.WaitForExit(1000)
          } catch {
            Write-Error $_.Exception.Message
          }
        }
      `;
      await execAsync(`${this.powershellPath} -NoProfile -Command "${script}"`);
    } catch (error) {
      console.error('Orphaned process cleanup error:', error);
    }
  }

  async pause(): Promise<boolean> {
    if (this.currentState !== 'playing' || this.isProcessing) return false;
    
    try {
      this.isProcessing = true;
      await this.cleanupProcess();
      this.currentState = 'paused';
      return true;
    } catch (error) {
      console.error('Pause error:', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async resume(): Promise<boolean> {
    if (this.currentState !== 'paused' || this.isProcessing) return false;

    try {
      this.isProcessing = true;
      this.currentState = 'playing';
      await this.speakText();
      return true;
    } catch (error) {
      console.error('Resume error:', error);
      this.currentState = 'paused';
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async stop(): Promise<boolean> {
    if (this.currentState === 'stopped' || this.isProcessing) return true;

    try {
      this.isProcessing = true;
      await this.cleanupProcess();
      this.currentState = 'stopped';
      this.currentText = '';
      return true;
    } catch (error) {
      console.error('Stop error:', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }
} 