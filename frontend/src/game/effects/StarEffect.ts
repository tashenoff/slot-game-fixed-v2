import * as PIXI from 'pixi.js';

/**
 * Звезда на небе
 */
interface Star {
  graphic: PIXI.Graphics;
  x: number;            // Нормализованная позиция по горизонтали (0..1)
  y: number;            // Нормализованная позиция по вертикали в области неба (0..1)
  baseAlpha: number;    // Базовая прозрачность
  twinkleAmplitude: number; // Амплитуда мерцания
  twinkleSpeed: number;     // Скорость мерцания
  twinklePhase: number;     // Фаза мерцания
}

/**
 * Метеор
 */
interface Meteor {
  graphic: PIXI.Graphics;
  active: boolean;
  progress: number;       // 0..1, прогресс полёта
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;       // секунд на весь путь
  trailLength: number;    // px длина хвоста
  radius: number;         // радиус головы метеора
  color: number;
  alpha: number;
}

interface StarEffectOptions {
  starCount?: number;        // Количество звёзд
  colors?: number[];         // Цвета звёзд
  skyHeightRatio?: number;   // Какая часть экрана сверху считается небом (0..1)
  minRadius?: number;        // Минимальный радиус звезды (px)
  maxRadius?: number;        // Максимальный радиус звезды (px)
  twinkleEnabled?: boolean;  // Включить мерцание
  meteorsEnabled?: boolean;  // Включить метеоры
}

/**
 * StarEffect - эффект мерцающих звёзд на небе для египетской темы.
 * Звёзды располагаются в верхней части экрана (зона неба), имеют мягкий
 * ореол и плавно, слегка мерцают, не отвлекая от игрового интерфейса.
 */
export class StarEffect {
  private app: PIXI.Application;
  private stars: Star[] = [];
  private meteor: Meteor;
  private container: HTMLElement | null = null;
  private running = false;
  private time = 0;
  private meteorTimer: ReturnType<typeof setTimeout> | null = null;

  private options: Required<StarEffectOptions> = {
    starCount: 75,
    colors: [0xFFFFFF, 0xFFF3D6, 0xFFE9B8, 0xD6E8FF, 0xEAF2FF],
    skyHeightRatio: 0.42,
    minRadius: 0.7,
    maxRadius: 1.9,
    twinkleEnabled: true,
    meteorsEnabled: true,
  };

  constructor(options?: StarEffectOptions) {
    if (options) this.options = { ...this.options, ...options };

    this.app = new PIXI.Application({
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Инициализация метеора (неактивен)
    const meteorGraphic = new PIXI.Graphics();
    this.meteor = {
      graphic: meteorGraphic,
      active: false,
      progress: 0,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      duration: 0.8,
      trailLength: 90,
      radius: 2.0,
      color: 0xEEF2FF,
      alpha: 0.85,
    };
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
    this.createStars();
    this.app.stage.addChild(this.meteor.graphic);
    this.running = true;
    this.app.ticker.add((delta) => this.update(delta));

    // Запланировать первый метеор через случайный интервал
    if (this.options.meteorsEnabled) {
      this.scheduleMeteor(5000 + Math.random() * 8000);
    }
  }

  private createStars() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const skyHeight = height * this.options.skyHeightRatio;

    for (let i = 0; i < this.options.starCount; i++) {
      const radius = this.options.minRadius + Math.random() * (this.options.maxRadius - this.options.minRadius);
      const color = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];

      // Часть звёзд чуть ярче
      const isBright = Math.random() < 0.3;
      const baseAlpha = isBright ? 0.35 + Math.random() * 0.3 : 0.16 + Math.random() * 0.25;

      const graphic = new PIXI.Graphics();

      // Мягкий ореол (обычное смешивание, еле заметный)
      if (isBright) {
        graphic.beginFill(color, 0.09 + Math.random() * 0.07);
        graphic.drawCircle(0, 0, radius * 3.2);
      }

      // Тело звезды
      graphic.beginFill(color, 1);
      graphic.drawCircle(0, 0, radius);
      graphic.endFill();

      // Нежный светлый центр
      graphic.beginFill(0xFFFFFF, 0.55);
      graphic.drawCircle(0, 0, Math.max(0.45, radius * 0.45));
      graphic.endFill();

      graphic.alpha = baseAlpha;

      const star: Star = {
        graphic,
        // Меньше звёзд в нижней части неба - лёгкий градиент вверх
        x: Math.random(),
        y: Math.pow(Math.random(), 1.15),
        baseAlpha,
        twinkleAmplitude: isBright ? 0.14 + Math.random() * 0.16 : 0.06 + Math.random() * 0.12,
        twinkleSpeed: 0.5 + Math.random() * 1.6,
        twinklePhase: Math.random() * Math.PI * 2,
      };

      // Стартовая позиция
      graphic.x = star.x * width;
      graphic.y = star.y * skyHeight;

      this.stars.push(star);
      this.app.stage.addChild(graphic);
    }
  }

  private scheduleMeteor(delay: number) {
    if (this.meteorTimer) clearTimeout(this.meteorTimer);
    this.meteorTimer = setTimeout(() => {
      if (!this.running) return;
      this.startMeteor();
    }, delay);
  }

  private startMeteor() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const skyHeight = height * this.options.skyHeightRatio;

    // Стартует из левого верхнего угла (чуть за краем экрана)
    const startX = -20 - Math.random() * 60;
    const startY = -30 + Math.random() * 60;

    // Конечная точка — центр экрана (в зоне неба)
    const endX = width * (0.3 + Math.random() * 0.3);
    const endY = skyHeight * (0.3 + Math.random() * 0.45);

    this.meteor.startX = startX;
    this.meteor.startY = startY;
    this.meteor.endX = endX;
    this.meteor.endY = endY;
    this.meteor.progress = 0;
    this.meteor.active = true;
    this.meteor.trailLength = 60 + Math.random() * 60;
    this.meteor.duration = 0.8 + Math.random() * 0.6;
    this.meteor.radius = 1.4 + Math.random() * 0.9;
    this.meteor.color = Math.random() < 0.4 ? 0xFFF8E1 : 0xEEF2FF;
    this.meteor.alpha = 0.7 + Math.random() * 0.25;
    this.meteor.graphic.visible = true;
  }

  /**
   * Рисует тонкий векторный шлейф метеора — вытянутый конус с плавным
   * сужением к концу и лёгким изгибом.
   */
  private drawMeteorBody(
    g: PIXI.Graphics,
    headX: number,
    headY: number,
    tailX: number,
    tailY: number,
    px: number,
    py: number,
    headW: number,
    bend: number,
    color: number,
    alpha: number
  ) {
    const midX = (headX + tailX) / 2 + px * bend;
    const midY = (headY + tailY) / 2 + py * bend;

    g.beginFill(color, alpha);
    g.moveTo(headX + px * headW, headY + py * headW);
    g.quadraticCurveTo(midX + px * headW * 0.4, midY + py * headW * 0.4, tailX, tailY);
    g.quadraticCurveTo(midX - px * headW * 0.4, midY - py * headW * 0.4, headX - px * headW, headY - py * headW);
    g.closePath();
    g.endFill();
  }

  private updateMeteor(dt: number) {
    if (!this.meteor.active) return;

    this.meteor.progress += (dt * 0.016) / this.meteor.duration;

    if (this.meteor.progress >= 1) {
      this.meteor.active = false;
      this.meteor.graphic.visible = false;
      this.meteor.graphic.clear();
      // Следующий метеор через 8–16 секунд
      this.scheduleMeteor(8000 + Math.random() * 8000);
      return;
    }

    const p = Math.min(this.meteor.progress, 1);
    const headX = this.meteor.startX + (this.meteor.endX - this.meteor.startX) * p;
    const headY = this.meteor.startY + (this.meteor.endY - this.meteor.startY) * p;

    // Направление полёта
    const dx = this.meteor.endX - this.meteor.startX;
    const dy = this.meteor.endY - this.meteor.startY;
    const len = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const nx = dx / len;
    const ny = dy / len;

    // Перпендикуляр к направлению
    const px = -ny;
    const py = nx;

    // Точка конца шлейфа
    const tailX = headX - nx * this.meteor.trailLength;
    const tailY = headY - ny * this.meteor.trailLength;

    const baseAlpha = this.meteor.alpha;
    const g = this.meteor.graphic;
    g.clear();

    // Внешний полупрозрачный шлейф (тонкий, лёгкое свечение)
    this.drawMeteorBody(
      g, headX, headY, tailX, tailY, px, py,
      this.meteor.radius * 1.05, 4.5,
      this.meteor.color, baseAlpha * 0.3
    );

    // Внутренний яркий тонкий шлейф (ядро метеора)
    this.drawMeteorBody(
      g, headX, headY, tailX, tailY, px, py,
      this.meteor.radius * 0.5, 2.5,
      0xFFFFFF, baseAlpha * 0.7
    );

    // Компактная яркая голова метеора
    g.beginFill(0xFFFFFF, baseAlpha * 0.95);
    g.drawCircle(headX, headY, Math.max(1.0, this.meteor.radius * 0.6));
    g.endFill();
  }

  private update(delta: number) {
    if (!this.running) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const skyHeight = height * this.options.skyHeightRatio;
    const dt = delta;

    // Время в секундах (независимо от FPS)
    this.time += dt * 0.016;

    for (const star of this.stars) {
      // Плавное лёгкое мерцание через синус
      if (this.options.twinkleEnabled) {
        const t = this.time * star.twinkleSpeed + star.twinklePhase;
        const twinkle = star.baseAlpha + Math.sin(t) * star.twinkleAmplitude;
        star.graphic.alpha = Math.max(0.04, Math.min(0.85, twinkle));
      }

      // Позиция пересчитывается каждый кадр, поэтому звёзды
      // корректно следуют за областью неба при ресайзе окна
      star.graphic.x = star.x * width;
      star.graphic.y = star.y * skyHeight;
    }

    // Обновление метеора
    this.updateMeteor(dt);
  }

  setVisible(visible: boolean) {
    for (const star of this.stars) {
      star.graphic.visible = visible;
    }
    this.meteor.graphic.visible = visible && this.meteor.active;
  }

  destroy() {
    this.running = false;
    if (this.meteorTimer) clearTimeout(this.meteorTimer);
    this.app.ticker.remove(this.update);
    this.stars.forEach((s) => s.graphic.destroy({ children: true }));
    this.stars = [];
    this.meteor.graphic.destroy();
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }
}