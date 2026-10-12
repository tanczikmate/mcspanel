import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Modal } from '../components/Modal';
import { AlertTriangle, CheckCircle2, Info, HelpCircle } from 'lucide-react';

interface DialogOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

interface DialogState {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'danger' | 'warning' | 'info' | 'success';
}

interface DialogContextType {
  alert: (message: string, title?: string, options?: DialogOptions) => Promise<void>;
  confirm: (message: string, title?: string, options?: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    confirmText: 'Rendben',
    cancelText: 'Mégse',
    variant: 'info'
  });

  const resolverRef = useRef<((value: any) => void) | null>(null);

  const showAlert = useCallback(
    (message: string, title?: string, options?: DialogOptions): Promise<void> => {
      return new Promise<void>((resolve) => {
        resolverRef.current = () => resolve();
        const variant = options?.variant || 'info';
        const defaultTitle =
          variant === 'danger'
            ? 'Hiba történt'
            : variant === 'warning'
            ? 'Figyelem'
            : variant === 'success'
            ? 'Sikeres művelet'
            : 'Értesítés';

        setDialog({
          isOpen: true,
          type: 'alert',
          title: title || options?.title || defaultTitle,
          message,
          confirmText: options?.confirmText || 'Rendben',
          cancelText: 'Mégse',
          variant
        });
      });
    },
    []
  );

  const showConfirm = useCallback(
    (message: string, title?: string, options?: DialogOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        resolverRef.current = (confirmed: boolean) => resolve(confirmed);
        const variant = options?.variant || 'danger';
        const defaultTitle = variant === 'danger' ? 'Biztosan folytatod?' : 'Megerősítés';

        setDialog({
          isOpen: true,
          type: 'confirm',
          title: title || options?.title || defaultTitle,
          message,
          confirmText: options?.confirmText || (variant === 'danger' ? 'Igen, megerősítem' : 'Megerősítés'),
          cancelText: options?.cancelText || 'Mégse',
          variant
        });
      });
    },
    []
  );

  const handleConfirm = () => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const getIcon = () => {
    switch (dialog.variant) {
      case 'danger':
        return (
          <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/60 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'success':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      case 'info':
      default:
        return dialog.type === 'confirm' ? (
          <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <DialogContext.Provider value={{ alert: showAlert, confirm: showConfirm }}>
      {children}

      <Modal
        isOpen={dialog.isOpen}
        onClose={dialog.type === 'confirm' ? handleCancel : handleConfirm}
        className="bg-md-container w-full max-w-md rounded-2xl border border-md-outlineVariant shadow-2xl p-6"
      >
        <div className="flex items-start gap-4">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white mb-1.5">{dialog.title}</h3>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed break-words whitespace-pre-wrap">
              {dialog.message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          {dialog.type === 'confirm' && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors"
            >
              {dialog.cancelText}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
              dialog.variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-neutral-100 hover:bg-white text-neutral-900'
            }`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </Modal>
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextType => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
