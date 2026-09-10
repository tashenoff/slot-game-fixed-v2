import { IPlatformAdapter, IPlayerInfo, IEnvironment } from '../IPlatformAdapter';

/**
 * Типы для Telegram Mini Apps SDK
 * Документация: https://core.telegram.org/bots/webapps
 */
declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  /** Строка initData для верификации на сервере */
  initData: string;
  /** Разобранные данные (небезопасные — не доверять!) */
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: number;
    hash?: string;
  };
  /** Цветовая схема */
  colorScheme: 'light' | 'dark';
  /** Тема оформления */
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  /** Сообщить Telegram что интерфейс готов */
  ready(): void;
  /** Расширить окно на весь экран */
  expand(): void;
  /** Закрыть Mini App */
  close(): void;
  /** Показать всплывающее сообщение */
  showAlert(message: string): void;
  /** Показать подтверждение */
  showConfirm(message: string): Promise<boolean>;
  /** Показать всплывающее уведомление */
  showPopup(params: { title?: string; message: string; buttons?: { type?: 'default' | 'ok' | 'close' | 'cancel'; text?: string; id?: string }[] }): void;
  /** Отправить Haptic Feedback */
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  /** Версия Telegram */
  version: string;
  /** Платформа */
  platform: string;
  /** Размер окна */
  viewportHeight: number;
  viewportStableHeight: number;
  /** Изменение размера окна */
  onEvent(eventType: 'viewportChanged', callback: (event: { isStateStable: boolean }) => void): void;
  /** Отключить событие */
  offEvent(eventType: 'viewportChanged', callback: (event: { isStateStable: boolean }) => void): void;
}

/**
 * Адаптер для Telegram Mini Apps
 * Документация: https://core.telegram.org/bots/webapps
 *
 * Telegram Mini App запускается внутри Telegram, игрок авторизуется
 * через встроенный WebView.
 */
export class TelegramAdapter implements IPlatformAdapter {
  readonly platformName = 'telegram';

  private webApp: TelegramWebApp | null = null;
  private user: TelegramUser | null = null;
  private lang: string = 'ru';

  async init(): Promise<void> {
    console.log('[TelegramAdapter] Инициализация Telegram Mini App...');

    // Проверяем наличие Telegram WebApp
    if (!window.Telegram?.WebApp) {
      throw new Error('Telegram WebApp SDK не найден. Запустите приложение внутри Telegram.');
    }

    this.webApp = window.Telegram.WebApp;

    // Сообщаем Telegram что приложение готово
    this.webApp.ready();
    this.webApp.expand();

    // Получаем данные пользователя из initDataUnsafe
    const unsafeData = this.webApp.initDataUnsafe;
    if (unsafeData?.user) {
      this.user = unsafeData.user;
      this.lang = unsafeData.user.language_code || 'ru';
    } else {
      // Если пользователь не авторизован (например, предпросмотр ссылки)
      console.log('[TelegramAdapter] Пользователь не авторизован, генерируем гостевой ID');
    }

    console.log(`[TelegramAdapter] Инициализирован, язык: ${this.lang}, пользователь: ${this.user?.first_name || 'гость'}`);
  }

  async getPlayer(): Promise<IPlayerInfo> {
    if (this.user) {
      return {
        id: this.user.id.toString(),
        name: [this.user.first_name, this.user.last_name].filter(Boolean).join(' ') || 'Telegram Player',
        avatar: this.user.photo_url || undefined,
      };
    }

    // Гостевой ID для режима предпросмотра
    const guestId = 'tg_guest_' + Math.random().toString(36).substring(2, 10);
    return {
      id: guestId,
      name: 'Гость Telegram',
      avatar: undefined,
    };
  }

  async showRewardedAd(): Promise<boolean> {
    console.log('[TelegramAdapter] Telegram не поддерживает встроенную рекламу через SDK');
    // В Telegram Mini Apps реклама показывается через внешние SDK (например, Adsgram)
    // Пока возвращаем true для совместимости
    return true;
  }

  async showInterstitialAd(): Promise<void> {
    console.log('[TelegramAdapter] Telegram не поддерживает встроенную межстраничную рекламу');
    // Заглушка — можно интегрировать Adsgram или другую сеть
  }

  gameReady(): void {
    // ready() уже вызван в init(), дополнительных действий не требуется
    console.log('[TelegramAdapter] Игра готова');
  }

  async canShowAd(): Promise<boolean> {
    return true;
  }

  getEnvironment(): IEnvironment {
    return {
      lang: this.lang,
    };
  }

  trackEvent(eventName: string, data?: Record<string, unknown>): void {
    console.log('[TelegramAdapter] Event:', eventName, data);
  }
}

/** Внутренний тип пользователя Telegram */
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}