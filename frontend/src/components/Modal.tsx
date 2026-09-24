import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Minimal modal shell shared by every dialog: Escape cancels, the first
 * [data-autofocus] element (else the panel) takes initial focus, and focus
 * returns to the invoking control on unmount.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    target?.focus();
    return () => {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-md bg-white p-5 shadow-lg focus:outline-none"
      >
        <h2 id={titleId} className="mb-4 text-base font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Inline typed failure line: the domain code plus the safe backend message. */
export function FormError({ code, message }: { code: string; message: string }) {
  return (
    <p role="alert" className="mt-2 text-sm text-red-700">
      {code}: {message}
    </p>
  );
}
