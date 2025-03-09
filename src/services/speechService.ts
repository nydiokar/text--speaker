import * as fs from 'fs';
import * as path from 'path';
import { exec, execSync, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Voice {
  name: string;
  culture: string;
}

export class SpeechService {
  private powershellPath: string;
  private currentProcess: ChildProcess | null = null;
  private _isPaused: boolean = false;
  private readonly SCRIPT_FILE = 'temp_speech/speech-script.ps1';
  private readonly PID_FILE = 'temp_speech/speech.pid';

  constructor() {
    try {
      this.powershellPath = execSync('where powershell.exe').toString().trim();
      console.log('PowerShell path:', this.powershellPath);
      
      const scriptDir = path.dirname(this.SCRIPT_FILE);
      if (!fs.existsSync(scriptDir)) {
        fs.mkdirSync(scriptDir, { recursive: true });
      }

      // Clean up any existing processes
      this.cleanup();
    } catch (error) {
      console.error('SpeechService initialization error:', error);
      throw error;
    }
  }

  private async killAllSpeechProcesses() {
    try {
      const script = `
        Get-WmiObject Win32_Process | Where-Object { 
          $_.Name -eq 'powershell.exe' -and 
          ($_.CommandLine -match 'speech-script' -or 
           $_.CommandLine -match 'temp_speech')
        } | ForEach-Object { 
          $_.Terminate() 
        }
      `;
      await execAsync(`${this.powershellPath} -NoProfile -NonInteractive -Command "${script}"`);
    } catch (error) {
      console.error('Failed to kill processes:', error);
    }
  }

  private cleanup() {
    this.killAllSpeechProcesses().then(() => {
      try {
        if (fs.existsSync(this.SCRIPT_FILE)) {
          fs.unlinkSync(this.SCRIPT_FILE);
        }
        if (fs.existsSync(this.PID_FILE)) {
          fs.unlinkSync(this.PID_FILE);
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
  }

  public getCurrentProcess(): ChildProcess | null {
    return this.currentProcess;
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  async getVoices(): Promise<Voice[]> {
    try {
      const script = `
        Add-Type -AssemblyName System.Speech;
        $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $voices = @($synthesizer.GetInstalledVoices() | 
          Select-Object -ExpandProperty VoiceInfo | 
          ForEach-Object {
            @{
              name = $_.Name;
              culture = $_.Culture.Name
            }
          });
        $synthesizer.Dispose();
        $jsonVoices = ConvertTo-Json -InputObject $voices -Compress;
        Write-Output $jsonVoices;
      `;

      const { stdout } = await execAsync(`${this.powershellPath} -NoProfile -NonInteractive -Command "${script}"`);
      const cleanOutput = stdout.trim().replace(/[\ufeff\r\n]/g, '');
      
      try {
        if (!cleanOutput) {
          console.warn('No voice data received');
          return [];
        }
        const parsed = JSON.parse(cleanOutput);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        console.error('JSON parse error. Raw output:', cleanOutput);
        return [];
      }
    } catch (error) {
      console.error('Get voices error:', error);
      return [];
    }
  }

  async speak(text: string, voice?: string): Promise<ChildProcess> {
    try {
      // Stop any existing speech
      await this.stop();

      const script = `
        $ErrorActionPreference = 'Stop'
        Add-Type -AssemblyName System.Speech

        function Initialize-Speech {
          $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
          ${voice ? `$synthesizer.SelectVoice('${voice}')` : ''}
          return $synthesizer
        }

        try {
          $synthesizer = Initialize-Speech
          $synthesizer.Speak([string]@'
${text}
'@)
        }
        catch {
          Write-Error $_.Exception.Message
          exit 1
        }
        finally {
          if ($synthesizer) {
            $synthesizer.Dispose()
          }
        }
      `;

      fs.writeFileSync(this.SCRIPT_FILE, script);
      
      const childProcess = exec(
        `${this.powershellPath} -NoProfile -ExecutionPolicy Bypass -File "${this.SCRIPT_FILE}"`,
        (error, stdout, stderr) => {
          if (error && !this._isPaused) {
            console.error('Speech error:', error);
          }
          if (stderr) {
            console.error('Speech stderr:', stderr);
          }
          this.cleanup();
        }
      );

      this.currentProcess = childProcess;
      this._isPaused = false;

      // Save process ID
      fs.writeFileSync(this.PID_FILE, childProcess.pid!.toString());

      return childProcess;
    } catch (error) {
      console.error('Speak error:', error);
      this.cleanup();
      throw error;
    }
  }

  async pause(): Promise<boolean> {
    if (!this.currentProcess || this._isPaused) {
      return false;
    }

    try {
      const script = `
        Add-Type -AssemblyName System.Speech
        $processId = Get-Content '${this.PID_FILE}'
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
          $process.Suspend()
          Write-Output "true"
        }
      `;

      await execAsync(`${this.powershellPath} -NoProfile -NonInteractive -Command "${script}"`);
      this._isPaused = true;
      return true;
    } catch (error) {
      console.error('Pause error:', error);
      return false;
    }
  }

  async resume(): Promise<boolean> {
    if (!this.currentProcess || !this._isPaused) {
      return false;
    }

    try {
      const script = `
        Add-Type -AssemblyName System.Speech
        $processId = Get-Content '${this.PID_FILE}'
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
          $process.Resume()
          Write-Output "true"
        }
      `;

      await execAsync(`${this.powershellPath} -NoProfile -NonInteractive -Command "${script}"`);
      this._isPaused = false;
      return true;
    } catch (error) {
      console.error('Resume error:', error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    try {
      if (this.currentProcess) {
        this.currentProcess.kill();
      }
      await this.killAllSpeechProcesses();
      this.cleanup();
      this.currentProcess = null;
      this._isPaused = false;
      return true;
    } catch (error) {
      console.error('Stop error:', error);
      return false;
    }
  }
}
