import { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'success' | 'error';
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { ...t, id }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const variantStyles = {
    default: 'bg-dark-bg border-gray-600',
    success: 'bg-green-900/50 border-green-600',
    error: 'bg-red-900/50 border-red-600',
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`border rounded-lg px-4 py-3 shadow-lg ${variantStyles[t.variant]} min-w-64`}>
            <p className="font-medium">{t.title}</p>
            {t.description && <p className="text-sm text-discord-muted">{t.description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
