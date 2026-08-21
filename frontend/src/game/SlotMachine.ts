import * as PIXI from 'pixi.js';
import { SpinResult } from '../types';
import { SlotConfig } from './config/SlotConfig';
import { AssetLoader } from './core/AssetLoader';
import { ReelManager } from './core/ReelManager';
import { ReelAnimator } from './animation/ReelAnimator';
import { SymbolAnimator } from './animation/SymbolAnimator';
import { WinDisplayManager } from './effects/WinDisplayManager';

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
  private reelAnimator: ReelAnimator;
  private symbolAnimator: SymbolAnimator;
  private winDisplayManager: WinDisplayManager;
  private borderSprite: PIXI.Sprite | null = null;

  private isSpinning = false;
  private currentResult: SpinResult | null = null;
  private spinCallback: ((r: SpinResult) => void) | null = null;
  private reelStopCallback: ((reelIndex: number) => void) | null = null;

  constructor() {
    this.config = new SlotConfig();
    const { borderWidth, borderHeight } = this.config.dimensions;

    this.app = new PIXI.Application({ width: borderWidth, height: borderHeight, backgroundAlpha: 0 });
    this.assetLoader = new AssetLoader(this.config);
    this.reelManager = new ReelManager(this.config, this.assetLoader);
    this.reelAnimator = new ReelAnimator(this.config, this.reelManager, this.app.ticker);
    this.symbolAnimator = new SymbolAnimator(this.config, this.reelManager);
    this.winDisplayManager = new WinDisplayManager(this.config, this.reelManager, this.symbolAnimator);
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
    // Барабаны
    this.reelManager.build(this.app.stage);

    // Рамка поверх барабанов
    const borderTexture = this.assetLoader.getBorderTexture();
    if (borderTexture) {
      this.borderSprite = new PIXI.Sprite(borderTexture);
      this.borderSprite.width = this.config.dimensions.borderWidth;
      this.borderSprite.height = this.config.dimensions.borderHeight;
      this.app.stage.addChild(this.borderSprite);
    }

    // Инициализация отображения выигрышей
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
    this.reelManager.initSpinState(matrix);
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
