import * as PIXI from 'pixi.js';

interface Firefly {
  graphic: PIXI.Sprite;
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  radius: number;
  alpha: number;
  alphaSpeed: number;
  alphaPhase: number;
}

interface FireflyEffectOptions {
  count?: number;
  colors?: number[];
  minRadius?: number;
  maxRadius?: number;
}

interface SharedRenderContext {
  stage: PIXI.Container;
  ticker: PIXI.Ticker;
}

/**
 * FireflyEffect - эффект светлячков для темы ацтеков.
 * Оптимизирован: использует PIXI.Sprite с текстурой.
 * Может работать на shared PIXI.Application.
 */
export class FireflyEffect {
  private app: PIXI.Application | null = null;
  private parentContainer: PIXI.Container | null = null;
  private fireflies: Firefly[] = [];
  private container: HTMLElement | null = null;
  private running = false;
  
  private fireflyTexture: PIXI.Texture | null = null;

  private options: Required<FireflyEffectOptions> = {
    count: 30,
    colors: [0xFFD700, 0xFFA500, 0xFFB347, 0xFFEC8B, 0xEEDD82],
    minRadius: 2.0,
    maxRadius: 4.0,
  };

  constructor(options?: FireflyEffectOptions) {
    if (options) this.options = { ...this.options, ...options };
  }

  /**
   * Инициализация на shared PIXI.Application
   */
  initOnStage(context: SharedRenderContext): void {
    this.parentContainer = context.stage;
    this.createFireflyTexture();
    this.createFireflies();
    this.running = true;
    context.ticker.add((delta) => this.update(delta));
  }

  init(el: HTMLElement) {
    this.container = el;
    
    this.app = new PIXI.Application({
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: false,
      resolution: 1,
      autoDensity: true,
      powerPreference: 'low-power',
    });
    this.app.stage.sortableChildren = true;
    
    if (typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      this.app.ticker.maxFPS = 30;
    }

    const canvas = this.app.view as HTMLCanvasElement;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';

    el.appendChild(canvas);
    this.parentContainer = this.app.stage;
    this.createFireflyTexture();
    this.createFireflies();
    this.running = true;
    this.app.ticker.add((delta) => this.update(delta));
  }

  private createFireflyTexture(): void {
    const maxR = this.options.maxRadius;
    const size = Math.ceil(maxR * 10);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;
    
    // Мягкое свечение с ярким центром
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    this.fireflyTexture = PIXI.Texture.from(canvas);
  }

  private createFireflies() {
    if (!this.parentContainer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (let i = 0; i < this.options.count; i++) {
      const radius = this.options.minRadius + Math.random() * (this.options.maxRadius - this.options.minRadius);
      const color = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];

      const x = Math.random() * width;
      const y = Math.random() * height;

      const sprite = new PIXI.Sprite(this.fireflyTexture!);
      sprite.anchor.set(0.5);
      sprite.tint = color;
      sprite.scale.set(radius / 3);

      this.fireflies.push({
        graphic: sprite,
        x,
        y,
        speedX: (Math.random() - 0.5) * 0.6,
        speedY: (Math.random() - 0.5) * 0.4,
        radius,
        alpha: 0.5 + Math.random() * 0.5,
        alphaSpeed: 0.5 + Math.random() * 0.8,
        alphaPhase: Math.random() * Math.PI * 2,
      });

      sprite.x = x;
      sprite.y = y;
      this.parentContainer.addChild(sprite);
    }
  }

  private update(delta: number) {
    if (!this.running) return;

    const dt = delta * 0.016;
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (const fly of this.fireflies) {
      // Плавное неторопливое движение
      fly.x += fly.speedX * dt * 25 + Math.sin(Date.now() * 0.001 + fly.alphaPhase) * 0.2;
      fly.y += fly.speedY * dt * 25 + Math.cos(Date.now() * 0.0012 + fly.alphaPhase * 1.3) * 0.2;

      // Очень медленная смена направления
      fly.speedX += Math.sin(Date.now() * 0.0003 + fly.alphaPhase) * 0.003;
      fly.speedY += Math.cos(Date.now() * 0.0004 + fly.alphaPhase * 1.5) * 0.003;

      // Ограничиваем скорость
      const maxSpeed = 1.0;
      fly.speedX = Math.max(-maxSpeed, Math.min(maxSpeed, fly.speedX));
      fly.speedY = Math.max(-maxSpeed, Math.min(maxSpeed, fly.speedY));

      // Отталкивание от краёв
      if (fly.x < 0) { fly.x = 0; fly.speedX = Math.abs(fly.speedX); }
      if (fly.x > width) { fly.x = width; fly.speedX = -Math.abs(fly.speedX); }
      if (fly.y < 0) { fly.y = 0; fly.speedY = Math.abs(fly.speedY); }
      if (fly.y > height) { fly.y = height; fly.speedY = -Math.abs(fly.speedY); }

      // Мягкое мерцание
      const flicker = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(Date.now() * 0.003 * fly.alphaSpeed + fly.alphaPhase));
      fly.graphic.alpha = fly.alpha * flicker;

      // Позиционирование
      fly.graphic.x = fly.x;
      fly.graphic.y = fly.y;
    }
  }

  destroy() {
    this.running = false;
    if (this.app) {
      if (this.container && this.app.view.parentNode) {
        this.container.removeChild(this.app.view as HTMLCanvasElement);
      }
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
    }
    this.fireflies.forEach((f) => f.graphic.destroy());
    this.fireflies = [];
    this.fireflyTexture?.destroy(true);
    this.fireflyTexture = null;
    this.parentContainer = null;
  }
}