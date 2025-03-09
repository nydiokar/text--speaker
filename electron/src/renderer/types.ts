export interface Voice {
  name: string;
  culture: string;
}

export interface Settings {
  defaultVoice: string;
  theme: 'light' | 'dark';
  recentFiles: string[];
}

declare global {
  interface Window {
    api: {
      getVoices: () => Promise<Voice[]>;
      speak: (text: string, voice?: string) => Promise<boolean>;
      controlPlayback: (action: 'play' | 'pause' | 'stop') => Promise<boolean>;
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<boolean>;
    };
  }
}
