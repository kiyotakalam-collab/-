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
    registration.update().catch(error => callbacks.onError?.(error));
    return registration;
  } catch (error) {
    callbacks.onError?.(error);
    return null;
  }
}

export function activateUpdate(registration: ServiceWorkerRegistration): void {
  const worker = registration.waiting;
  if (!worker) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  worker.postMessage({ type: 'SKIP_WAITING' });
}
