import * as PIXI from 'pixi.js';

interface Snowflake {
  graphic: PIXI.Graphics;
  x: number;
  y: number;
  speed: number;
  wind: number;
  radius: number;
  alpha: number;
  swing: number;       // амплитуда покачивания
  swingSpeed: number;  // скорость покачивания
  swingOffset: number; // фаза покачивания
}

export class SnowEffect {
  private app: PIXI.Application;
  private snowflakes: Snowflake[] = [];
  private container: HTMLElement | null = null;
  private readonly COUNT = 150;
  private running = false;

  constructor() {
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
    el.appendChild(this.app.view as HTMLCanvasElement);
    this.createSnowflakes();
    this.running = true;
    this.app.ticker.add((delta) => this.update(delta));
  }

  private createSnowflakes() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (let i = 0; i < this.COUNT; i++) {
      const radius = 1.5 + Math.random() * 3.5;
      const graphic = new PIXI.Graphics();
      graphic.beginFill(0xffffff, 1);
      graphic.drawCircle(0, 0, radius);
      graphic.endFill();

      const flake: Snowflake = {
        graphic,
        x: Math.random() * (width + 100) - 50,
        y: Math.random() * (height + 100) - 50,
        speed: 0.5 + Math.random() * 1.5,
        wind: -0.3 + Math.random() * 0.6,
        radius,
        alpha: 0.3 + Math.random() * 0.7,
        swing: 10 + Math.random() * 30,
        swingSpeed: 0.005 + Math.random() * 0.015,
        swingOffset: Math.random() * Math.PI * 2,
      };

      graphic.alpha = flake.alpha;
      graphic.x = flake.x;
      graphic.y = flake.y;

      this.snowflakes.push(flake);
      this.app.stage.addChild(graphic);
    }
  }

  private update(delta: number) {
    if (!this.running) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dt = delta;

    for (const flake of this.snowflakes) {
      // Движение вниз
      flake.y += flake.speed * dt;

      // Покачивание (горизонтальное колебание)
      flake.swingOffset += flake.swingSpeed * dt;
      const swingX = Math.sin(flake.swingOffset) * flake.swing * 0.01;

      // Горизонтальный сдвиг от ветра
      flake.x += flake.wind * dt * 0.5 + swingX;

      // Если снежинка ушла за пределы — возвращаем сверху
      if (flake.y > height + 50) {
        flake.y = -20 - Math.random() * 30;
        flake.x = Math.random() * (width + 100) - 50;
      }
      if (flake.x > width + 50) {
        flake.x = -50;
      } else if (flake.x < -50) {
        flake.x = width + 50;
      }

      // Обновляем позицию графического объекта
      flake.graphic.x = flake.x;
      flake.graphic.y = flake.y;
    }
  }

  destroy() {
    this.running = false;
    this.app.ticker.remove(this.update);
    this.snowflakes.forEach((f) => f.graphic.destroy());
    this.snowflakes = [];
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }
}