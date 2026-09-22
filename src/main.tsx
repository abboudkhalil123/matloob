import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

class StartupErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown) { console.error('MATLOOB startup error', error); }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 24, fontFamily: 'Arial, sans-serif', direction: 'rtl', textAlign: 'center' }}>
        <h2>تعذر تحميل الموقع</h2>
        <p>يرجى تحديث الصفحة والمحاولة مرة أخرى. إذا استمرت المشكلة، استخدم أحدث إصدار متاح من المتصفح.</p>
      </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StartupErrorBoundary>
    <App />
  </StartupErrorBoundary>,
);
