import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Alert } from '../components/ui/Alert';

type Toast = { id: number; tone: 'success' | 'danger' | 'info' | 'warning'; message: string };
const ToastContext = createContext<(tone: Toast['tone'], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const push = useCallback((tone: Toast['tone'], message: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, tone, message }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'danger' ? 9000 : 5000);
    }, []);
    return (
        <ToastContext.Provider value={push}>
            {children}
            <div className="toast-region" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <Alert key={t.id} tone={t.tone} className="toast">
                        <p>{t.message}</p>
                    </Alert>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
