import * as PIXI from 'pixi.js';

/**
 * Частица песка
 */
interface SandParticle {
  graphic: PIXI.Sprite;
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

interface SharedRenderContext {
  stage: PIXI.Container;
  ticker: PIXI.Ticker;
}

/**
 * SandEffect - эффект песчаной бури для египетской темы.
 * Использует PIXI.Sprite с текстурой вместо PIXI.Graphics для производительности.
 * Может работать на shared PIXI.Application (один WebGL контекст для всех эффектов).
 */
export class SandEffect {
  private app: PIXI.Application | null = null;
  private sharedContext: SharedRenderContext | null = null;
  private parentContainer: PIXI.Container | null = null;
  private particles: SandParticle[] = [];
  private container: HTMLElement | null = null;
  private running = false;
  
  private particleTexture: PIXI.Texture | null = null;
  
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
  }

  /**
   * Инициализация эффекта на shared PIXI.Application
   * (один WebGL контекст для всех фоновых эффектов)
   */
  initOnStage(context: SharedRenderContext): void {
    this.sharedContext = context;
    this.parentContainer = new PIXI.Container();
    context.stage.addChild(this.parentContainer);
    
    this.createParticleTexture();
    this.createParticles();
    this.running = true;
    context.ticker.add((delta) => this.update(delta));
    
    if (this.options.gustEnabled) this.startGustTimer();
  }

  /**
   * Оригинальный метод инициализации (создаёт свой PIXI.Application)
   * Для обратной совместимости
   */
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
    
    this.createParticleTexture();
    this.createParticles();
    this.running = true;
    this.app.ticker.add((delta) => this.update(delta));
    
    if (this.options.gustEnabled) this.startGustTimer();
    window.addEventListener('resize', this.handleResize);
  }

  private createParticleTexture(): void {
    const size = 4;
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(size, size, 0, size, size, size);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size * 2, size * 2);
    this.particleTexture = PIXI.Texture.from(canvas);
  }

  private createParticles() {
    if (!this.parentContainer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    for (let i = 0; i < this.options.particleCount; i++) {
      const layer = Math.random() < 0.3 ? 2 : (Math.random() < 0.5 ? 1 : 0);
      const cfg = this.getLayerConfig(layer);
      const color = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];
      const size = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
      
      const sprite = new PIXI.Sprite(this.particleTexture!);
      sprite.anchor.set(0.5);
      sprite.tint = color;
      sprite.scale.set(size / 4);
      
      const x = Math.random() * (width + 200) - 100;
      const y = Math.random() * height;
      const baseSpeed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      const windDir = this.options.windDirection === 'right' ? 1 : -1;
      
      const particle: SandParticle = {
        graphic: sprite,
        x, y,
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
      };
      
      sprite.alpha = particle.alpha * this.options.intensity;
      sprite.x = particle.x;
      sprite.y = particle.y;
      sprite.zIndex = layer;
      
      this.particles.push(particle);
      this.parentContainer!.addChild(sprite);
    }
  }

  private getLayerConfig(layer: number) {
    switch (layer) {
      case 2: return { sizeMin: 2.5, sizeMax: 5, speedMin: 1.5, speedMax: 2.5, alphaMin: 0.12, alphaMax: 0.28 };
      case 1: return { sizeMin: 1.2, sizeMax: 2.5, speedMin: 1, speedMax: 1.8, alphaMin: 0.15, alphaMax: 0.35 };
      default: return { sizeMin: 0.5, sizeMax: 1.2, speedMin: 0.5, speedMax: 1, alphaMin: 0.1, alphaMax: 0.25 };
    }
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
      
      // Вращение
      p.rotation += p.rotationSpeed * dt * gustEffect;
      p.graphic.rotation = p.rotation;
      
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
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
    } else if (this.parentContainer) {
      this.parentContainer.destroy({ children: true });
      this.parentContainer = null;
    }
    this.particleTexture?.destroy(true);
    this.particleTexture = null;
  }
}
