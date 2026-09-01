import * as PIXI from 'pixi.js';

interface Point {
  x: number;
  y: number;
}

/**
 * LightningEffect - процедурная молния для выигрышей из камней (A, B, C, F)
 * 
 * Рисует ломаную зигзагообразную линию между точками с эффектом свечения.
 * Каждый кадр форма молнии меняется (jitter), создавая эффект "живого" разряда.
 * 
 * Слои:
 *   1. Glow (толстая, полупрозрачная, синяя) — свечение
 *   2. Main (основная голубая линия) — разряд
 *   3. Core (белое ядро) — центр разряда
 */
export class LightningEffect {
  private container: PIXI.Container;
  private glowLayer: PIXI.Graphics;
  private mainLayer: PIXI.Graphics;
  private coreLayer: PIXI.Graphics;
  private ticker: PIXI.Ticker;
  private tickerCallback: (() => void) | null = null;

  private points: Point[] = [];
  private basePoints: Point[] = [];
  private segments: number = 8;
  private amplitude: number = 12;

  private colors = {
    glow: 0x00BFFF as number,     // Deep Sky Blue — яркое свечение
    main: 0x66E0FF as number,     // Светлый голубой — разряд
    core: 0xFFFFFF as number,     // White — яркое ядро
  };

  private lineWidth = {
    glow: 26,
    main: 9,
    core: 3.5,
  };

  // Однократная анимация: фазы по кадрам (~60fps)
  private readonly APPEAR_FRAMES = 10;   // ~0.17с — появление (прорисовка)
  private readonly HOLD_FRAMES = 28;     // ~0.47с — удержание с мерцанием
  private readonly FADE_FRAMES = 14;     // ~0.23с — затухание
  private lifetime: number = 0;

  constructor(ticker: PIXI.Ticker) {
    this.ticker = ticker;
    this.container = new PIXI.Container();

    this.glowLayer = new PIXI.Graphics();
    this.mainLayer = new PIXI.Graphics();
    this.coreLayer = new PIXI.Graphics();

    this.glowLayer.filters = [new PIXI.filters.BlurFilter(4)];

    this.container.addChild(this.glowLayer);
    this.container.addChild(this.mainLayer);
    this.container.addChild(this.coreLayer);
    this.container.visible = false;
    this.container.zIndex = 30;
  }

  getContainer(): PIXI.Container {
    return this.container;
  }

  setColors(colors: { glow?: number; main?: number; core?: number }): void {
    if (colors.glow !== undefined) this.colors.glow = colors.glow;
    if (colors.main !== undefined) this.colors.main = colors.main;
    if (colors.core !== undefined) this.colors.core = colors.core;
  }

  setGeometry(segments: number, amplitude: number): void {
    this.segments = segments;
    this.amplitude = amplitude;
  }

  show(points: Point[], animated: boolean = true): void {
    if (points.length < 2) return;

    this.points = points;
    this.basePoints = this.generateBasePoints(points);
    this.lifetime = 0;
    this.container.visible = true;

    this.startAnimation();
  }

  hide(): void {
    this.stop();
  }

  destroy(): void {
    this.stop();
    this.container.destroy({ children: true });
  }

// ===== Внутренние методы =====

  private stop(): void {
    this.stopAnimation();
    this.container.visible = false;
    this.clear();
  }

  private generateBasePoints(inputPoints: Point[]): Point[] {
    if (inputPoints.length < 2) return inputPoints;

    const result: Point[] = [];

    for (let i = 0; i < inputPoints.length - 1; i++) {
      const p1 = inputPoints[i];
      const p2 = inputPoints[i + 1];

      if (i === 0) result.push({ x: p1.x, y: p1.y });

      for (let j = 1; j < this.segments; j++) {
        const t = j / this.segments;
        result.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        });
      }

      result.push({ x: p2.x, y: p2.y });
    }

    return result;
  }

  private jitterPoints(): Point[] {
    if (this.basePoints.length < 2) return this.basePoints;

    const jittered: Point[] = [{ x: this.basePoints[0].x, y: this.basePoints[0].y }];

    for (let i = 1; i < this.basePoints.length - 1; i++) {
      const base = this.basePoints[i];
      const prev = this.basePoints[i - 1];
      const next = this.basePoints[i + 1];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;

      const offset = (Math.random() - 0.5) * 2 * this.amplitude;
      jittered.push({
        x: base.x + perpX * offset,
        y: base.y + perpY * offset,
      });
    }

    jittered.push({
      x: this.basePoints[this.basePoints.length - 1].x,
      y: this.basePoints[this.basePoints.length - 1].y,
    });

    return jittered;
  }

  private drawPath(g: PIXI.Graphics, points: Point[], progress: number): void {
    const visibleCount = Math.max(2, Math.floor(points.length * progress));
    if (visibleCount < 2) return;

    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < visibleCount; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
  }

  private clear(): void {
    this.glowLayer.clear();
    this.mainLayer.clear();
    this.coreLayer.clear();
  }

  private draw(): void {
    this.clear();

    const jittered = this.jitterPoints();

    // Фаза появления: progress от 0 до 1
    let progress: number;
    let fadeAlpha: number;
    let flicker: number = 1;

    if (this.lifetime < this.APPEAR_FRAMES) {
      // Появление — молния прорисовывается
      progress = this.lifetime / this.APPEAR_FRAMES;
      fadeAlpha = 1;
      flicker = 1;
    } else if (this.lifetime < this.APPEAR_FRAMES + this.HOLD_FRAMES) {
      // Удержание — молния видна целиком, мерцает
      progress = 1;
      fadeAlpha = 1;
      // Мерцание: случайные провалы яркости
      if (this.lifetime % 4 === 0) {
        flicker = 0.5 + Math.random() * 0.5;
      } else if (this.lifetime % 6 === 0) {
        flicker = 0.3; // Кратковременное "гашение"
      }
    } else {
      // Затухание — плавное исчезновение
      progress = 1;
      const fadeFrames = this.lifetime - (this.APPEAR_FRAMES + this.HOLD_FRAMES);
      fadeAlpha = 1 - (fadeFrames / this.FADE_FRAMES);
      flicker = 1;
    }

    const totalAlpha = flicker * fadeAlpha;

    // Glow слой (толстое размытое свечение)
    this.glowLayer.lineStyle(this.lineWidth.glow, this.colors.glow, 0.4 * totalAlpha);
    this.drawPath(this.glowLayer, jittered, progress);

    // Main слой (основная линия разряда)
    this.mainLayer.lineStyle(this.lineWidth.main, this.colors.main, 0.9 * totalAlpha);
    this.drawPath(this.mainLayer, jittered, progress);

    // Core слой (яркое белое ядро)
    this.coreLayer.lineStyle(this.lineWidth.core, this.colors.core, totalAlpha);
    this.drawPath(this.coreLayer, jittered, progress);
  }

  private startAnimation(): void {
    if (this.tickerCallback) this.ticker.remove(this.tickerCallback);
    this.tickerCallback = () => this.update();
    this.ticker.add(this.tickerCallback);
  }

  private stopAnimation(): void {
    if (this.tickerCallback) {
      this.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }
  }

  private update(): void {
    this.lifetime++;

    const totalFrames = this.APPEAR_FRAMES + this.HOLD_FRAMES + this.FADE_FRAMES;
    if (this.lifetime >= totalFrames) {
      this.stop();
      return;
    }

    this.draw();
  }
}

/**
 * LightningManager - управление несколькими разрядами молнии
 */
export class LightningManager {
  private effects: LightningEffect[] = [];
  private stage: PIXI.Container;
  private ticker: PIXI.Ticker;

  constructor(stage: PIXI.Container, ticker: PIXI.Ticker, poolSize: number = 5) {
    this.stage = stage;
    this.ticker = ticker;

    for (let i = 0; i < poolSize; i++) {
      const effect = new LightningEffect(ticker);
      this.stage.addChild(effect.getContainer());
      this.effects.push(effect);
    }
  }

  showLightning(lineIndex: number, points: Point[], animated: boolean = true): void {
    if (lineIndex >= 0 && lineIndex < this.effects.length) {
      this.effects[lineIndex].show(points, animated);
    }
  }

  hideLightning(lineIndex: number): void {
    if (lineIndex >= 0 && lineIndex < this.effects.length) {
      this.effects[lineIndex].hide();
    }
  }

  hideAll(): void {
    this.effects.forEach(effect => effect.hide());
  }

  destroy(): void {
    this.effects.forEach(effect => effect.destroy());
    this.effects = [];
  }
}