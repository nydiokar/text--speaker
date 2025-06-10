import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SpeechBridge } from './speechBridge';
import { PlaybackAction } from '../renderer/types';

let mainWindow: BrowserWindow | null = null;
let speechBridge: SpeechBridge | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../../index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('Index.html loaded successfully');
};

const initializeServices = () => {
  speechBridge = new SpeechBridge();

  // Forward state changes to renderer
  speechBridge.on('stateChanged', (event) => {
    mainWindow?.webContents.send('speech:stateChanged', event);
  });

  // Forward errors to renderer
  speechBridge.on('error', (error) => {
    mainWindow?.webContents.send('speech:error', error);
  });

  // Handle IPC calls
  ipcMain.handle('speech:getVoices', () => {
    return speechBridge?.getVoices();
  });

  ipcMain.handle('speech:speak', async (_, text: string, voice?: string) => {
    return speechBridge?.speak(text, voice);
  });

  ipcMain.handle('speech:control', async (_, action: PlaybackAction, sentences?: number) => {
    if (!speechBridge) return false;
    
    switch (action) {
      case 'play':
        if (speechBridge.isPaused) {
          return speechBridge.resume();
        }
        break;
      case 'pause':
        return speechBridge.pause();
      case 'stop':
        return speechBridge.stop();
      case 'rewind':
        return speechBridge.rewind(sentences);
      case 'forward':
        return speechBridge.forward(sentences);
      case 'replay':
        await speechBridge.stop();
        if (speechBridge.isPaused) {
          return speechBridge.resume();
        }
        return false;
    }
  });

  // Settings management
  ipcMain.handle('settings:get', async () => {
    // TODO: Implement settings storage
    return {
      defaultVoice: '',
      theme: 'light',
      recentFiles: []
    };
  });

  ipcMain.handle('settings:save', async (_, settings) => {
    // TODO: Implement settings storage
  });
};

app.whenReady().then(() => {
  createWindow();
  initializeServices();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });

  console.log('App is ready');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', async () => {
  if (speechBridge) {
    await speechBridge.cleanup();
    speechBridge = null;
  }
});
