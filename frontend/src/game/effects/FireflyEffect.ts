import * as PIXI from 'pixi.js';

interface Firefly {
  graphic: PIXI.Graphics;
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

/**
 * FireflyEffect - эффект светлячков для темы ацтеков.
 * Маленькие золотистые огоньки плавно парят по всему экрану,
 * мягко мерцают и создают атмосферу джунглей.
 */
export class FireflyEffect {
  private app: PIXI.Application;
  private fireflies: Firefly[] = [];
  private container: HTMLElement | null = null;
  private running = false;

  private options: Required<FireflyEffectOptions> = {
    count: 30,
    colors: [0xFFD700, 0xFFA500, 0xFFB347, 0xFFEC8B, 0xEEDD82],
    minRadius: 2.0,
    maxRadius: 4.0,
  };

  constructor(options?: FireflyEffectOptions) {
    if (options) this.options = { ...this.options, ...options };

    this.app = new PIXI.Application({
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.app.stage.sortableChildren = true;
  }

  init(el: HTMLElement) {
    this.container = el;
    const canvas = this.app.view as HTMLCanvasElement;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';

    el.appendChild(canvas);
    this.createFireflies();
    this.running = true;
    this.app.ticker.add((delta) => this.update(delta));
  }

  private createFireflies() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (let i = 0; i < this.options.count; i++) {
      const radius = this.options.minRadius + Math.random() * (this.options.maxRadius - this.options.minRadius);
      const color = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];

      const x = Math.random() * width;
      const y = Math.random() * height;

      const graphic = new PIXI.Graphics();

      // Внешнее свечение (ореол)
      graphic.beginFill(color, 0.2);
      graphic.drawCircle(0, 0, radius * 4);
      graphic.endFill();

      // Внутреннее свечение
      graphic.beginFill(color, 0.5);
      graphic.drawCircle(0, 0, radius * 2);
      graphic.endFill();

      // Яркая сердцевина
      graphic.beginFill(0xFFFFFF, 0.9);
      graphic.drawCircle(0, 0, radius * 0.5);
      graphic.endFill();

      // Основной цветной центр
      graphic.beginFill(color, 1);
      graphic.drawCircle(0, 0, radius);
      graphic.endFill();

      this.fireflies.push({
        graphic,
        x,
        y,
        speedX: (Math.random() - 0.5) * 0.6,
        speedY: (Math.random() - 0.5) * 0.4,
        radius,
        alpha: 0.5 + Math.random() * 0.5,
        alphaSpeed: 0.5 + Math.random() * 0.8,
        alphaPhase: Math.random() * Math.PI * 2,
      });

      graphic.x = x;
      graphic.y = y;
      this.app.stage.addChild(graphic);
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
    if (this.container && this.app.view.parentNode) {
      this.container.removeChild(this.app.view as HTMLCanvasElement);
    }
    this.app.destroy(true, { children: true });
  }
}