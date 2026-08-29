import * as PIXI from 'pixi.js';
import { SpinResult } from '../types';
import { SlotConfig, ReelAnimationType } from './config/SlotConfig';
import { AssetLoader } from './core/AssetLoader';
import { ReelManager } from './core/ReelManager';
import { ReelAnimator } from './animation/ReelAnimator';
import { DropReelAnimator } from './animation/DropReelAnimator';
import { SymbolAnimator } from './animation/SymbolAnimator';
import { WinDisplayManager } from './effects/WinDisplayManager';
import { SlotTheme, isMobileDevice } from '../config/themes';

// Общий интерфейс для всех аниматоров барабанов
interface IReelAnimator {
  setCallbacks(callbacks: { onReelStop?: (i: number) => void; onAllReelsStopped?: () => void }): void;
  start(): void;
  stop(): void;
  isAnimating(): boolean;
  setPendingMatrix?(matrix: string[][]): void; // Для drop анимации - установка матрицы новых символов
}

/**
 * SlotMachine - главный фасад слот-машины (рефакторенная версия)
 * Координирует работу всех подсистем
 */
export class SlotMachine {
  private app: PIXI.Application;
  private container: HTMLElement | null = null;
  private config: SlotConfig;
  private assetLoader: AssetLoader;
  private reelManager: ReelManager;
  private reelAnimator: IReelAnimator;
  private symbolAnimator: SymbolAnimator;
  private winDisplayManager: WinDisplayManager;
  private borderSprite: PIXI.Sprite | null = null;
  private theme: SlotTheme;
  private animationType: ReelAnimationType;

  private isSpinning = false;
  private currentResult: SpinResult | null = null;
  private spinCallback: ((r: SpinResult) => void) | null = null;
  private reelStopCallback: ((reelIndex: number) => void) | null = null;
  private mobileConfig: SlotTheme['mobile'] | null = null;

  constructor(theme: SlotTheme, forceMobile?: boolean) {
    this.theme = theme;
    
    // Определяем мобильный режим
    const isMobile = forceMobile ?? isMobileDevice();
    
    // Получаем мобильные настройки если они есть и мы на мобильном
    const mobileConfig = (isMobile && theme.mobile) ? theme.mobile : null;
    this.mobileConfig = mobileConfig;
    
    // Собираем настройки dimensions из темы (с учётом мобильных переопределений)
    const dimensionsOverrides: Record<string, unknown> = {};
    
    // Базовые настройки из темы
    if (theme.borderWidth !== undefined) {
      dimensionsOverrides.borderWidth = theme.borderWidth;
    }
    if (theme.borderHeight !== undefined) {
      dimensionsOverrides.borderHeight = theme.borderHeight;
    }
    if (theme.symbolSizeRatio !== undefined) {
      dimensionsOverrides.symbolSizeRatio = theme.symbolSizeRatio;
    }
    if (theme.symbolFillCell !== undefined) {
      dimensionsOverrides.symbolFillCell = theme.symbolFillCell;
    }
    if (theme.cellWidth !== undefined) {
      dimensionsOverrides.cellWidth = theme.cellWidth;
    }
    if (theme.cellHeight !== undefined) {
      dimensionsOverrides.cellHeight = theme.cellHeight;
    }
    if (theme.reelsOffsetX !== undefined) {
      dimensionsOverrides.reelsOffsetX = theme.reelsOffsetX;
    }
    if (theme.reelsOffsetY !== undefined) {
      dimensionsOverrides.reelsOffsetY = theme.reelsOffsetY;
    }
    if (theme.reelsAreaWidth !== undefined) {
      dimensionsOverrides.reelsAreaWidth = theme.reelsAreaWidth;
    }
    if (theme.reelsAreaHeight !== undefined) {
      dimensionsOverrides.reelsAreaHeight = theme.reelsAreaHeight;
    }
    if (theme.reelsAutoCenter !== undefined) {
      dimensionsOverrides.reelsAutoCenter = theme.reelsAutoCenter;
    }
    if (theme.reelsCenterYOffset !== undefined) {
      dimensionsOverrides.reelsCenterYOffset = theme.reelsCenterYOffset;
    }
    if (theme.reelGap !== undefined) {
      dimensionsOverrides.reelGap = theme.reelGap;
    }
    if (theme.rowGap !== undefined) {
      dimensionsOverrides.rowGap = theme.rowGap;
    }
    
    // Переопределяем мобильными настройками если они есть
    if (mobileConfig) {
      if (mobileConfig.borderWidth !== undefined) dimensionsOverrides.borderWidth = mobileConfig.borderWidth;
      if (mobileConfig.borderHeight !== undefined) dimensionsOverrides.borderHeight = mobileConfig.borderHeight;
      if (mobileConfig.reelsOffsetX !== undefined) dimensionsOverrides.reelsOffsetX = mobileConfig.reelsOffsetX;
      if (mobileConfig.reelsOffsetY !== undefined) dimensionsOverrides.reelsOffsetY = mobileConfig.reelsOffsetY;
      if (mobileConfig.reelsAreaWidth !== undefined) dimensionsOverrides.reelsAreaWidth = mobileConfig.reelsAreaWidth;
      if (mobileConfig.reelsAreaHeight !== undefined) dimensionsOverrides.reelsAreaHeight = mobileConfig.reelsAreaHeight;
      if (mobileConfig.reelsAutoCenter !== undefined) dimensionsOverrides.reelsAutoCenter = mobileConfig.reelsAutoCenter;
      if (mobileConfig.reelsCenterYOffset !== undefined) dimensionsOverrides.reelsCenterYOffset = mobileConfig.reelsCenterYOffset;
      if (mobileConfig.reelGap !== undefined) dimensionsOverrides.reelGap = mobileConfig.reelGap;
      if (mobileConfig.rowGap !== undefined) dimensionsOverrides.rowGap = mobileConfig.rowGap;
      if (mobileConfig.cellWidth !== undefined) dimensionsOverrides.cellWidth = mobileConfig.cellWidth;
      if (mobileConfig.cellHeight !== undefined) dimensionsOverrides.cellHeight = mobileConfig.cellHeight;
    }
    
    // Устанавливаем флаг мобильного режима (транспонирование сетки)
    if (isMobile && mobileConfig) {
      dimensionsOverrides.isMobileLayout = true;
      // Передаём флаг отключения blur для оптимизации производительности
      if (mobileConfig.disableBlur) {
        dimensionsOverrides.disableBlur = true;
      }
    }
    
    // Собираем настройки анимации из темы
    const animationOverrides: Record<string, unknown> = {};
    // Базовые настройки из темы
    if (theme.reelAnimation) {
      const ra = theme.reelAnimation;
      if (ra.type) animationOverrides.reelAnimationType = ra.type;
      if (ra.direction) animationOverrides.reelAnimationDirection = ra.direction;
      if (ra.speed) animationOverrides.spinSpeed = ra.speed;
      if (ra.bounceHeight) animationOverrides.bounceHeight = ra.bounceHeight;
      if (ra.bounceTime) animationOverrides.bounceTime = ra.bounceTime;
      if (ra.staggerDelay) animationOverrides.stopDelay = ra.staggerDelay;
      if (ra.spinTime) animationOverrides.spinTime = ra.spinTime;
    }
    // Переопределяем мобильными настройками анимации если они есть
    if (mobileConfig?.reelAnimation) {
      const ra = mobileConfig.reelAnimation;
      if (ra.type) animationOverrides.reelAnimationType = ra.type;
      if (ra.direction) animationOverrides.reelAnimationDirection = ra.direction;
      if (ra.speed) animationOverrides.spinSpeed = ra.speed;
      if (ra.bounceHeight) animationOverrides.bounceHeight = ra.bounceHeight;
      if (ra.bounceTime) animationOverrides.bounceTime = ra.bounceTime;
      if (ra.staggerDelay) animationOverrides.stopDelay = ra.staggerDelay;
      if (ra.spinTime) animationOverrides.spinTime = ra.spinTime;
    }
    
    // Определяем тип анимации (мобильный конфиг имеет приоритет)
    this.animationType = (mobileConfig?.reelAnimation?.type as ReelAnimationType) 
      || (theme.reelAnimation?.type as ReelAnimationType) 
      || 'spin';
    
    // Создаём конфиг с символами из темы
    this.config = new SlotConfig({
      symbols: {
        ids: theme.symbols,
        fallbackColors: theme.fallbackColors,
        rarityGlowColors: theme.glowColors || {
          A: '#FF1744',
          B: '#E91E63',
          C: '#2979FF',
          D: '#00E676',
          E: '#AA00FF',
          F: '#00BCD4',
        },
        rarityGlowIntensity: theme.glowIntensity || {
          A: 1.0,
          B: 0.8,
          C: 0.6,
          D: 0.4,
          E: 0.15,
          F: 0.15,
        },
      },
      // Применяем настройки dimensions если они есть
      ...(Object.keys(dimensionsOverrides).length > 0 && {
        dimensions: dimensionsOverrides,
      }),
      // Применяем настройки анимации если они есть
      ...(Object.keys(animationOverrides).length > 0 && {
        animation: animationOverrides,
      }),
    });
    
    const { borderWidth, borderHeight } = this.config.dimensions;

    // Используем devicePixelRatio для чёткой картинки на Retina экранах
    // Ограничиваем до 2 на мобильных чтобы не грузить GPU
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    this.app = new PIXI.Application({ 
      width: borderWidth, 
      height: borderHeight, 
      backgroundAlpha: 0,
      resolution: dpr,
      autoDensity: true,
    });
    // Передаём тему в AssetLoader для загрузки правильной рамки (мобильной/десктопной)
    this.assetLoader = new AssetLoader(this.config, theme.assetsPath, theme);
    this.reelManager = new ReelManager(this.config, this.assetLoader);
    
    // Создаём аниматор в зависимости от типа анимации темы
    this.reelAnimator = this.createReelAnimator();
    
    this.symbolAnimator = new SymbolAnimator(this.config, this.reelManager, this.reelManager.getSymbolFactory());
    // Создаём менеджер отображения выигрышей с учётом мобильных оптимизаций
    this.winDisplayManager = new WinDisplayManager(this.config, this.reelManager, this.symbolAnimator, {
      disableWinLines: this.mobileConfig?.disableWinLines,
      disableShine: this.mobileConfig?.disableShine,
      cascadeWinHighlight: this.mobileConfig?.cascadeWinHighlight,
    });
  }

  /**
   * Создаёт аниматор барабанов в зависимости от типа анимации темы
   */
  private createReelAnimator(): IReelAnimator {
    switch (this.animationType) {
      case 'drop':
        // Для drop анимации включаем эффект пыли (отключаем на мобильных для производительности)
        return new DropReelAnimator(this.config, this.reelManager, this.app.ticker, {
          dustEffect: !this.mobileConfig?.disableDust,
        });
      case 'spin':
      default:
        return new ReelAnimator(this.config, this.reelManager, this.app.ticker);
    }
  }

  async init(el: HTMLElement): Promise<void> {
    this.container = el;
    el.appendChild(this.app.view as HTMLCanvasElement);

    await this.assetLoader.load();
    this.buildScene();

    this.reelAnimator.setCallbacks({
      onReelStop: (i) => this.reelStopCallback?.(i),
      onAllReelsStopped: () => this.onSpinComplete(),
    });

    window.addEventListener('resize', () => this.resize());
    this.resize();
    
    // Повторный resize через RAF для гарантии правильного расчёта flex-контейнера
    requestAnimationFrame(() => {
      this.resize();
    });
  }

  private buildScene(): void {
    // Включаем сортировку по zIndex
    this.app.stage.sortableChildren = true;

    // Барабаны (нижний слой - zIndex 0)
    const reelsContainer = this.reelManager.build(this.app.stage);
    if (reelsContainer) {
      reelsContainer.zIndex = 0;
      reelsContainer.sortableChildren = true;
      
      // Инициализируем эффект пыли для drop анимации
      if (this.animationType === 'drop' && this.reelAnimator instanceof DropReelAnimator) {
        (this.reelAnimator as DropReelAnimator).initDustEffect(reelsContainer, {
          // Песочные цвета для египетской темы - много мелкой пыли
          colors: [0xD4A574, 0xC4956A, 0xE8C99B, 0xDEB887, 0xC9B896, 0xBFAE8C],
          particleCount: 120,    // Много мелких частиц
          spreadX: 55,           // Разброс
          spreadY: 18,           // Высота
          minSize: 0.5,          // Очень мелкие
          maxSize: 1.8,          // Мелкие
          baseAlpha: 0.55,       // Видимая пыль
        });
      }
    }

    // Рамка поверх барабанов (zIndex 10)
    const borderTexture = this.assetLoader.getBorderTexture();
    if (borderTexture) {
      this.borderSprite = new PIXI.Sprite(borderTexture);
      // Устанавливаем размеры рамки из конфига
      // ВАЖНО: borderWidth/borderHeight в theme.json должны соответствовать реальным размерам изображения!
      this.borderSprite.width = this.config.dimensions.borderWidth;
      this.borderSprite.height = this.config.dimensions.borderHeight;
      this.borderSprite.zIndex = 10;
      this.app.stage.addChild(this.borderSprite);
    }

    // Инициализация отображения выигрышей (zIndex 20 - выше рамки)
    this.winDisplayManager.init(this.app.stage, this.app.ticker);
  }

  private resize(): void {
    if (!this.container) return;
    const { borderWidth, borderHeight } = this.config.dimensions;
    
    // Получаем размеры контейнера
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    
    if (containerWidth <= 0 || containerHeight <= 0) return;
    
    // Вычисляем масштаб, чтобы слот вписался в контейнер с сохранением пропорций
    const scaleByWidth = containerWidth / borderWidth;
    const scaleByHeight = containerHeight / borderHeight;
    
    // Выбираем меньший масштаб, чтобы слот полностью помещался
    const scale = Math.min(scaleByWidth, scaleByHeight);
    
    this.app.renderer.resize(borderWidth * scale, borderHeight * scale);
    this.app.stage.scale.set(scale);
  }

  // === Публичные методы ===

  setSpinResult(result: SpinResult): void {
    this.currentResult = result;
  }

  setReelStopCallback(cb: (reelIndex: number) => void): void {
    this.reelStopCallback = cb;
  }

  spin(cb: (r: SpinResult) => void): void {
    if (this.isSpinning) return;

    this.clear();
    this.isSpinning = true;
    this.spinCallback = cb;

    const matrix = this.currentResult?.matrix || this.reelManager.generateRandomMatrix();
    
    // Выбираем метод подготовки в зависимости от типа анимации
    if (this.animationType === 'drop') {
      // Для drop анимации: передаём матрицу в аниматор, он сам обновит текстуры после выхода старых символов
      this.reelAnimator.setPendingMatrix?.(matrix);
    } else {
      this.reelManager.initSpinState(matrix);
    }
    
    this.reelAnimator.start();
  }

  private onSpinComplete(): void {
    this.isSpinning = false;
    if (this.currentResult) {
      this.winDisplayManager.showWins(this.currentResult.wins);
      this.spinCallback?.(this.currentResult);
    }
  }

  private clear(): void {
    this.reelAnimator.stop();
    this.winDisplayManager.hide();
  }

  destroy(): void {
    this.clear();
    this.reelManager.destroy();
    this.assetLoader.destroy();
    this.winDisplayManager.destroy();
    this.app?.destroy(true, { children: true, texture: true, baseTexture: true });
  }

  /**
   * Получить текущий FPS
   */
  getFPS(): number {
    return this.app?.ticker?.FPS ?? 0;
  }

  /**
   * Получить ticker для подписки на обновления
   */
  getTicker(): PIXI.Ticker | null {
    return this.app?.ticker ?? null;
  }
}
