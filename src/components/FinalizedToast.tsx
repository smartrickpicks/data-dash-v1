import { useEffect, useState } from 'react';
import { CheckCircle, Undo2, X } from 'lucide-react';
import { FinalizedAction } from '../types';

interface ToastItem {
  action: FinalizedAction;
  id: string;
  progress: number;
}

interface FinalizedToastProps {
  actions: FinalizedAction[];
  onUndo: (action: FinalizedAction) => void;
  onDismiss: (action: FinalizedAction) => void;
  autoDismissMs?: number;
}

const TOAST_DURATION = 12000;
const UPDATE_INTERVAL = 50;

export function FinalizedToast({
  actions,
  onUndo,
  onDismiss,
  autoDismissMs = TOAST_DURATION,
}: FinalizedToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const newToasts = actions.map((action) => ({
      action,
      id: `${action.sheetName}-${action.rowIndex}-${action.timestamp}`,
      progress: 100,
    }));
    setToasts(newToasts);
  }, [actions]);

  useEffect(() => {
    if (toasts.length === 0) return;

    const interval = setInterval(() => {
      setToasts((current) => {
        const updated = current.map((toast) => ({
          ...toast,
          progress: Math.max(0, toast.progress - (100 * UPDATE_INTERVAL) / autoDismissMs),
        }));

        const expired = updated.filter((t) => t.progress <= 0);
        expired.forEach((t) => onDismiss(t.action));

        return updated.filter((t) => t.progress > 0);
      });
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [toasts.length, autoDismissMs, onDismiss]);

  const handleUndo = (toast: ToastItem) => {
    onUndo(toast.action);
    setToasts((current) => current.filter((t) => t.id !== toast.id));
  };

  const handleDismissClick = (toast: ToastItem) => {
    onDismiss(toast.action);
    setToasts((current) => current.filter((t) => t.id !== toast.id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.slice(-5).map((toast) => (
        <div
          key={toast.id}
          className="relative bg-slate-800 text-white rounded-lg shadow-xl overflow-hidden animate-slide-up"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Row finalized</p>
              <p className="text-xs text-slate-400 truncate">
                Row {toast.action.rowIndex + 1} in {toast.action.sheetName}
              </p>
            </div>
            <button
              onClick={() => handleUndo(toast)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              onClick={() => handleDismissClick(toast)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700">
            <div
              className="h-full bg-green-500 transition-all duration-50 ease-linear"
              style={{ width: `${toast.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
