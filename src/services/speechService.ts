import { exec } from 'child_process';
import { promisify } from 'util';
import { TextProcessor, TextSegment } from './textProcessor';

const execAsync = async (command: string) => {
  console.log('Executing PowerShell command...');
  const result = await promisify(exec)(command);
  console.log('Command completed:', result.stdout);
  if (result.stderr) {
    console.error('Command errors:', result.stderr);
  }
  return result;
};

export interface Voice {
  name: string;
  culture: string;
  gender: string;
}

export class SpeechService {
  private currentSynthesizer: string | null = null;
  private segments: TextSegment[] = [];
  private currentSegmentIndex: number = 0;
  private _isPaused: boolean = false;
  private isSpeaking: boolean = false;

  public isPaused(): boolean {
    return this._isPaused;
  }

  public async getVoices(): Promise<Voice[]> {
    try {
      console.log('Getting available voices...');
      const cmd = 'powershell -Command "Add-Type -AssemblyName System.Speech; $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voices = $synthesizer.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo } | Select-Object Name, Culture, Gender; $synthesizer.Dispose(); $voices | ConvertTo-Json"';
      const { stdout } = await execAsync(cmd);
      
      if (!stdout) {
        throw new Error('No voice data returned');
      }
      const voices = JSON.parse(stdout);
      console.log('Found voices:', voices.length);
      return voices;
    } catch (error) {
      console.error('Failed to get voices:', error);
      throw new Error(`Failed to get voices: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async speak(text: string, voiceName?: string, startFromSegment: number = 0): Promise<void> {
    console.log('Starting speech synthesis...');
    if (this.isSpeaking) {
      console.log('Stopping previous speech...');
      await this.stop();
    }

    this.segments = TextProcessor.processText(text);
    console.log(`Processed text into ${this.segments.length} segments`);
    this.currentSegmentIndex = startFromSegment;
    this._isPaused = false;
    this.isSpeaking = true;

    try {
      await this.speakCurrentSegment(voiceName);
    } finally {
      this.isSpeaking = false;
      console.log('Speech synthesis completed');
    }
  }

  private async speakCurrentSegment(voiceName?: string): Promise<void> {
    if (this._isPaused || this.currentSegmentIndex >= this.segments.length || !this.isSpeaking) {
      return;
    }

    this.currentSynthesizer = `speech_${Date.now()}`;
    console.log(`Speaking segment ${this.currentSegmentIndex + 1}/${this.segments.length}`);

    try {
      const fs = require('fs');
      const tempFile = `temp_speech_${Date.now()}.txt`;
      await fs.promises.writeFile(tempFile, this.segments[this.currentSegmentIndex].content, 'utf8');

      const command = `powershell -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Speech'); $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ${voiceName ? `$s.SelectVoice('${voiceName}');` : ''} $s.Speak([IO.File]::ReadAllText('${tempFile}')); $s.Dispose(); Write-Output 'SENTENCE_COMPLETE'"`;
      
      const { stdout } = await execAsync(command);

      try {
        if (fs.existsSync(tempFile)) {
          await fs.promises.unlink(tempFile);
        }
      } catch {
        console.log('Temp file already removed');
      }

      if (stdout.includes("SENTENCE_COMPLETE") && this.isSpeaking) {
        const currentSegment = this.segments[this.currentSegmentIndex];
        const pauseDuration = currentSegment.pauseAfter || 500;
        
        console.log(`Pausing for ${pauseDuration}ms`);
        await new Promise(resolve => setTimeout(resolve, pauseDuration));
        
        if (this.isSpeaking && !this._isPaused) {
          this.currentSegmentIndex++;
          if (this.currentSegmentIndex < this.segments.length) {
            await this.speakCurrentSegment(voiceName);
          }
        }
      }
    } catch (error) {
      console.error('Speech synthesis error:', error);
      if (this.isSpeaking) {
        throw new Error(`Speech synthesis failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  public async pause(): Promise<void> {
    console.log('Pausing speech...');
    this._isPaused = true;
    await this.stopCurrentSegment();
  }

  public async resume(voiceName?: string): Promise<void> {
    if (!this._isPaused) return;
    
    console.log('Resuming speech...');
    this._isPaused = false;
    this.isSpeaking = true;
    await this.speakCurrentSegment(voiceName);
  }

  public async rewind(segments: number = 1, voiceName?: string): Promise<void> {
    console.log(`Rewinding ${segments} segments...`);
    await this.stopCurrentSegment();
    this.currentSegmentIndex = Math.max(0, this.currentSegmentIndex - segments);
    if (!this._isPaused) {
      this.isSpeaking = true;
      await this.speakCurrentSegment(voiceName);
    }
  }

  public async forward(segments: number = 1, voiceName?: string): Promise<void> {
    console.log(`Forwarding ${segments} segments...`);
    await this.stopCurrentSegment();
    this.currentSegmentIndex = Math.min(this.segments.length - 1, this.currentSegmentIndex + segments);
    if (!this._isPaused) {
      this.isSpeaking = true;
      await this.speakCurrentSegment(voiceName);
    }
  }

  public async replay(voiceName?: string): Promise<void> {
    console.log('Replaying current segment...');
    await this.stopCurrentSegment();
    this.isSpeaking = true;
    await this.speakCurrentSegment(voiceName);
  }

  private async stopCurrentSegment(): Promise<void> {
    console.log('Stopping current segment...');
    try {
      // Try to kill any running speech processes
      await execAsync('powershell -Command "Get-Process | Where-Object {$_.Name -like \'*Speech*\'} | Stop-Process -Force"');
    } catch (error) {
      // Ignore errors if no process is found
      console.log('No active speech processes found to stop');
    }
  }

  public async stop(): Promise<void> {
    console.log('Stopping speech service...');
    this._isPaused = false;
    this.isSpeaking = false;
    await this.stopCurrentSegment();
    this.currentSynthesizer = null;
  }
}
