import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/anton';
import '@fontsource/hurricane';
import '@fontsource/alex-brush';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
