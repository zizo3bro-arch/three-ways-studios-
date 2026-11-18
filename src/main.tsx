import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/anton/latin.css';
import '@fontsource/alex-brush/latin.css';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
