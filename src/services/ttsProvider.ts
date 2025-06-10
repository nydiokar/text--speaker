export interface TTSProvider {
  speak(text: string): Promise<void>;
  pause(): Promise<boolean>;
  resume(): Promise<boolean>;
  stop(): Promise<boolean>;
  forward(): Promise<boolean>;
  rewind(): Promise<boolean>;
  getCurrentProcess(): any;
  isPaused: boolean;
} 