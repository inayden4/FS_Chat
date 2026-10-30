/**
 * Browser configuration service for FS_Chat desktop & web.
 * Allows choosing and persisting which browser FS_Chat should launch in.
 */

export type BrowserId =
  | 'auto'
  | 'ask'
  | 'chrome'
  | 'msedge'
  | 'brave'
  | 'firefox'
  | 'opera'
  | 'vivaldi';

export interface BrowserOptionInfo {
  id: BrowserId;
  name: string;
  vendor: string;
  icon: string;
  badge?: string;
  description: string;
  appModeSupported: boolean;
}

export const AVAILABLE_BROWSERS: BrowserOptionInfo[] = [
  {
    id: 'auto',
    name: 'Автоматично (По подразбиране)',
    vendor: 'Системен браузър',
    icon: '🌐',
    badge: 'Препоръчано',
    description: 'Използва браузъра по подразбиране или автоматично открит Chromium за чист App прозорец.',
    appModeSupported: true,
  },
  {
    id: 'ask',
    name: 'Винаги питай при стартиране',
    vendor: 'Интерактивен избор',
    icon: '❓',
    badge: 'Избор всеки път',
    description: 'При стартиране на FS_Chat.exe се показва меню за избор между наличните инсталирани браузъри.',
    appModeSupported: true,
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    vendor: 'Google',
    icon: '🟡',
    badge: 'App режим',
    description: 'Стартира като самостоятелно десктоп приложение без адресна лента и раздели.',
    appModeSupported: true,
  },
  {
    id: 'msedge',
    name: 'Microsoft Edge',
    vendor: 'Microsoft',
    icon: '🔵',
    badge: 'Вграден в Windows',
    description: 'Наличен на всеки компютър с Windows 10/11. Поддържа пълен App режим с хардуерно ускорение.',
    appModeSupported: true,
  },
  {
    id: 'brave',
    name: 'Brave Browser',
    vendor: 'Brave Software',
    icon: '🦁',
    badge: 'Повишена сигурност',
    description: 'Вградено спиране на проследяващи бисквитки, тракери и реклами. Поддържа App режим.',
    appModeSupported: true,
  },
  {
    id: 'firefox',
    name: 'Mozilla Firefox',
    vendor: 'Mozilla Foundation',
    icon: '🦊',
    badge: 'Gecko Engine',
    description: 'Бърз, сигурен и независим браузър с фокус върху личните данни.',
    appModeSupported: false,
  },
  {
    id: 'opera',
    name: 'Opera / Opera GX',
    vendor: 'Opera Software',
    icon: '🔴',
    badge: 'Гейминг / Медия',
    description: 'Модерен браузър с вградени функции за сигурност и мултимедия.',
    appModeSupported: true,
  },
  {
    id: 'vivaldi',
    name: 'Vivaldi',
    vendor: 'Vivaldi Technologies',
    icon: '🟣',
    badge: 'Персонализация',
    description: 'Силно адаптивен браузър с разширено управление на паметта.',
    appModeSupported: true,
  },
];

const LOCAL_STORAGE_KEY = 'fs_chat_browser_choice';

export interface BrowserConfig {
  browser: BrowserId;
  rememberChoice: boolean;
  updatedAt?: number;
}

/**
 * Get current browser configuration from server or local storage fallback
 */
export async function getBrowserConfig(): Promise<BrowserConfig> {
  const fallback: BrowserConfig = {
    browser: (localStorage.getItem(LOCAL_STORAGE_KEY) as BrowserId) || 'auto',
    rememberChoice: true,
    updatedAt: Date.now(),
  };

  try {
    const res = await fetch('/api/browser-config', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.config) {
        if (data.config.browser) {
          localStorage.setItem(LOCAL_STORAGE_KEY, data.config.browser);
        }
        return data.config;
      }
    }
  } catch (_) {
    // offline or static fallback
  }

  return fallback;
}

/**
 * Save browser configuration to server and local storage
 */
export async function saveBrowserConfig(
  browser: BrowserId,
  rememberChoice: boolean = true
): Promise<{ success: boolean; config: BrowserConfig }> {
  localStorage.setItem(LOCAL_STORAGE_KEY, browser);

  const newConfig: BrowserConfig = {
    browser,
    rememberChoice,
    updatedAt: Date.now(),
  };

  try {
    const res = await fetch('/api/browser-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, config: data.config || newConfig };
    }
  } catch (e) {
    console.warn('Could not sync browser config to server:', e);
  }

  return { success: true, config: newConfig };
}
