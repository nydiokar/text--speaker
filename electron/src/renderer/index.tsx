/** @jsxImportSource @emotion/react */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CacheProvider } from '@emotion/react';
import { cache, Global } from './emotion-shim';
import { App } from './App';
import { globalStyles } from './styles/global';

// Disable React.StrictMode in production to prevent double-mounting
const Root = process.env.NODE_ENV === 'production' 
  ? ({ children }: { children: React.ReactNode }) => <>{children}</>
  : React.StrictMode;

const container = document.getElementById('root');
if (!container) {
  const error = new Error('Failed to find the root element');
  console.error(error);
  
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.style.display = 'block';
    errorDiv.innerHTML = `
      <h2>Application Error</h2>
      <p>${error.message}</p>
      <button onclick="location.reload()">Reload Application</button>
    `;
  }
  throw error;
}

const root = createRoot(container);

root.render(
  <Root>
    <CacheProvider value={cache}>
      <Global styles={globalStyles} />
      <App />
    </CacheProvider>
  </Root>
);
