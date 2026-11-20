import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { mountApp } from './app';

const root = document.getElementById('app');
if (root) mountApp(root);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  registerSW({ immediate: true });
}
