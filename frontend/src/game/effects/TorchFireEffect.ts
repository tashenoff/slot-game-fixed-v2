import * as PIXI from 'pixi.js';

interface FlameParticle {
  graphic: PIXI.Graphics;
  baseY: number;
  offsetX: number;
  height: number;
  width: number;
  speed: number;
  phase: number;
  color: number;
  alpha: number;
  alphaPhase: number;
}

interface TorchConfig {
  x: number;
  y: number;
}

/**
 * TorchFireEffect - анимированный огонь для факелов на рамке слота.
 * Рисует реалистичное пламя с помощью PIXI.Graphics с несколькими слоями:
 * - внешнее оранжево-красное свечение
 * - основное жёлто-оранжевое пламя
 * - яркая белая сердцевина
 * Пламя анимируется с эффектом мерцания и колыхания на ветру.
 */
export class TorchFireEffect {
  private container: PIXI.Container;
  private flames: FlameParticle[] = [];
  private tickerFn: (() => void) | null = null;
  private _destroyed = false;

  constructor(
    private stage: PIXI.Container,
    private torches: TorchConfig[],
    private ticker: PIXI.Ticker
  ) {
    this.container = new PIXI.Container();
    this.container.zIndex = 11;
    this.stage.addChild(this.container);
    this.createFlames();
    this.startAnimation();
  }

  private createFlames(): void {
    for (const torch of this.torches) {
      // Тёмная подложка под огонь, чтобы пламя было ярче на золотой рамке
      this.createDarkBackground(torch);
      this.createTorchFlame(torch);
      this.createSparks(torch);
    }
  }

  private createDarkBackground(torch: TorchConfig): void {
    // Лёгкое затемнение позади пламени для контраста
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.2);
    bg.drawEllipse(torch.x, torch.y - 10, 40, 45);
    bg.endFill();
    this.container.addChild(bg);
  }

  private createTorchFlame(torch: TorchConfig): void {
    const layers = [
      { height: 80, width: 50, color: 0xFF4500, alpha: 0.25, speed: 0.8, phaseOffset: 0 },
      { height: 65, width: 38, color: 0xFF6600, alpha: 0.45, speed: 1.0, phaseOffset: 1.2 },
      { height: 48, width: 26, color: 0xFFAA00, alpha: 0.65, speed: 1.2, phaseOffset: 2.5 },
      { height: 28, width: 14, color: 0xFFF8DC, alpha: 0.9, speed: 1.5, phaseOffset: 3.8 },
    ];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const count = i === 0 ? 3 : (i === layers.length - 1 ? 1 : 2);
      for (let j = 0; j < count; j++) {
        const graphic = new PIXI.Graphics();
        const phase = layer.phaseOffset + j * 1.5;
        const flame: FlameParticle = {
          graphic,
          baseY: torch.y,
          offsetX: torch.x + (j - (count - 1) / 2) * (layer.width * 0.4),
          height: layer.height * (0.7 + Math.random() * 0.6),
          width: layer.width * (0.7 + Math.random() * 0.6),
          speed: layer.speed * (0.8 + Math.random() * 0.4),
          phase,
          color: layer.color,
          alpha: layer.alpha * (0.7 + Math.random() * 0.3),
          alphaPhase: Math.random() * Math.PI * 2,
        };
        this.drawFlame(graphic, flame.width, flame.height, flame.color);
        graphic.x = flame.offsetX;
        graphic.y = flame.baseY;
        graphic.alpha = flame.alpha;
        this.container.addChild(graphic);
        this.flames.push(flame);
      }
    }
  }

  private createSparks(torch: TorchConfig): void {
    for (let i = 0; i < 10; i++) {
      const sparkGraphic = new PIXI.Graphics();
      const sparkSize = 2 + Math.random() * 3;
      sparkGraphic.beginFill(0xFFD700, 0.6 + Math.random() * 0.4);
      sparkGraphic.drawCircle(0, 0, sparkSize);
      sparkGraphic.endFill();

      const spark: FlameParticle = {
        graphic: sparkGraphic,
        baseY: torch.y - 30 - Math.random() * 50,
        offsetX: torch.x + (Math.random() - 0.5) * 40,
        height: 0,
        width: sparkSize,
        speed: 0.8 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        color: 0xFFD700,
        alpha: 0.5 + Math.random() * 0.5,
        alphaPhase: Math.random() * Math.PI * 2,
      };
      sparkGraphic.x = spark.offsetX;
      sparkGraphic.y = spark.baseY;
      sparkGraphic.alpha = spark.alpha;
      this.container.addChild(sparkGraphic);
      this.flames.push(spark);
    }
  }
private drawFlame(graphic: PIXI.Graphics, width: number, height: number, color: number): void {
    graphic.clear();
    const hw = width / 2;

    graphic.beginFill(color);
    graphic.moveTo(0, -height);
    graphic.bezierCurveTo(
      hw * 1.2, -height * 0.7,
      hw, -height * 0.3,
      hw, -height * 0.1
    );
    graphic.arc(0, 0, hw, 0, Math.PI);
    graphic.bezierCurveTo(
      -hw, -height * 0.3,
      -hw * 1.2, -height * 0.7,
      0, -height
    );
    graphic.endFill();

    // Внутренний блик для жёлтого и белого слоёв
    if (color === 0xFFAA00 || color === 0xFFF8DC) {
      const innerColor = color === 0xFFAA00 ? 0xFFDD44 : 0xFFFFFF;
      graphic.beginFill(innerColor, 0.35);
      graphic.moveTo(0, -height * 0.75);
      graphic.bezierCurveTo(
        hw * 0.6, -height * 0.5,
        hw * 0.4, -height * 0.15,
        hw * 0.4, 0
      );
      graphic.arc(0, 0, hw * 0.4, 0, Math.PI);
      graphic.bezierCurveTo(
        -hw * 0.4, -height * 0.15,
        -hw * 0.6, -height * 0.5,
        0, -height * 0.75
      );
      graphic.endFill();
    }
  }

  private startAnimation(): void {
    if (this._destroyed) return;

    const update = (): void => {
      if (this._destroyed) return;
      const time = Date.now() * 0.001;

      for (const flame of this.flames) {
        const sway = Math.sin(time * 1.2 * flame.speed + flame.phase * 0.7) * 4;
        const heightPulse = 1 + 0.08 * Math.sin(time * 2.5 * flame.speed + flame.phase * 1.3);

        // Мерцание альфа-канала
        const alphaFlicker = 0.5 + 0.5 * Math.sin(time * 4 * flame.speed + flame.alphaPhase);
        flame.graphic.alpha = flame.alpha * (0.3 + 0.7 * alphaFlicker);

        // Горизонтальное качание
        flame.graphic.x = flame.offsetX + sway;

        // Пульсация высоты пламени
        if (flame.height > 0) {
          const currentHeight = flame.height * heightPulse;
          const currentWidth = flame.width * (1 + 0.1 * Math.sin(time * 3 * flame.speed + flame.phase));
          this.drawFlame(flame.graphic, currentWidth, currentHeight, flame.color);
        }

        // Анимация искр
        if (flame.width <= 3 && flame.width > 0) {
          const sparkFloat = (time * 30 * flame.speed + flame.phase * 10) % 60;
          flame.graphic.y = flame.baseY - sparkFloat * 0.5;
          flame.graphic.x = flame.offsetX + Math.sin(time * 2 + flame.phase) * 8 - sparkFloat * 0.15;

          const sparkLife = sparkFloat / 60;
          const sparkAlpha = Math.sin(sparkLife * Math.PI) * flame.alpha;
          flame.graphic.alpha = Math.max(0, sparkAlpha);
        }
      }
    };

    this.tickerFn = update;
    this.ticker.add(update);
  }

  destroy(): void {
    this._destroyed = true;
    if (this.tickerFn) {
      this.ticker.remove(this.tickerFn);
      this.tickerFn = null;
    }
    this.container.destroy({ children: true });
  }
}