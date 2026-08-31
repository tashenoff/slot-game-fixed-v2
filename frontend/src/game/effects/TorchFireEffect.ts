import * as PIXI from 'pixi.js';
import gsap from 'gsap';

interface TorchConfig {
  x: number;
  y: number;
}

interface Particle {
  graphic: PIXI.Graphics;
  tween: gsap.core.Timeline;
}

interface SparkParticle {
  graphic: PIXI.Graphics;
  tween: gsap.core.Timeline;
}

interface SmokeParticle {
  graphic: PIXI.Graphics;
  tween: gsap.core.Timeline;
}

/**
 * TorchFireEffect — живое пламя факелов.
 *
 * Из чего состоит:
 * 🔥 4 слоя крупных языков (капли) — анимация через gsap.to (sway/flicker/pulse)
 *    с динамическим колыханием формы (контрольные точки bezier)
 * 🔥 40 мелких частиц-капель — взлетают вверх, меняя цвет от белого до красного
 * ✨ 30 искр — золотые/оранжевые точки
 * 🌫️ 10 дымков — серые круги с blur, улетающие вверх
 * 💡 Glow-свечение через BlurFilter
 */
export class TorchFireEffect {
  private container: PIXI.Container;
  private glowContainer: PIXI.Container;
  private smokeContainer: PIXI.Container;
  private particles: Particle[] = [];
  private sparks: SparkParticle[] = [];
  private smoke: SmokeParticle[] = [];
  private _destroyed = false;
  private isMobile: boolean;

  constructor(
    private stage: PIXI.Container,
    private torches: TorchConfig[],
    private ticker: PIXI.Ticker
  ) {
    this.isMobile =
      typeof window !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    this.container = new PIXI.Container();
    this.container.zIndex = 11;
    this.glowContainer = new PIXI.Container();
    this.glowContainer.zIndex = 9;
    this.smokeContainer = new PIXI.Container();
    this.smokeContainer.zIndex = 8;

    // Порядок: smoke (внизу) → glow → flames (сверху)
    this.stage.addChild(this.smokeContainer);
    this.stage.addChild(this.glowContainer);
    this.stage.addChild(this.container);

    this.createDarkBg();
    this.createGlow();
    this.createFlameLayers();
    this.createParticles();
    this.createSparks();
    this.createSmoke();
  }
  /* ===== ТЁМНАЯ ПОДЛОЖКА ===== */

  private createDarkBg(): void {
    for (const t of this.torches) {
      const bg = new PIXI.Graphics();
      bg.beginFill(0x000000, 0.25);
      bg.drawEllipse(t.x, t.y - 8, 42, 48);
      bg.endFill();
      this.container.addChild(bg);
    }
  }

  /* ===== GLOW ===== */

  private createGlow(): void {
    if (this.isMobile) return;
    for (const t of this.torches) {
      this.addGlow(t, 0xff4400, 0.5, 60, 85, 22, 28);
      this.addGlow(t, 0xffaa00, 0.25, 40, 60, 35, 45);
    }
  }

  private addGlow(t: TorchConfig, color: number, alpha: number, rx: number, ry: number, bx: number, by: number): void {
    const g = new PIXI.Graphics();
    g.beginFill(color, 1);
    g.drawEllipse(t.x, t.y - 20, rx, ry);
    g.endFill();
    const blur = new PIXI.filters.BlurFilter();
    blur.blurX = bx; blur.blurY = by; blur.quality = 2;
    g.filters = [blur]; g.alpha = alpha;
    this.glowContainer.addChild(g);
    gsap.to(g, { alpha: alpha * 0.4, duration: 0.8 + Math.random() * 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: Math.random() * 0.8 });
  }

  /* ===== ОСНОВНОЕ ПЛАМЯ (4 слоя) ===== */

  private createFlameLayers(): void {
    const layers = [
      { color: 0xff4500, h: 130, w: 75, a: 0.25, sp: 0.8, n: 3 },
      { color: 0xff6600, h: 105, w: 58, a: 0.45, sp: 1.0, n: 2 },
      { color: 0xffaa00, h: 78, w: 40, a: 0.65, sp: 1.2, n: 2 },
      { color: 0xfff8dc, h: 45, w: 22, a: 0.9, sp: 1.5, n: 1 },
    ];

    for (const t of this.torches) {
      for (const L of layers) {
        for (let j = 0; j < L.n; j++) {
          const g = new PIXI.Graphics();
          const h = L.h * (0.7 + Math.random() * 0.6);
          const w = L.w * (0.7 + Math.random() * 0.6);
          const ox = t.x + (j - (L.n - 1) / 2) * (L.w * 0.4);
          const alfa = L.a * (0.7 + Math.random() * 0.3);
          const spd = L.sp * (0.8 + Math.random() * 0.4);
          const ph = Math.random() * Math.PI * 2;

          // Рисуем с уникальной фазой для колыхания
          this.drawFlame(g, w, h, L.color, ph);
          g.x = ox; g.y = t.y; g.alpha = alfa;
          this.container.addChild(g);
          if (this.isMobile) g.cacheAsBitmap = true;

          const hp = { v: h };

          // SWAY
          gsap.to(g, { x: ox + 8 + Math.random() * 6, duration: 1.8 / spd, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: ph });
          // FLICKER (от 30% до 100% — как в оригинале)
          gsap.to(g, { alpha: alfa * 0.3, duration: 0.8 / spd, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: ph + 0.3 });
          // PULSE + динамическая форма
          gsap.to(hp, {
            v: h * 1.14,
            duration: 1.2 / spd,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            delay: ph + 0.6,
            onUpdate: () => {
              if (this._destroyed) return;
              // При каждом кадре меняем контрольные точки — форма "дышит"
              const pw = w * (1 + 0.07 * Math.sin(Date.now() * 0.003 * spd + ph));
              this.drawFlame(g, pw, hp.v, L.color, ph);
            },
          });
        }
      }
    }
  }

  /** Рисует каплю пламени с динамическим колыханием формы */
  private drawFlame(g: PIXI.Graphics, w: number, h: number, color: number, phase: number): void {
    g.clear();
    const hw = w / 2;
    const now = Date.now() * 0.002;

    // Контрольные точки "дышат" — меняются со временем
    const wobble1 = 1 + 0.15 * Math.sin(now * 0.7 + phase);
    const wobble2 = 1 + 0.15 * Math.sin(now * 0.9 + phase + 1.2);

    g.beginFill(color);
    g.moveTo(0, -h);
    g.bezierCurveTo(
      hw * 1.2 * wobble1, -h * 0.7,
      hw * wobble2, -h * 0.35,
      hw, -h * 0.1
    );
    g.arc(0, 0, hw, 0, Math.PI);
    g.bezierCurveTo(
      -hw, -h * 0.35,
      -hw * 1.2 * wobble2, -h * 0.7,
      0, -h
    );
    g.endFill();

    // Внутренний блик
    if (color === 0xffaa00 || color === 0xfff8dc) {
      const ic = color === 0xfff8dc ? 0xffffff : 0xffdd44;
      g.beginFill(ic, 0.35);
      g.moveTo(0, -h * 0.75);
      g.bezierCurveTo(hw * 0.5, -h * 0.5, hw * 0.35, -h * 0.15, hw * 0.35, 0);
      g.arc(0, 0, hw * 0.35, 0, Math.PI);
      g.bezierCurveTo(-hw * 0.35, -h * 0.15, -hw * 0.5, -h * 0.5, 0, -h * 0.75);
      g.endFill();
    }
  }
/* ===== МЕЛКИЕ ЧАСТИЦЫ-КАПЛИ (40 шт) ===== */

  private createParticles(): void {
    const colors = [0xfff8dc, 0xffeedd, 0xffaa00, 0xff6600, 0xff4500];
    for (const t of this.torches) {
      for (let i = 0; i < 40; i++) {
        const g = new PIXI.Graphics();
        const r = 3 + Math.random() * 6;
        const ph = Math.random() * Math.PI * 2;
        const spd = 0.3 + Math.random() * 0.8;
        const totalRise = 50 + Math.random() * 80;
        const ox = t.x + (Math.random() - 0.5) * 35;

        // Маленькая капля
        g.beginFill(colors[0]);
        g.moveTo(0, -r * 2.5);
        g.bezierCurveTo(r * 0.8, -r * 1.5, r, -r * 0.5, r * 0.8, 0);
        g.arc(0, 0, r * 0.8, 0, Math.PI);
        g.bezierCurveTo(-r * 0.8, -r * 0.5, -r * 0.8, -r * 1.5, 0, -r * 2.5);
        g.endFill();
        g.alpha = 0;
        g.x = ox; g.y = t.y;
        this.container.addChild(g);

        const tl = gsap.timeline({ repeat: -1, delay: i * 0.08 + Math.random() * 0.3 });
        tl.set(g, { alpha: 0, y: t.y, x: ox });
        tl.to(g, { alpha: 0.5 + Math.random() * 0.5, scaleX: 1.2, scaleY: 1.2, duration: 0.12, ease: 'power2.out' });
        tl.to(g, {
          y: t.y - totalRise,
          duration: 0.6 / spd,
          ease: 'sine.out',
          onUpdate: () => {
            const progress = (t.y - g.y) / totalRise;
            if (progress < 0) return;
            const ci = Math.min(Math.floor(progress * colors.length), colors.length - 1);
            const c = colors[ci];
            g.clear();
            const rr = r * (1 - progress * 0.3);
            g.beginFill(c);
            g.moveTo(0, -rr * 2.5);
            g.bezierCurveTo(rr * 0.8, -rr * 1.5, rr, -rr * 0.5, rr * 0.8, 0);
            g.arc(0, 0, rr * 0.8, 0, Math.PI);
            g.bezierCurveTo(-rr * 0.8, -rr * 0.5, -rr * 0.8, -rr * 1.5, 0, -rr * 2.5);
            g.endFill();
            g.x = ox + Math.sin(Date.now() * 0.005 + i * 0.7) * 8 * progress;
          },
        });
        tl.to(g, { alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 0.3, ease: 'power2.in' });
        tl.set(g, { alpha: 0, y: t.y, x: ox, scaleX: 1, scaleY: 1 });

        this.particles.push({ graphic: g, tween: tl });
      }
    }
  }

  /* ===== ИСКРЫ (30 шт) ===== */

  private createSparks(): void {
    const sparkColors = [0xffd700, 0xffaa00, 0xff6600, 0xff4500];
    for (const t of this.torches) {
      for (let i = 0; i < 30; i++) {
        const g = new PIXI.Graphics();
        const sz = 1 + Math.random() * 2.5;
        g.beginFill(sparkColors[Math.floor(Math.random() * sparkColors.length)]);
        g.drawCircle(0, 0, sz);
        g.endFill();
        g.alpha = 0;
        const ox = t.x + (Math.random() - 0.5) * 20;
        g.x = ox; g.y = t.y;
        this.container.addChild(g);
        if (this.isMobile) g.cacheAsBitmap = true;

        const tl = gsap.timeline({ repeat: -1, delay: i * 0.04 + Math.random() * 0.5 });
        tl.set(g, { alpha: 0, y: t.y, x: ox });
        tl.to(g, { alpha: 0.9, duration: 0.04, ease: 'power2.out' });
        tl.to(g, {
          y: t.y - 20 - Math.random() * 70,
          x: ox + (Math.random() - 0.5) * 50,
          alpha: 0,
          duration: 0.5 + Math.random() * 1.2,
          ease: 'power1.out',
        });
        tl.to(g, { alpha: 0, duration: 0.2 });
        this.sparks.push({ graphic: g, tween: tl });
      }
    }
  }

  /* ===== ДЫМОК (10 шт) ===== */

  private createSmoke(): void {
    if (this.isMobile) return;
    for (const t of this.torches) {
      for (let i = 0; i < 10; i++) {
        const g = new PIXI.Graphics();
        const sz = 10 + Math.random() * 20;
        g.beginFill(0x888888, 1);
        g.drawCircle(0, 0, sz);
        g.endFill();

        const blur = new PIXI.filters.BlurFilter();
        blur.blurX = 8; blur.blurY = 10; blur.quality = 2;
        g.filters = [blur];
        g.alpha = 0;
        g.x = t.x + (Math.random() - 0.5) * 15;
        g.y = t.y - 40 - Math.random() * 20;
        this.smokeContainer.addChild(g);

        const tl = gsap.timeline({ repeat: -1, delay: i * 0.6 + Math.random() * 0.8 });
        tl.set(g, { alpha: 0, y: t.y - 40, x: t.x + (Math.random() - 0.5) * 15 });
        tl.to(g, { alpha: 0.15 + Math.random() * 0.1, duration: 0.6, ease: 'power2.out' });
        tl.to(g, {
          y: g.y - 100 - Math.random() * 80,
          x: g.x + (Math.random() - 0.5) * 40,
          alpha: 0,
          duration: 1.5 + Math.random() * 1.5,
          ease: 'power1.out',
        });
        tl.to(g, { alpha: 0, duration: 0.3 });
        this.smoke.push({ graphic: g, tween: tl });
      }
    }
  }

  /* ===== УНИЧТОЖЕНИЕ ===== */

  destroy(): void {
    this._destroyed = true;
    // GSAP сам убивает все твины при kill(), но мы всё равно проходимся
    for (const p of this.particles) p.tween.kill();
    for (const s of this.sparks) s.tween.kill();
    for (const s of this.smoke) s.tween.kill();
    // GSAP-твины на glow-объектах сами останавливаются при destroy контейнера
    if (this.glowContainer) this.glowContainer.destroy({ children: true });
    if (this.smokeContainer) this.smokeContainer.destroy({ children: true });
    this.container.destroy({ children: true });
  }
}
    
