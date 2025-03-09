/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
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

    // Listen for speech state changes
    const handleStateChange = (event: CustomEvent<'stopped' | 'playing' | 'paused'>) => {
      console.log('Speech state changed:', event.detail);
      setStatus(event.detail);
    };

    window.addEventListener('speech-state-change', handleStateChange as EventListener);
    return () => {
      window.removeEventListener('speech-state-change', handleStateChange as EventListener);
    };
  }, []);

  const handlePlay = async () => {
    if (!text || status === 'playing') return;
    
    try {
      await window.api.speak(text, selectedVoice);
      // State will be updated via the state change event
    } catch (error) {
      console.error('Play error:', error);
      setStatus('stopped');
    }
  };

  const handlePause = async () => {
    if (status !== 'playing') return;
    
    try {
      await window.api.controlPlayback('pause');
      // State will be updated via the state change event
    } catch (error) {
      console.error('Pause error:', error);
      setStatus('stopped');
    }
  };

  const handleResume = async () => {
    if (status !== 'paused') return;
    
    try {
      await window.api.controlPlayback('play');
      // State will be updated via the state change event
    } catch (error) {
      console.error('Resume error:', error);
      setStatus('stopped');
    }
  };

  const handleStop = async () => {
    try {
      await window.api.controlPlayback('stop');
      // State will be updated via the state change event
    } catch (error) {
      console.error('Stop error:', error);
      setStatus('stopped');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (status !== 'stopped') {
          await handleStop();
        }
        setText(event.target?.result as string || '');
      };
      reader.readAsText(file);
    }
  };

  const handleVoiceChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (status !== 'stopped') {
      await handleStop();
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
          {status === 'stopped' && (
            <button 
              onClick={handlePlay}
              css={buttonStyles(settings.theme)}
              disabled={!text.trim()}
            >
              Play
            </button>
          )}
          {status === 'playing' && (
            <button 
              onClick={handlePause}
              css={buttonStyles(settings.theme)}
            >
              Pause
            </button>
          )}
          {status === 'paused' && (
            <button 
              onClick={handleResume}
              css={buttonStyles(settings.theme)}
            >
              Resume
            </button>
          )}
          {status !== 'stopped' && (
            <button 
              onClick={handleStop}
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
