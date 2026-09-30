export type HostTheme = 'light' | 'dark';

function apply(theme: HostTheme, onTheme?: (theme: HostTheme) => void) {
  document.body.classList.toggle('dark', theme === 'dark');
  onTheme?.(theme);
}

/**
 * Applies the Cribl shell's theme to this document. Returns a teardown fn.
 * Source of truth is the CRIBL_APP_LAYOUT postMessage from the host; before it
 * arrives, `prefers-color-scheme` (which the host points at the Cribl theme, not
 * the OS) is used as the first-paint hint so the page never flashes the wrong mode.
 */
export function installThemeBridge(onTheme?: (theme: HostTheme) => void): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  let fromHost = false;
  if (mq) apply(mq.matches ? 'dark' : 'light', onTheme);
  const onMq = (e: MediaQueryListEvent) => { if (!fromHost) apply(e.matches ? 'dark' : 'light', onTheme); };
  mq?.addEventListener?.('change', onMq);

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return; // any frame can post to yours
    const data = event.data as { type?: string; theme?: HostTheme } | null;
    if (data?.type !== 'CRIBL_APP_LAYOUT') return;
    if (data.theme !== 'light' && data.theme !== 'dark') return;
    fromHost = true;
    apply(data.theme, onTheme);
  };

  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('message', onMessage);
    mq?.removeEventListener?.('change', onMq);
  };
}
