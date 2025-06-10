import { contextBridge, ipcRenderer } from 'electron';
import { Voice, Settings, PlaybackAction, StateChangeEvent } from '../renderer/types';

declare global {
  interface Window {
    api: {
      getVoices: () => Promise<Voice[]>;
      speak: (text: string, voice?: string) => Promise<void>;
      controlPlayback: (action: PlaybackAction, sentences?: number) => Promise<void>;
      onStateChange: (callback: (event: StateChangeEvent) => void) => () => void;
      onError: (callback: (error: Error) => void) => () => void;
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<void>;
    };
  }
}

// IPC wrapper
contextBridge.exposeInMainWorld('api', {
  getVoices: () => ipcRenderer.invoke('speech:getVoices'),
  
  speak: (text: string, voice?: string) => 
    ipcRenderer.invoke('speech:speak', text, voice),
  
  controlPlayback: (action: PlaybackAction, sentences?: number) => 
    ipcRenderer.invoke('speech:control', action, sentences),
  
  onStateChange: (callback: (event: StateChangeEvent) => void) => {
    const subscription = (_: any, event: StateChangeEvent) => callback(event);
    ipcRenderer.on('speech:stateChanged', subscription);
    return () => {
      ipcRenderer.removeListener('speech:stateChanged', subscription);
    };
  },

  onError: (callback: (error: Error) => void) => {
    const subscription = (_: any, error: Error) => callback(error);
    ipcRenderer.on('speech:error', subscription);
    return () => {
      ipcRenderer.removeListener('speech:error', subscription);
    };
  },

  getSettings: () => ipcRenderer.invoke('settings:get'),
  
  saveSettings: (settings: Settings) => 
    ipcRenderer.invoke('settings:save', settings)
});
