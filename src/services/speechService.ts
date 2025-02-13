import { spawn } from 'child_process';
import { TextProcessor, TextSegment } from './textProcessor';
import { ProgressTracker } from './progressTracker';

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
  private defaultVoice: string | null = null;
  private selectedVoice: string | undefined;
  private batchSize = 3;
  private currentBatchPromise: Promise<void> | null = null;
  private isProcessing: boolean = false;
  private forwardRequested: boolean = false;
  private progressTracker: ProgressTracker | null = null;
  private progressInterval: NodeJS.Timeout | null = null;
  private activeProcesses: Set<number> = new Set();

  constructor() {
    this.setupCleanupHandlers();
    this.initializeDefaultVoice().catch(() => {});
  }

  private setupCleanupHandlers() {
    process.on('exit', () => this.emergencyCleanup());
    process.on('SIGINT', () => {
      this.emergencyCleanup();
      process.exit();
    });
    process.on('SIGTERM', () => {
      this.emergencyCleanup();
      process.exit();
    });
  }

  private emergencyCleanup() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    for (const pid of this.activeProcesses) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (e) {}
    }
  }

  private registerProcess(proc: any) {
    if (proc && proc.pid) {
      this.activeProcesses.add(proc.pid);
      proc.on('close', () => {
        this.activeProcesses.delete(proc.pid);
      });
    }
  }

  private async initializeDefaultVoice(): Promise<void> {
    try {
      const voices = await this.getVoices();
      if (voices.length > 0) {
        this.defaultVoice = voices[0].name;
      }
    } catch (error) {}
  }

  public isPaused(): boolean {
    return this._isPaused;
  }

  public async getVoices(): Promise<Voice[]> {
    return new Promise((resolve, reject) => {
      const process = spawn('powershell.exe', [
        '-NoProfile',
        '-NoLogo',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        `Add-Type -AssemblyName System.Speech;
         $s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
         $voices = $s.GetInstalledVoices() | 
           Where-Object { $_.Enabled } | 
           ForEach-Object {
             $info = $_.VoiceInfo;
             @{
               name = $info.Name;
               culture = $info.Culture.Name;
               gender = $info.Gender.ToString();
             }
           };
         $s.Dispose();
         $voices | ConvertTo-Json`
      ]);

      this.registerProcess(process);
      let stdout = '';
      
      process.stdout.on('data', (data) => stdout += data.toString());
      process.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout.trim() || '[]'));
          } catch (error) {
            reject(new Error('Failed to parse voices data'));
          }
        } else {
          reject(new Error('Failed to get voices'));
        }
      });
    });
  }

  private updateProgress() {
    if (this.progressTracker && this.isSpeaking) {
      process.stdout.write(this.progressTracker.renderProgressBar(this.currentSegmentIndex));
    }
  }

  private async speakBatch(): Promise<void> {
    if (this.currentBatchPromise) {
      await this.currentBatchPromise;
    }

    if (!this.isSpeaking || this._isPaused) return;

    if (this.currentSegmentIndex >= this.segments.length) {
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

    const batchContent = batchSegments.map(s => s.content).join('\n');

    return new Promise((resolve) => {
      const process = spawn('powershell.exe', [
        '-NoProfile',
        '-NoLogo',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        `Add-Type -AssemblyName System.Speech | Out-Null;
        $s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        try {
            ${this.selectedVoice ? `$s.SelectVoice('${this.selectedVoice}');` : ''}
            $text = @'
${batchContent}
'@
            $s.Speak($text);
            Write-Output "COMPLETE"
        }
        finally {
            $s.Dispose();
        }`
      ]);

      this.registerProcess(process);
      this.powershellProcess = process;

      process.stdout.on('data', async (data) => {
        if (data.toString().includes('COMPLETE') && this.isSpeaking) {
          this.currentSegmentIndex += batchSegments.length;
          this.updateProgress();
          resolve();
          
          if (this.currentSegmentIndex < this.segments.length && this.isSpeaking && !this._isPaused) {
            await this.speakBatch();
          }
        }
      });

      process.on('error', () => resolve());
      process.on('close', () => {
        this.powershellProcess = null;
        resolve();
      });
    });
  }

  public async speak(text: string, voiceName?: string, startFromSegment: number = 0): Promise<void> {
    if (this.isSpeaking) await this.stop();

    this.selectedVoice = voiceName;
    this.segments = TextProcessor.processText(text);
    this.currentSegmentIndex = startFromSegment;
    this._isPaused = false;
    this.isSpeaking = true;
    this.progressTracker = new ProgressTracker(this.segments);
    
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.progressInterval = setInterval(() => {
      if (this.isSpeaking && !this._isPaused) this.updateProgress();
    }, 1000);

    try {
      await this.speakBatch();
    } finally {
      this.isSpeaking = false;
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }
      process.stdout.write('\n');
    }
  }

  public async pause(): Promise<void> {
    this._isPaused = true;
    if (this.progressTracker) this.progressTracker.pause();
    await this.stopCurrentProcess();
  }

  public async resume(): Promise<void> {
    if (!this._isPaused) return;
    
    this._isPaused = false;
    this.isSpeaking = true;
    if (this.progressTracker) this.progressTracker.resume();
    await this.speakBatch();
  }

  public async forward(segments: number = 1): Promise<void> {
    if (this.isProcessing) {
      this.forwardRequested = true;
      this.currentSegmentIndex = Math.min(
        this.segments.length - 1, 
        this.currentSegmentIndex + segments
      );
      this.updateProgress();
      await this.stopCurrentProcess();
      return;
    }

    try {
      this.isProcessing = true;
      this.forwardRequested = false;
      
      await this.stopCurrentProcess();
      if (this.currentBatchPromise) await this.currentBatchPromise;
      
      this.currentSegmentIndex = Math.min(
        this.segments.length - 1, 
        this.currentSegmentIndex + segments
      );
      
      this.updateProgress();
      if (!this._isPaused) {
        this.isSpeaking = true;
        await this.speakBatch();
      }
    } finally {
      this.isProcessing = false;
      if (this.forwardRequested) await this.forward(1);
    }
  }

  public async rewind(segments: number = 1): Promise<void> {
    await this.stopCurrentProcess();
    this.currentSegmentIndex = Math.max(0, this.currentSegmentIndex - segments);
    this.updateProgress();
    if (!this._isPaused && this.isSpeaking) {
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.speakBatch();
    }
  }

  public async stop(): Promise<void> {
    this.isSpeaking = false;
    this._isPaused = false;
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    await this.stopCurrentProcess();
    process.stdout.write('\n');
  }

  private async stopCurrentProcess(): Promise<void> {
    if (this.powershellProcess) {
      return new Promise<void>((resolve) => {
        const cleanup = () => {
          if (this.powershellProcess) {
            try {
              this.powershellProcess.kill('SIGTERM');
            } catch (e) {}
            this.powershellProcess = null;
          }
          resolve();
        };

        const timeout = setTimeout(cleanup, 200);
        this.powershellProcess.on('close', () => {
          clearTimeout(timeout);
          this.powershellProcess = null;
          resolve();
        });
        
        try {
          this.powershellProcess.kill();
        } catch (e) {
          cleanup();
        }
      });
    }
  }

  public async replay(): Promise<void> {
    try {
      await this.stopCurrentProcess();
      if (!this.segments || !this.segments[this.currentSegmentIndex]) return;
      this.isSpeaking = true;
      this._isPaused = false;
      await this.speakBatch();
    } catch (error) {
      this.isSpeaking = false;
    }
  }
}
