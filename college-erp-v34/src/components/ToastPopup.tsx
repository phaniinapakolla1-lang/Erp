import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

export const ToastPopup: React.FC<{ toast: ToastMessage | null; onClose: () => void; durationMs?: number }> = ({
  toast,
  onClose,
  durationMs = 4500,
}) => {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [toast, durationMs, onClose]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 380,
        padding: '13px 16px',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: toast.type === 'success' ? '#0f766e' : '#b91c1c',
        color: '#ffffff',
        boxShadow: '0 14px 32px rgba(15, 23, 42, 0.28)',
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      {toast.type === 'success' ? <CheckCircle2 size={18} style={{ flexShrink: 0 }} /> : <AlertCircle size={18} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1, lineHeight: 1.35 }}>{toast.text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 2, display: 'inline-flex' }}
      >
        <X size={15} />
      </button>
    </div>
  );
};
