import { useEffect, useRef } from "react";

const CLOSE_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" fill="none" />
  </svg>
);

function useDismiss(onClose, focusSelector) {
  const ref = useRef(null);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const target = ref.current?.querySelector(focusSelector) || ref.current;
    if (target && typeof target.focus === "function") target.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, focusSelector]);

  return ref;
}

export function Drawer({ title, onClose, children, footer }) {
  const ref = useDismiss(onClose, "input, select, textarea");
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="drawer__head">
          <h2 className="drawer__title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close panel">
            {CLOSE_ICON}
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer ? <footer className="drawer__foot">{footer}</footer> : null}
      </aside>
    </>
  );
}

export function Modal({ title, onClose, children, footer }) {
  const ref = useDismiss(onClose, "textarea, input");
  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="panel__head" style={{ padding: 0, border: 0 }}>
          <h2 className="panel__title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            {CLOSE_ICON}
          </button>
        </div>
        {children}
        {footer ? <div className="form-actions" style={{ justifyContent: "flex-end" }}>{footer}</div> : null}
      </div>
    </div>
  );
}
