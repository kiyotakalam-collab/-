/// <reference types="vite/client" />

interface PwaCallbacks {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onError?: (error: unknown) => void;
}

/** Production only. A waiting worker is applied only after the user's action. */
export async function setupPwa(callbacks: PwaCallbacks = {}): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    });
    if (registration.waiting) callbacks.onUpdate?.(registration);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return;
        if (navigator.serviceWorker.controller) callbacks.onUpdate?.(registration);
        else callbacks.onOfflineReady?.();
      });
    });
    // update() does not force activation or refresh the current study screen.
    const refresh = () => {
      if (navigator.onLine) void registration.update().catch(error => callbacks.onError?.(error));
    };
    // Installed Android apps may remain open for days. Recheck when returning
    // to the app or recovering the network, not only on the first boot.
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    refresh();
    return registration;
  } catch (error) {
    callbacks.onError?.(error);
    return null;
  }
}


// Check for an available update even if no new worker has announced itself.
// The caller should not claim that this proves the deployed site is current.
export async function checkPwaUpdate(registration: ServiceWorkerRegistration | null): Promise<'unsupported' | 'offline' | 'waiting' | 'checked'> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!navigator.onLine) return 'offline';
  const current = registration ?? await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL) ?? null;
  if (!current) return 'unsupported';
  await current.update();
  return current.waiting ? 'waiting' : 'checked';
}

export function activateUpdate(registration: ServiceWorkerRegistration): void {
  const worker = registration.waiting;
  if (!worker) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  worker.postMessage({ type: 'SKIP_WAITING' });
}
