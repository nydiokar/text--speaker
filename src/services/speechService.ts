import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TextProcessor, TextSegment } from './textProcessor';

export interface Voice {
  name: string;
  culture: string;
  gender: string;
}

export class SpeechService {
  private segments: TextSegment[] = [];
  private currentSegmentIndex: number = 0;
  private _isPaused: boolean = false;
  private isSpeaking: boolean = false;
  private powershellProcess: any = null;
  private tempDir: string;
  private defaultVoice: string | null = null;
  private rate: number = 1;
  private volume: number = 100;
  private selectedVoice: string | undefined;
  private batchSize = 3; // Number of segments to process at once
  private currentBatchPromise: Promise<void> | null = null;
  private isProcessing: boolean = false;
  private forwardRequested: boolean = false;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp_speech');
    // Create temp directory on startup
    this.initTempDir().catch(() => {});
    // Try to initialize default voice
    this.initializeDefaultVoice().catch(() => {});
  }

  private async initTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  private async initializeDefaultVoice(): Promise<void> {
    try {
      const voices = await this.getVoices();
      if (voices.length > 0) {
        this.defaultVoice = voices[0].name;
      }
    } catch (error) {
      console.error('Failed to initialize default voice:', error);
    }
  }

  public isPaused(): boolean {
    return this._isPaused;
  }

  private async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files.map(file => 
          fs.unlink(path.join(this.tempDir, file)).catch(() => {})
        )
      );
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  public async getVoices(): Promise<Voice[]> {
    try {
      const process = spawn('powershell', [
        '-NoProfile',
        '-Command',
        `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Speech');
         $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer;
         $voices = $synthesizer.GetInstalledVoices() | 
           Where-Object { $_.Enabled } | 
           ForEach-Object {
             $info = $_.VoiceInfo;
             @{
               name = $info.Name;
               culture = $info.Culture.Name;
               gender = $info.Gender.ToString();
             }
           };
         $synthesizer.Dispose();
         $voices | ConvertTo-Json -Compress`
      ]);

      let stdout = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      return new Promise((resolve, reject) => {
        process.on('close', (code) => {
          if (code === 0) {
            try {
              const voices = JSON.parse(stdout.trim() || '[]');
              console.log('Found voices:', voices); // Debug log
              if (voices.length === 0) {
                console.warn('No voices found');
              }
              resolve(voices);
            } catch (error) {
              console.error('Failed to parse voices:', stdout);
              reject(new Error('Failed to parse voices data'));
            }
          } else {
            reject(new Error('Failed to get voices'));
          }
        });
      });
    } catch (error) {
      console.error('Failed to get voices:', error);
      throw error;
    }
  }

  private async validateVoice(voiceName?: string): Promise<string> {
    if (!voiceName && !this.defaultVoice) {
      const voices = await this.getVoices();
      if (voices.length === 0) {
        throw new Error('No voices available for speech synthesis');
      }
      this.defaultVoice = voices[0].name;
      return this.defaultVoice;
    }

    if (voiceName) {
      const voices = await this.getVoices();
      const voice = voices.find(v => v.name === voiceName);
      if (!voice) {
        throw new Error(
          `Voice "${voiceName}" not found. Available voices:\n${
            voices.map(v => `- ${v.name} (${v.culture})`).join('\n')
          }`
        );
      }
      return voiceName;
    }

    return this.defaultVoice!;
  }

  private async speakBatch(): Promise<void> {
    if (this.currentBatchPromise) {
      await this.currentBatchPromise;
    }

    if (!this.isSpeaking || this._isPaused) return;

    const remainingSegments = this.segments.length - this.currentSegmentIndex;
    if (remainingSegments <= 0) {
      console.log('Reached end of content');
      this.isSpeaking = false;
      return;
    }

    try {
      this.currentBatchPromise = this.processBatch();
      await this.currentBatchPromise;
    } finally {
      this.currentBatchPromise = null;
    }
  }

  private async processBatch(): Promise<void> {
    const batchSegments = this.segments.slice(
      this.currentSegmentIndex,
      this.currentSegmentIndex + Math.min(this.batchSize, this.segments.length - this.currentSegmentIndex)
    );

    if (batchSegments.length === 0) return;

    const tempFile = path.join(this.tempDir, 'current_batch.txt');
    const batchContent = batchSegments.map(s => s.content).join('\n');
    
    try {
      await fs.writeFile(tempFile, batchContent, 'utf8');

      return new Promise((resolve, reject) => {
        const process = spawn('powershell', [
          '-NoProfile',
          '-NoLogo',
          '-NonInteractive',
          '-Command',
          `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Speech'); 
           $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; 
           ${this.selectedVoice ? `$s.SelectVoice('${this.selectedVoice}');` : ''} 
           $s.Rate = [Math]::Max(-10, [Math]::Min(10, [int]((${ this.rate } - 1) * 10)));
           $s.Volume = ${ this.volume };
           $s.Speak([IO.File]::ReadAllText('${tempFile}')); 
           $s.Dispose(); 
           Write-Output 'BATCH_COMPLETE'`
        ]);

        this.powershellProcess = process;

        process.stdout.on('data', async (data) => {
          const output = data.toString().trim();
          if (output === 'BATCH_COMPLETE' && this.isSpeaking) {
            this.currentSegmentIndex += batchSegments.length;
            resolve();
            
            if (this.currentSegmentIndex < this.segments.length && this.isSpeaking && !this._isPaused) {
              await this.speakBatch();
            }
          }
        });

        process.stderr.on('data', (data) => {
          console.error('Speech error:', data.toString());
        });

        process.on('error', (error) => {
          console.error('Process error:', error);
          resolve();
        });

        process.on('close', (code) => {
          this.powershellProcess = null;
          resolve();
        });
      });
    } catch (error) {
      console.error('Batch processing error:', error);
      throw error;
    }
  }

  public async speak(text: string, voiceName?: string, startFromSegment: number = 0): Promise<void> {
    console.log('Starting speech synthesis...');
    if (this.isSpeaking) {
      console.log('Stopping previous speech...');
      await this.stop();
    }

    this.selectedVoice = voiceName;
    this.segments = TextProcessor.processText(text);
    console.log(`Processed text into ${this.segments.length} segments`);
    this.currentSegmentIndex = startFromSegment;
    this._isPaused = false;
    this.isSpeaking = true;

    try {
      await this.speakBatch(); // Use batch processing instead of single segments
    } finally {
      this.isSpeaking = false;
      console.log('Speech synthesis completed');
    }
  }

  public async pause(): Promise<void> {
    this._isPaused = true;
    await this.stopCurrentProcess();
  }

  public async resume(): Promise<void> {
    if (!this._isPaused) return;
    
    console.log('Resuming speech...');
    this._isPaused = false;
    this.isSpeaking = true;
    await this.speakBatch();
  }

  public async rewind(segments: number = 1): Promise<void> {
    console.log(`Rewinding ${segments} segments...`);
    await this.stopCurrentProcess();
    this.currentSegmentIndex = Math.max(0, this.currentSegmentIndex - segments);
    if (!this._isPaused && this.isSpeaking) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for cleanup
      await this.speakBatch();
    }
  }

  public async forward(segments: number = 1): Promise<void> {
    if (this.isProcessing) {
      this.forwardRequested = true;
      this.currentSegmentIndex = Math.min(
        this.segments.length - 1, 
        this.currentSegmentIndex + segments
      );
      await this.stopCurrentProcess();
      return;
    }

    try {
      this.isProcessing = true;
      this.forwardRequested = false;
      console.log(`Forwarding ${segments} segments...`);
      
      await this.stopCurrentProcess();
      if (this.currentBatchPromise) {
        await this.currentBatchPromise;
      }
      
      const newIndex = Math.min(
        this.segments.length - 1, 
        this.currentSegmentIndex + segments
      );
      
      console.log(`Moving from segment ${this.currentSegmentIndex} to ${newIndex}`);
      this.currentSegmentIndex = newIndex;

      if (!this._isPaused) {
        this.isSpeaking = true;
        const currentContent = this.segments[this.currentSegmentIndex].content;
        console.log(`Continuing with: "${currentContent.substring(0, 50)}..."`);
        await this.speakBatch();
      }
    } catch (error) {
      console.error('Forward operation failed:', error);
      this.isSpeaking = false;
    } finally {
      this.isProcessing = false;
      if (this.forwardRequested) {
        this.forward(1).catch(console.error);
      }
    }
  }

  public async stop(): Promise<void> {
    this.isSpeaking = false;
    this._isPaused = false;
    await this.stopCurrentProcess();
    await this.cleanup();
  }

  private async stopCurrentProcess(): Promise<void> {
    if (this.powershellProcess) {
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.powershellProcess) {
            this.powershellProcess.kill('SIGKILL');
            this.powershellProcess = null;
          }
          resolve();
        }, 200);

        this.powershellProcess.on('close', () => {
          clearTimeout(timeout);
          this.powershellProcess = null;
          resolve();
        });
        
        this.powershellProcess.kill();
      });
    }
  }

  public async replay(): Promise<void> {
    try {
      // If currently playing, stop first
      await this.stopCurrentProcess();
      
      // Verify we have valid segments and index
      if (!this.segments || !this.segments[this.currentSegmentIndex]) {
        console.error('No valid segment to replay');
        return;
      }

      console.log(`Replaying segment ${this.currentSegmentIndex}`);
      this.isSpeaking = true;
      this._isPaused = false;
      await this.speakBatch();
    } catch (error) {
      console.error('Replay failed:', error);
      this.isSpeaking = false;
    }
  }
}