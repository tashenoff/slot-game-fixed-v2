import * as PIXI from 'pixi.js';

/**
 * SharedPixiApp - единый PIXI.Application для всех фоновых эффектов.
 * Вместо того чтобы каждый эффект создавал свой WebGL контекст,
 * все эффекты рендерятся на ОДНОМ canvas.
 * Это критически важно для iOS/ iPad, где множественные WebGL контексты
 * вызывают падение производительности.
 */
export class SharedPixiApp {
  private static instance: SharedPixiApp | null = null;
  private app: PIXI.Application | null = null;
  private container: HTMLElement | null = null;
  private _initialized = false;

  static getInstance(): SharedPixiApp {
    if (!SharedPixiApp.instance) {
      SharedPixiApp.instance = new SharedPixiApp();
    }
    return SharedPixiApp.instance;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get stage(): PIXI.Container {
    if (!this.app) throw new Error('SharedPixiApp not initialized');
    return this.app.stage;
  }

  get ticker(): PIXI.Ticker {
    if (!this.app) throw new Error('SharedPixiApp not initialized');
    return this.app.ticker;
  }

  init(el: HTMLElement): void {
    if (this._initialized) return;
    this.container = el;

    const isMobile = typeof window !== 'undefined' && 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Оптимизация: на мобильных resolution = 1 (без ретина),
    // на десктопе стандартно
    this.app = new PIXI.Application({
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: false,          // Антиалиас не нужен для частиц
      resolution: isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'low-power', // iOS: использовать энергоэффективный GPU
    });

    if (isMobile) {
      this.app.ticker.maxFPS = 30;
    }

    this.app.stage.sortableChildren = true;

    const canvas = this.app.view as HTMLCanvasElement;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';

    el.appendChild(canvas);
    this._initialized = true;
  }

  destroy(): void {
    this._initialized = false;
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
    }
    if (this.container && this.container.parentNode) {
      const canvas = this.container.querySelector('canvas');
      if (canvas) this.container.removeChild(canvas);
    }
    this.container = null;
    SharedPixiApp.instance = null;
  }
}