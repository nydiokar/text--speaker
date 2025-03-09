export interface Theme {
  theme: 'light' | 'dark';
}

export const themeStyles = {
  light: {
    background: '#ffffff',
    text: '#000000',
    border: '#ccc',
    borderHover: '#666'
  },
  dark: {
    background: '#1e1e1e',
    text: '#ffffff',
    border: '#444',
    borderHover: '#888'
  }
};
