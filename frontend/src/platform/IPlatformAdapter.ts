/**
 * Информация об игроке от платформы
 */
export interface IPlayerInfo {
  /** Уникальный ID игрока на платформе */
  id: string;
  /** Имя игрока (если доступно) */
  name?: string;
  /** URL аватара (если доступно) */
  avatar?: string;
}

/**
 * Информация об окружении
 */
export interface IEnvironment {
  /** Язык пользователя (ru, en, tr и т.д.) */
  lang: string;
}

/**
 * Интерфейс платформенного адаптера
 * Каждая платформа (Яндекс, VK, CrazyGames и т.д.) реализует этот интерфейс
 * 
 * Данные игры хранятся на своём сервере, а не в облаке платформы!
 * Платформа нужна только для: player_id, реклама, gameReady
 */
export interface IPlatformAdapter {
  /** Название платформы */
  readonly platformName: string;
  
  /** 
   * Инициализация SDK платформы
   * Вызывается один раз при запуске игры
   */
  init(): Promise<void>;
  
  /** 
   * Получить информацию о текущем игроке
   * player.id используется для авторизации на своём сервере
   */
  getPlayer(): Promise<IPlayerInfo>;
  
  /** 
   * Показать рекламу с вознаграждением
   * @returns true если пользователь досмотрел и заслужил награду
   */
  showRewardedAd(): Promise<boolean>;
  
  /** 
   * Показать межстраничную (полноэкранную) рекламу
   */
  showInterstitialAd(): Promise<void>;
  
  /** 
   * Сообщить платформе что игра загрузилась и готова
   */
  gameReady(): void;
  
  /** 
   * Проверить, можно ли сейчас показать рекламу
   */
  canShowAd(): Promise<boolean>;
  
  /**
   * Получить информацию об окружении (язык и т.д.)
   */
  getEnvironment(): IEnvironment;
  
  /**
   * Отправить событие аналитики (опционально)
   */
  trackEvent?(eventName: string, data?: Record<string, unknown>): void;
}
