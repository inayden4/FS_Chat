import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level cache so if beforeinstallprompt fires before component mounts, we don't miss it
let cachedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let isAppAlreadyInstalled = false;

if (typeof window !== 'undefined') {
  // Check if launched as standalone PWA
  const checkStandalone = () => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  };

  if (checkStandalone()) {
    isAppAlreadyInstalled = true;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedDeferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('pwa-installable-changed', { detail: true }));
  });

  window.addEventListener('appinstalled', () => {
    isAppAlreadyInstalled = true;
    cachedDeferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed-changed', { detail: true }));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => cachedDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isAppAlreadyInstalled);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      isAppAlreadyInstalled = true;
    }

    // Detect iOS devices (iPhone, iPad, iPod) including iPadOS Safari (which reports MacIntel with touch points)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

    // Only flag iOS if NOT already running installed in standalone mode
    setIsIOS(Boolean(isIOSDevice && !isStandalone && !isAppAlreadyInstalled));

    if (cachedDeferredPrompt && !deferredPrompt) {
      setDeferredPrompt(cachedDeferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      cachedDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(cachedDeferredPrompt);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      isAppAlreadyInstalled = true;
      cachedDeferredPrompt = null;
      setDeferredPrompt(null);
    };

    const handlePromptChanged = () => {
      setDeferredPrompt(cachedDeferredPrompt);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-installable-changed', handlePromptChanged);
    window.addEventListener('pwa-installed-changed', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-installable-changed', handlePromptChanged);
      window.removeEventListener('pwa-installed-changed', handleAppInstalled);
    };
  }, [deferredPrompt]);

  const install = async () => {
    const promptEvent = deferredPrompt || cachedDeferredPrompt;
    if (!promptEvent) return false;

    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        isAppAlreadyInstalled = true;
        cachedDeferredPrompt = null;
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.warn('Error during PWA installation prompt:', err);
    }
    return false;
  };

  return {
    isInstallable: Boolean((deferredPrompt || cachedDeferredPrompt) && !isInstalled),
    isInstalled,
    isIOS,
    install
  };
}
