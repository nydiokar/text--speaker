import { exec } from 'child_process';
import { promisify } from 'util';
import { TextProcessor, TextSegment } from './textProcessor';

const execAsync = promisify(exec);

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

  public isPaused(): boolean {
    return this._isPaused;
  }

  public async getVoices(): Promise<Voice[]> {
    try {
      const command = [
        'Add-Type -AssemblyName System.Speech;',
        '$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
        '$voices = $synthesizer.GetInstalledVoices() | ForEach-Object {',
        '  $info = $_.VoiceInfo;',
        '  @{',
        '    name = $info.Name;',
        '    culture = $info.Culture;',
        '    gender = $info.Gender;',
        '  }',
        '};',
        '$synthesizer.Dispose();',
        '$voices | ConvertTo-Json'
      ].join(' ');

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${command}"`);
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(`Failed to get voices: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async speak(text: string, voiceName?: string, startFromSegment: number = 0): Promise<void> {
    this.segments = TextProcessor.processText(text);
    this.currentSegmentIndex = startFromSegment;
    this._isPaused = false;

    await this.speakCurrentSegment(voiceName);
  }

  private async speakCurrentSegment(voiceName?: string): Promise<void> {
    if (this._isPaused || this.currentSegmentIndex >= this.segments.length) {
      return;
    }

    this.currentSynthesizer = `speech_${Date.now()}`;
    try {
      // Using Windows PowerShell's built-in speech synthesis
      const fs = require('fs');
      const tempFile = 'temp_speech.txt';
      await fs.promises.writeFile(tempFile, this.segments[this.currentSegmentIndex].content, 'utf8');

      const voiceSetup = voiceName ? `$global:synthesizer.SelectVoice("${voiceName}");` : '';
      
      const command = [
        'Add-Type -AssemblyName System.Speech;',
        '$global:synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
        voiceSetup,
        `$text = Get-Content -Path "${tempFile}" -Raw;`,
        '$global:synthesizer.Speak($text);',
        '$global:synthesizer.Dispose();',
        `Remove-Item -Path "${tempFile}";`,
        'Remove-Variable -Scope Global -Name synthesizer -ErrorAction SilentlyContinue;',
        'echo "SENTENCE_COMPLETE"'
      ].join(' ');

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${command}"`);
      if (stdout.includes("SENTENCE_COMPLETE")) {
        const currentSegment = this.segments[this.currentSegmentIndex];
        const pauseDuration = currentSegment.pauseAfter || 500;
        
        // Wait for the specified pause duration
        await new Promise(resolve => setTimeout(resolve, pauseDuration));
        
        this.currentSegmentIndex++;
        if (this.currentSegmentIndex < this.segments.length && !this._isPaused) {
          await this.speakCurrentSegment(voiceName);
        }
      }
    } catch (error) {
      throw new Error(`Speech synthesis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async pause(): Promise<void> {
    this._isPaused = true;
    await this.stop();
  }

  public async resume(voiceName?: string): Promise<void> {
    if (!this._isPaused) return;
    
    this._isPaused = false;
    await this.speakCurrentSegment(voiceName);
  }

  public async rewind(segments: number = 1, voiceName?: string): Promise<void> {
    await this.stop();
    this.currentSegmentIndex = Math.max(0, this.currentSegmentIndex - segments);
    if (!this._isPaused) {
      await this.speakCurrentSegment(voiceName);
    }
  }

  public async forward(segments: number = 1, voiceName?: string): Promise<void> {
    await this.stop();
    this.currentSegmentIndex = Math.min(this.segments.length - 1, this.currentSegmentIndex + segments);
    if (!this._isPaused) {
      await this.speakCurrentSegment(voiceName);
    }
  }

  public async replay(voiceName?: string): Promise<void> {
    await this.stop();
    await this.speakCurrentSegment(voiceName);
  }

  public async stop(): Promise<void> {
    this._isPaused = false;
    try {
      // Kill any running speech processes
      // Simplified stop command to avoid escaping issues
      await execAsync('taskkill /F /IM "SpeechRuntime.exe" /T 2>nul');
      await execAsync('taskkill /F /IM "powershell.exe" /T 2>nul');
      this.currentSynthesizer = null;

      // Additional cleanup using taskkill
      try {
        await execAsync('taskkill /F /IM "SpeechRuntime.exe" /T 2>nul');
      } catch {
        // Ignore errors if process doesn't exist
      }
    } catch (error) {
      throw new Error(`Failed to stop speech synthesis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
