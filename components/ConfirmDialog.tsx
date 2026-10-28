'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

// Branded replacement for window.confirm / window.alert, on the native <dialog>
// (focus trap, Esc to cancel and the backdrop come from the browser).
//
//   if (!(await confirmAction({ title: 'Delete sponsor?', message: '…', confirmLabel: 'Delete' }))) return;
//   await notify('Could not open the receipt.');
//   const reason = await askText({ title: 'Why is it rejected?', label: 'Reason' }); // null = cancelled
//
// <ConfirmRoot /> is mounted once in app/layout.tsx.

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for deletes and other changes that can't be undone */
  danger?: boolean;
  /** Only an OK button (the alert() case) */
  alertOnly?: boolean;
}

/** A one-line text box in the dialog (the prompt() case) */
export interface AskTextOptions extends Omit<ConfirmOptions, 'alertOnly'> {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: 'text' | 'url';
  /** OK stays disabled until something is typed */
  required?: boolean;
}

type Request = ConfirmOptions & {
  input?: Omit<AskTextOptions, keyof ConfirmOptions>;
  resolve: (ok: boolean, value?: string) => void;
};

let show: ((req: Request) => void) | null = null;

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    // Not mounted (shouldn't happen): fall back to the browser's own dialog
    if (!show) return resolve(options.alertOnly ? (window.alert(options.title), true) : window.confirm(options.title));
    show({ ...options, resolve });
  });
}

export function askText({ label, placeholder, defaultValue, type, required, ...options }: AskTextOptions): Promise<string | null> {
  return new Promise(resolve => {
    if (!show) return resolve(window.prompt(options.title, defaultValue));
    show({ ...options, input: { label, placeholder, defaultValue, type, required }, resolve: (ok, value) => resolve(ok ? (value ?? '') : null) });
  });
}

export function notify(title: string, message?: string): Promise<void> {
  return confirmAction({ title, message, alertOnly: true, confirmLabel: 'OK' }).then(() => undefined);
}

export function ConfirmRoot() {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState('');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    show = next => setReq(prev => {
      prev?.resolve(false); // a second request replaces an open one
      return next;
    });
    return () => { show = null; };
  }, []);

  useEffect(() => {
    setValue(req?.input?.defaultValue || '');
    if (req && ref.current && !ref.current.open) ref.current.showModal();
  }, [req]);

  const close = (ok: boolean) => {
    req?.resolve(ok, req.input ? value.trim() : undefined);
    setReq(null);
    ref.current?.close();
  };

  const Icon = req?.danger ? AlertTriangle : Info;
  return (
    <dialog
      ref={ref}
      className="confirm-dialog glass-panel"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={req?.message ? 'confirm-dialog-message' : undefined}
      onCancel={e => { e.preventDefault(); close(false); }}
      onClick={e => { if (e.target === e.currentTarget) close(false); }}
    >
      {req && (
        <form method="dialog" onSubmit={e => { e.preventDefault(); close(true); }}>
          <div className="row row-loose" style={{ alignItems: 'flex-start' }}>
            <span className={`confirm-dialog-icon${req.danger ? ' is-danger' : ''}`} aria-hidden="true"><Icon size={20} /></span>
            <div className="min-w-0">
              <h2 id="confirm-dialog-title" className="confirm-dialog-title">{req.title}</h2>
              {req.message && <p id="confirm-dialog-message" className="confirm-dialog-message">{req.message}</p>}
              {req.input && (
                <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <label htmlFor="confirm-dialog-input" className="form-label">{req.input.label}</label>
                  <input id="confirm-dialog-input" className="form-input" type={req.input.type || 'text'} autoFocus
                    inputMode={req.input.type === 'url' ? 'url' : undefined} placeholder={req.input.placeholder}
                    value={value} onChange={e => setValue(e.target.value)} />
                </div>
              )}
            </div>
          </div>
          <div className="confirm-dialog-actions">
            {!req.alertOnly && (
              <button type="button" className="btn btn-secondary" onClick={() => close(false)} autoFocus={req.danger}>
                {req.cancelLabel || 'Cancel'}
              </button>
            )}
            <button type="submit" className={`btn ${req.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus={!req.danger && !req.input}
              disabled={!!req.input?.required && !value.trim()}>
              {req.confirmLabel || (req.alertOnly ? 'OK' : 'Confirm')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
