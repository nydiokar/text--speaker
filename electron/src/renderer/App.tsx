/** @jsxImportSource @emotion/react */
import React, { useEffect, useState, useCallback } from 'react';
import { css, ThemeProvider } from '@emotion/react';
import { Settings, Voice } from './types';
import { themeStyles } from './theme';
import { Global } from '@emotion/react';
import { globalStyles } from './styles/global';

const mainStyles = (theme: 'light' | 'dark') => css`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${themeStyles[theme].background};
  color: ${themeStyles[theme].text};
  transition: all 0.2s ease;
`;

const headerStyles = (theme: 'light' | 'dark') => css`
  padding: 1rem;
  border-bottom: 1px solid ${themeStyles[theme].border};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const contentStyles = css`
  flex: 1;
  padding: 1rem;
  display: flex;
  gap: 1rem;
  overflow: auto;
`;

const controlsStyles = (theme: 'light' | 'dark') => css`
  padding: 1rem;
  border-top: 1px solid ${themeStyles[theme].border};
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
`;

const dropZoneStyles = (theme: 'light' | 'dark') => css`
  flex: 1;
  border: 2px dashed ${themeStyles[theme].border};
  border-radius: 4px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${themeStyles[theme].background};

  &:hover {
    border-color: ${themeStyles[theme].borderHover};
  }
`;

const buttonStyles = (theme: 'light' | 'dark') => css`
  background: ${themeStyles[theme].background};
  color: ${themeStyles[theme].text};
  border: 1px solid ${themeStyles[theme].border};
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;

  &:hover:not(:disabled) {
    border-color: ${themeStyles[theme].borderHover};
    background: ${themeStyles[theme].borderHover}20;
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const selectStyles = (theme: 'light' | 'dark') => css`
  background: ${themeStyles[theme].background};
  color: ${themeStyles[theme].text};
  border: 1px solid ${themeStyles[theme].border};
  padding: 0.5rem;
  border-radius: 4px;
  min-width: 200px;

  &:hover:not(:disabled) {
    border-color: ${themeStyles[theme].borderHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const App: React.FC = () => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [settings, setSettings] = useState<Settings>({
    defaultVoice: '',
    theme: 'light',
    recentFiles: []
  });
  const [status, setStatus] = useState<'stopped' | 'playing' | 'paused'>('stopped');

  useEffect(() => {
    const init = async () => {
      try {
        const [loadedVoices, loadedSettings] = await Promise.all([
          window.api.getVoices(),
          window.api.getSettings()
        ]);
        setVoices(loadedVoices);
        setSettings(loadedSettings);
        setSelectedVoice(loadedSettings.defaultVoice || (loadedVoices[0]?.name || ''));
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    init();

    // Set up state change listener
    const unsubscribe = window.api.onStateChange((event) => {
      console.log('Speech state changed:', event);
      setStatus(event.state);
      if (event.error) {
        console.error('Speech error:', event.error);
      }
    });

    // Set up error listener
    const unsubscribeError = window.api.onError((error) => {
      console.error('Speech error:', error);
      setStatus('stopped');
    });

    return () => {
      unsubscribe();
      unsubscribeError();
    };
  }, []);

  const handlePlay = useCallback(async () => {
    if (!text) return;
    
    try {
      if (status === 'stopped') {
        // Only stop and restart if we're in stopped state
        await window.api.controlPlayback('stop');
        await window.api.speak(text, selectedVoice);
      } else {
        // Otherwise just control playback
        await window.api.controlPlayback('play');
      }
    } catch (error) {
      console.error('Play error:', error);
      setStatus('stopped');
    }
  }, [text, selectedVoice, status]);

  const handleControl = useCallback(async (action: 'play' | 'pause' | 'stop' | 'rewind' | 'forward' | 'replay', sentences?: number) => {
    if (action === 'play' && status === 'stopped') {
      await handlePlay();
      return;
    }
    
    try {
      await window.api.controlPlayback(action, sentences);
    } catch (error) {
      console.error('Control error:', error);
      setStatus('stopped');
    }
  }, [status, handlePlay]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (status !== 'stopped') {
          await handleControl('stop');
        }
        setText(event.target?.result as string || '');
      };
      reader.readAsText(file);
    }
  };

  const handleVoiceChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (status !== 'stopped') {
      await handleControl('stop');
    }
    const voice = event.target.value;
    setSelectedVoice(voice);
    
    const newSettings: Settings = {
      ...settings,
      defaultVoice: voice
    };
    await window.api.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const toggleTheme = async () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    const newSettings: Settings = {
      ...settings,
      theme: newTheme
    };
    setSettings(newSettings);
    await window.api.saveSettings(newSettings);
  };

  return (
    <ThemeProvider theme={{ theme: settings.theme }}>
      <Global styles={globalStyles} />
      <div css={mainStyles(settings.theme)}>
        <header css={headerStyles(settings.theme)}>
          <select 
            value={selectedVoice} 
            onChange={handleVoiceChange}
            css={selectStyles(settings.theme)}
            disabled={status !== 'stopped'}
          >
            {voices.map(voice => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.culture})
              </option>
            ))}
          </select>
          <button 
            onClick={toggleTheme}
            css={buttonStyles(settings.theme)}
          >
            Toggle Theme
          </button>
        </header>

        <main css={contentStyles}>
          <div
            css={dropZoneStyles(settings.theme)}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            {text ? (
              <pre style={{ whiteSpace: 'pre-wrap', width: '100%' }}>{text}</pre>
            ) : (
              <p>Drop a text file here or click to select</p>
            )}
          </div>
        </main>

        <div css={controlsStyles(settings.theme)}>
          {/* Navigation controls */}
          {status !== 'stopped' && (
            <>
              <button 
                onClick={() => handleControl('rewind', 1)}
                css={buttonStyles(settings.theme)}
                title="Rewind"
              >
                ⏪
              </button>
              <button 
                onClick={() => handleControl('replay')}
                css={buttonStyles(settings.theme)}
                title="Replay"
              >
                🔄
              </button>
              <button 
                onClick={() => handleControl('forward', 1)}
                css={buttonStyles(settings.theme)}
                title="Forward"
              >
                ⏩
              </button>
            </>
          )}

          {/* Playback controls */}
          <button 
            onClick={handlePlay}
            css={buttonStyles(settings.theme)}
            disabled={!text.trim()}
          >
            {status === 'stopped' ? 'Play' : 'Restart'}
          </button>
          
          {status === 'playing' && (
            <button 
              onClick={() => handleControl('pause')}
              css={buttonStyles(settings.theme)}
            >
              Pause
            </button>
          )}
          {status === 'paused' && (
            <button 
              onClick={() => handleControl('play')}
              css={buttonStyles(settings.theme)}
            >
              Resume
            </button>
          )}
          {status !== 'stopped' && (
            <button 
              onClick={() => handleControl('stop')}
              css={buttonStyles(settings.theme)}
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
};
