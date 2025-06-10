export interface Settings {
  theme: 'light' | 'dark';
  recentFiles: string[];
}

export type PlaybackAction = 'play' | 'pause' | 'stop' | 'rewind' | 'forward' | 'replay';
export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface StateChangeEvent {
  state: PlaybackState;
  data: {
    sentenceIndex: number;
  };
  error?: Error;
}
