import * as emotionReact from '@emotion/react';
import { cache } from '@emotion/css';

export { emotionReact, cache };

// Re-export commonly used emotion exports
export const { jsx, css, Global, keyframes, ThemeProvider } = emotionReact;
