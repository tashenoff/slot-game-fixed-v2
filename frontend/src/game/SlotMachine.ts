import * as PIXI from 'pixi.js';
import { SpinResult } from '../types';
import { SlotConfig, ReelAnimationType } from './config/SlotConfig';
import { AssetLoader } from './core/AssetLoader';
import { ReelManager } from './core/ReelManager';
import { ReelAnimator } from './animation/ReelAnimator';
import { DropReelAnimator } from './animation/DropReelAnimator';
import { SymbolAnimator } from './animation/SymbolAnimator';
import { WinDisplayManager } from './effects/WinDisplayManager';
import { SlotTheme } from '../config/themes';

// Общий интерфейс для всех аниматоров барабанов
interface IReelAnimator {
  setCallbacks(callbacks: { onReelStop?: (i: number) => void; onAllReelsStopped?: () => void }): void;
  start(): void;
  stop(): void;
  isAnimating(): boolean;
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

  constructor(theme: SlotTheme) {
    this.theme = theme;
    
    // Собираем настройки dimensions из темы
    const dimensionsOverrides: Record<string, unknown> = {};
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
    
    // Собираем настройки анимации из темы
    const animationOverrides: Record<string, unknown> = {};
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
    
    // Определяем тип анимации
    this.animationType = (theme.reelAnimation?.type as ReelAnimationType) || 'spin';
    
    // Создаём конфиг с символами из темы
    this.config = new SlotConfig({
      symbols: {
        ids: theme.symbols,
        fallbackColors: theme.fallbackColors,
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

    this.app = new PIXI.Application({ width: borderWidth, height: borderHeight, backgroundAlpha: 0 });
    this.assetLoader = new AssetLoader(this.config, theme.assetsPath);
    this.reelManager = new ReelManager(this.config, this.assetLoader);
    
    // Создаём аниматор в зависимости от типа анимации темы
    this.reelAnimator = this.createReelAnimator();
    
    this.symbolAnimator = new SymbolAnimator(this.config, this.reelManager);
    this.winDisplayManager = new WinDisplayManager(this.config, this.reelManager, this.symbolAnimator);
  }

  /**
   * Создаёт аниматор барабанов в зависимости от типа анимации темы
   */
  private createReelAnimator(): IReelAnimator {
    switch (this.animationType) {
      case 'drop':
        return new DropReelAnimator(this.config, this.reelManager, this.app.ticker);
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
    }

    // Рамка поверх барабанов (zIndex 10)
    const borderTexture = this.assetLoader.getBorderTexture();
    if (borderTexture) {
      this.borderSprite = new PIXI.Sprite(borderTexture);
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
      this.reelManager.prepareDropState(matrix);
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
}
