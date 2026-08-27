import * as PIXI from 'pixi.js';

/**
 * Частица песка
 */
interface SandParticle {
  graphic: PIXI.Graphics;
  x: number;
  y: number;
  baseSpeed: number;
  speedX: number;
  speedY: number;
  size: number;
  alpha: number;
  turbulence: number;
  turbulenceSpeed: number;
  turbulenceOffset: number;
  layer: number;
  color: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'circle' | 'oval' | 'irregular';
}

interface SandEffectOptions {
  particleCount?: number;
  windDirection?: 'left' | 'right';
  windSpeed?: number;
  intensity?: number;
  colors?: number[];
  gustEnabled?: boolean;
  gustInterval?: number;
}

/**
 * SandEffect - эффект песчаной бури для египетской темы
 */
export class SandEffect {
  private app: PIXI.Application;
  private particles: SandParticle[] = [];
  private container: HTMLElement | null = null;
  private running = false;
  
  private options: Required<SandEffectOptions> = {
    particleCount: 180,
    windDirection: 'right',
    windSpeed: 4,
    intensity: 1.0,
    colors: [0xD4A574, 0xC4956A, 0xE8C99B, 0xDEB887, 0xF5DEB3, 0xCD853F, 0xDAA520],
    gustEnabled: true,
    gustInterval: 3000,
  };
  
  private gustActive = false;
  private gustMultiplier = 1;
  private gustTimer: number | null = null;
  private gustDuration = 0;
  private gustMaxDuration = 60;

  constructor(options?: SandEffectOptions) {
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
    this.createParticles();
    this.running = true;
    this.app.ticker.add((delta) => this.update(delta));
    
    if (this.options.gustEnabled) this.startGustTimer();
    window.addEventListener('resize', this.handleResize);
  }

  private createParticles() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    for (let i = 0; i < this.options.particleCount; i++) {
      const layer = Math.random() < 0.3 ? 2 : (Math.random() < 0.5 ? 1 : 0);
      const cfg = this.getLayerConfig(layer);
      const color = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];
      const size = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
      const shapeRand = Math.random();
      const shape: 'circle' | 'oval' | 'irregular' = 
        shapeRand < 0.5 ? 'circle' : (shapeRand < 0.8 ? 'oval' : 'irregular');
      
      const graphic = new PIXI.Graphics();
      this.drawParticle(graphic, size, color, shape);
      
      const x = Math.random() * (width + 200) - 100;
      const y = Math.random() * height;
      const baseSpeed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      const windDir = this.options.windDirection === 'right' ? 1 : -1;
      
      const particle: SandParticle = {
        graphic, x, y,
        baseSpeed: baseSpeed * this.options.windSpeed * 0.5,
        speedX: baseSpeed * windDir * this.options.windSpeed * 0.5,
        speedY: (Math.random() - 0.5) * 0.3,
        size,
        alpha: cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin),
        turbulence: 5 + Math.random() * 15,
        turbulenceSpeed: 0.02 + Math.random() * 0.04,
        turbulenceOffset: Math.random() * Math.PI * 2,
        layer, color,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        shape,
      };
      
      graphic.alpha = particle.alpha * this.options.intensity;
      graphic.x = particle.x;
      graphic.y = particle.y;
      graphic.zIndex = layer;
      
      this.particles.push(particle);
      this.app.stage.addChild(graphic);
    }
  }

  private getLayerConfig(layer: number) {
    // Уменьшенные скорости для более спокойного эффекта
    switch (layer) {
      case 2: return { sizeMin: 2.5, sizeMax: 5, speedMin: 1.5, speedMax: 2.5, alphaMin: 0.12, alphaMax: 0.28 };
      case 1: return { sizeMin: 1.2, sizeMax: 2.5, speedMin: 1, speedMax: 1.8, alphaMin: 0.15, alphaMax: 0.35 };
      default: return { sizeMin: 0.5, sizeMax: 1.2, speedMin: 0.5, speedMax: 1, alphaMin: 0.1, alphaMax: 0.25 };
    }
  }

  private drawParticle(graphic: PIXI.Graphics, size: number, color: number, shape: string) {
    graphic.clear();
    graphic.beginFill(color);
    switch (shape) {
      case 'oval': graphic.drawEllipse(0, 0, size, size * 0.6); break;
      case 'irregular':
        graphic.moveTo(0, -size * 0.8);
        graphic.lineTo(size * 0.7, -size * 0.3);
        graphic.lineTo(size * 0.5, size * 0.6);
        graphic.lineTo(-size * 0.3, size * 0.5);
        graphic.lineTo(-size * 0.8, 0);
        graphic.closePath();
        break;
      default: graphic.drawCircle(0, 0, size);
    }
    graphic.endFill();
  }

  private update(delta: number) {
    if (!this.running) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dt = delta;
    const windDir = this.options.windDirection === 'right' ? 1 : -1;
    
    this.updateGust();
    
    for (const p of this.particles) {
      p.turbulenceOffset += p.turbulenceSpeed * dt;
      const turbY = Math.sin(p.turbulenceOffset) * p.turbulence * 0.02;
      const turbX = Math.cos(p.turbulenceOffset * 0.7) * p.turbulence * 0.01;
      
      const gustEffect = this.gustActive ? this.gustMultiplier : 1;
      const speedX = p.baseSpeed * windDir * gustEffect;
      
      p.x += (speedX + turbX) * dt;
      p.y += (p.speedY + turbY) * dt;
      
      if (p.shape !== 'circle') {
        p.rotation += p.rotationSpeed * dt * gustEffect;
        p.graphic.rotation = p.rotation;
      }
      
      // Обёртка позиции
      if (windDir > 0 && p.x > width + 50) {
        p.x = -50 - Math.random() * 100;
        p.y = Math.random() * height;
      } else if (windDir < 0 && p.x < -50) {
        p.x = width + 50 + Math.random() * 100;
        p.y = Math.random() * height;
      }
      
      if (p.y > height + 30) p.y = -30;
      else if (p.y < -30) p.y = height + 30;
      
      p.graphic.x = p.x;
      p.graphic.y = p.y;
      
      if (this.gustActive) {
        p.graphic.alpha = p.alpha * (0.9 + Math.random() * 0.2) * this.options.intensity;
      }
    }
  }

  private startGustTimer() {
    if (this.gustTimer) clearTimeout(this.gustTimer);
    
    const scheduleNext = () => {
      const interval = this.options.gustInterval + Math.random() * 2000;
      this.gustTimer = window.setTimeout(() => {
        this.triggerGust();
        scheduleNext();
      }, interval);
    };
    scheduleNext();
  }

  private triggerGust() {
    this.gustActive = true;
    this.gustDuration = 0;
    this.gustMaxDuration = 50 + Math.random() * 50; // Более долгие, плавные порывы
    this.gustMultiplier = 1.2 + Math.random() * 0.6; // Менее резкое ускорение (1.2x - 1.8x)
  }

  private updateGust() {
    if (!this.gustActive) return;
    
    this.gustDuration++;
    const progress = this.gustDuration / this.gustMaxDuration;
    
    if (progress < 0.2) {
      this.gustMultiplier = 1 + (this.gustMultiplier - 1) * (progress / 0.2);
    } else if (progress > 0.7) {
      const fade = (progress - 0.7) / 0.3;
      this.gustMultiplier = 1 + (this.gustMultiplier - 1) * (1 - fade);
    }
    
    if (this.gustDuration >= this.gustMaxDuration) {
      this.gustActive = false;
      this.gustMultiplier = 1;
      for (const p of this.particles) {
        p.graphic.alpha = p.alpha * this.options.intensity;
      }
    }
  }

  private handleResize = () => {};

  setIntensity(intensity: number) {
    this.options.intensity = Math.max(0.1, Math.min(2.0, intensity));
    for (const p of this.particles) p.graphic.alpha = p.alpha * this.options.intensity;
  }

  setWindSpeed(speed: number) {
    const newSpeed = Math.max(1, Math.min(10, speed));
    const ratio = newSpeed / this.options.windSpeed;
    for (const p of this.particles) {
      p.baseSpeed *= ratio;
      p.speedX *= ratio;
    }
    this.options.windSpeed = newSpeed;
  }

  setWindDirection(direction: 'left' | 'right') {
    if (direction === this.options.windDirection) return;
    this.options.windDirection = direction;
    const windDir = direction === 'right' ? 1 : -1;
    for (const p of this.particles) p.speedX = Math.abs(p.speedX) * windDir;
  }

  destroy() {
    this.running = false;
    if (this.gustTimer) { clearTimeout(this.gustTimer); this.gustTimer = null; }
    window.removeEventListener('resize', this.handleResize);
    this.particles.forEach((p) => p.graphic.destroy());
    this.particles = [];
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }
}
