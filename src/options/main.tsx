import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsApp } from './App';
import '../index.css';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(<OptionsApp />);
}
