import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { SpeechBridge } from './speechBridge';

const isDev = process.env.NODE_ENV === 'development';
const store = new Store();
let speechBridge: SpeechBridge | null = null;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../../index.html'))
    .then(() => {
      console.log('Index.html loaded successfully');
      if (isDev) {
        mainWindow?.webContents.openDevTools();
      }
    })
    .catch(error => {
      console.error('Failed to load index.html:', error);
      if (mainWindow) {
        dialog.showErrorBox('Loading Error', `Failed to load application: ${error.message}`);
      }
    });
}

// Initialize application
app.whenReady().then(() => {
  console.log('App is ready');

  try {
    speechBridge = new SpeechBridge();
  } catch (error) {
    console.error('Failed to initialize speech bridge:', error);
    dialog.showErrorBox('Initialization Error', 'Failed to initialize speech service');
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(error => {
  console.error('Failed to initialize app:', error);
  dialog.showErrorBox('Fatal Error', `Application failed to start: ${error.message}`);
  app.quit();
});

// Cleanup on window close
app.on('window-all-closed', async () => {
  if (speechBridge) {
    try {
      await speechBridge.cleanup();
      speechBridge = null;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-voices', async () => {
  if (!speechBridge) return [];
  try {
    return await speechBridge.getVoices();
  } catch (error) {
    console.error('Failed to get voices:', error);
    return [];
  }
});

const notifyStateChange = (state: 'stopped' | 'playing' | 'paused') => {
  if (mainWindow) {
    mainWindow.webContents.send('speech-state-change', state);
  }
};

ipcMain.handle('speak-text', async (_, text: string, voice?: string) => {
  if (!speechBridge) return false;
  try {
    const success = await speechBridge.speak(text, voice);
    if (success) {
      notifyStateChange('playing');
      
      const currentProcess = speechBridge.getCurrentProcess();
      if (currentProcess) {
        currentProcess.on('exit', (code) => {
          if (code === 0 || code === null) {
            notifyStateChange('stopped');
          }
        });
      }
    }
    return success;
  } catch (error) {
    console.error('Failed to speak:', error);
    notifyStateChange('stopped');
    return false;
  }
});

ipcMain.handle('control-playback', async (_, action: 'play' | 'pause' | 'stop') => {
  if (!speechBridge) return false;
  try {
    let success = false;
    switch (action) {
      case 'play':
        success = await speechBridge.resume();
        if (success) notifyStateChange('playing');
        break;
      case 'pause':
        success = await speechBridge.pause();
        if (success) notifyStateChange('paused');
        break;
      case 'stop':
        success = await speechBridge.stop();
        if (success) notifyStateChange('stopped');
        break;
      default:
        console.warn('Unknown playback action:', action);
        return false;
    }
    return success;
  } catch (error) {
    console.error(`Failed to ${action}:`, error);
    notifyStateChange('stopped');
    return false;
  }
});

ipcMain.handle('get-settings', () => {
  return store.get('settings', {
    defaultVoice: '',
    theme: 'light',
    recentFiles: []
  });
});

ipcMain.handle('save-settings', (_, settings: any) => {
  try {
    store.set('settings', settings);
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
});
