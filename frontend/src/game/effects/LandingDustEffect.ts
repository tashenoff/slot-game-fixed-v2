import * as PIXI from 'pixi.js';

/**
 * Частица пыли при приземлении
 */
interface DustParticle {
  graphic: PIXI.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  maxAlpha: number;
  size: number;
  life: number;
  decay: number;
  gravity: number;
}

interface DustBurst {
  particles: DustParticle[];
  startTime: number;
  finished: boolean;
}

export interface LandingDustOptions {
  particleCount?: number;
  colors?: number[];
  spreadX?: number;
  spreadY?: number;
  minSize?: number;
  maxSize?: number;
  duration?: number;
  baseAlpha?: number;
}

/**
 * LandingDustEffect - эффект пыли при приземлении символов
 */
export class LandingDustEffect {
  private container: PIXI.Container;
  private ticker: PIXI.Ticker;
  private bursts: DustBurst[] = [];
  private tickFn: ((delta: number) => void) | null = null;
  private isActive = false;
  
  private options: Required<LandingDustOptions> = {
    particleCount: 150,       // Очень много мелких частиц
    colors: [0xD4A574, 0xC4956A, 0xE8C99B, 0xDEB887, 0xC9B896, 0xBFAE8C],
    spreadX: 60,              // Разброс
    spreadY: 20,              // Высота облака
    minSize: 0.5,             // Очень мелкие частицы
    maxSize: 2,               // Мелкие частицы
    duration: 350,            
    baseAlpha: 0.6,           // Видимая пыль
  };

  constructor(parentContainer: PIXI.Container, ticker: PIXI.Ticker, options?: LandingDustOptions) {
    this.container = new PIXI.Container();
    this.container.zIndex = 5;
    parentContainer.addChild(this.container);
    this.ticker = ticker;
    if (options) this.options = { ...this.options, ...options };
  }


  burst(x: number, y: number, width: number): void {
    const burst: DustBurst = { particles: [], startTime: Date.now(), finished: false };
    const { particleCount, colors, spreadX, spreadY, minSize, maxSize, baseAlpha } = this.options;
    const halfWidth = width / 2;
    
    for (let i = 0; i < particleCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      // Все частицы мелкие
      const size = minSize + Math.random() * (maxSize - minSize);
      
      const graphic = new PIXI.Graphics();
      graphic.beginFill(color, 1);
      // Все круглые мелкие точки
      graphic.drawCircle(0, 0, size);
      graphic.endFill();
      
      // Начальная позиция - широко по ширине ячейки у основания
      const startX = x + (Math.random() - 0.5) * halfWidth * 2.0;
      const startY = y - Math.random() * 8;
      
      // Скорость - веерообразно в стороны и вверх
      const side = Math.random() < 0.5 ? -1 : 1;
      const vx = side * (0.8 + Math.random() * 1.8) * (spreadX / 50);
      const vy = -(1.5 + Math.random() * 2.0) * (spreadY / 20);
      
      // Высокая видимость для мелких частиц
      const maxAlphaVal = baseAlpha * (0.8 + Math.random() * 0.2);
      
      const particle: DustParticle = {
        graphic, x: startX, y: startY, vx, vy,
        alpha: maxAlphaVal, maxAlpha: maxAlphaVal, size, life: 1,
        decay: 0.022 + Math.random() * 0.015,
        gravity: 0.035 + Math.random() * 0.025,
      };
      
      graphic.x = particle.x;
      graphic.y = particle.y;
      graphic.alpha = particle.alpha;
      
      burst.particles.push(particle);
      this.container.addChild(graphic);
    }
    
    this.bursts.push(burst);
    if (!this.isActive) this.startAnimation();
  }

  private startAnimation(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.tickFn = (delta: number) => this.update(delta);
    this.ticker.add(this.tickFn);
  }

  private stopAnimation(): void {
    if (this.tickFn) { this.ticker.remove(this.tickFn); this.tickFn = null; }
    this.isActive = false;
  }

  private update(delta: number): void {
    const dt = delta;
    let hasActiveBursts = false;
    
    for (const burst of this.bursts) {
      if (burst.finished) continue;
      let allDead = true;
      
      for (const p of burst.particles) {
        if (p.life <= 0) continue;
        allDead = false;
        
        p.vy += p.gravity * dt;
        p.vx *= 0.98;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
        
        const fadeProgress = 1 - p.life;
        if (fadeProgress > 0.3) {
          const fadeAmount = (fadeProgress - 0.3) / 0.7;
          p.alpha = p.maxAlpha * (1 - fadeAmount * fadeAmount);
        }
        
        p.graphic.x = p.x;
        p.graphic.y = p.y;
        p.graphic.alpha = Math.max(0, p.alpha);
        p.graphic.rotation += 0.02 * dt;
      }
      
      if (allDead) {
        burst.finished = true;
        for (const p of burst.particles) p.graphic.destroy();
        burst.particles = [];
      } else {
        hasActiveBursts = true;
      }
    }
    
    this.bursts = this.bursts.filter(b => !b.finished);
    if (!hasActiveBursts) this.stopAnimation();
  }

  stopAll(): void {
    this.stopAnimation();
    for (const burst of this.bursts) {
      for (const p of burst.particles) p.graphic.destroy();
    }
    this.bursts = [];
  }

  setOptions(options: Partial<LandingDustOptions>): void {
    this.options = { ...this.options, ...options };
  }

  destroy(): void {
    this.stopAll();
    this.container.destroy({ children: true });
  }
}
