import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { initAuthUnauthorizedHandler, useAuthStore } from './store/auth';
import { useToastsStore } from './store/toasts';
import './styles/global.css';
import './styles/components.css';
import './styles/activity.css';

// Unregister any stale service workers that may intercept API requests
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000
    }
  }
});

let previousStatus = useAuthStore.getState().status;
useAuthStore.subscribe((state) => {
  if (previousStatus === 'authenticated' && state.status === 'unauthenticated') {
    useToastsStore.getState().push({ kind: 'info', message: 'Session expired — please reconnect.' });
  }
  previousStatus = state.status;
});

initAuthUnauthorizedHandler();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
