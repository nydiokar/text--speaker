import { contextBridge, ipcRenderer } from 'electron';

console.log('Initializing preload script...');

try {
  console.log('Setting up API bridge...');
  
  contextBridge.exposeInMainWorld('api', {
    getVoices: () => {
      console.log('Requesting voices...');
      return ipcRenderer.invoke('get-voices');
    },
    speak: (text: string, voice?: string) => {
      console.log('Requesting speech:', { text: text.substring(0, 100) + '...', voice });
      return ipcRenderer.invoke('speak-text', text, voice);
    },
    controlPlayback: (action: 'play' | 'pause' | 'stop') => {
      console.log('Controlling playback:', action);
      return ipcRenderer.invoke('control-playback', action);
    },
    getSettings: () => {
      console.log('Requesting settings...');
      return ipcRenderer.invoke('get-settings');
    },
    saveSettings: (settings: any) => {
      console.log('Saving settings:', settings);
      return ipcRenderer.invoke('save-settings', settings);
    }
  });

  console.log('API bridge exposed successfully');
} catch (error) {
  console.error('Failed to expose API:', error);
}

// Listen for speech state changes
ipcRenderer.on('speech-state-change', (_, state: 'stopped' | 'playing' | 'paused') => {
  console.log('Speech state changed:', state);
  // Notify any listeners in the renderer
  window.dispatchEvent(new CustomEvent('speech-state-change', { detail: state }));
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script: DOM content loaded');
});
