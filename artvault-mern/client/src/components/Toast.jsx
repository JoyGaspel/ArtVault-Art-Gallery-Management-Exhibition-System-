import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const [isErr, setIsErr] = useState(false);
  const timer = useRef(null);

  const showToast = useCallback((text, isError = false) => {
    setMsg(text);
    setIsErr(isError);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2800);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast${show ? ' show' : ''}${isErr ? ' err' : ''}`}>
        <span className="dot" />
        <span>{msg}</span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
