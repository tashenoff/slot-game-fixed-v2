import * as PIXI from 'pixi.js';
import gsap from 'gsap';

/**
 * Мягкий дым из дула: размытые полупрозрачные клубы,
 * медленно тают влево-вверх с лёгким покачиванием.
 */
export class RevolverSmokeEffect {
  private container: PIXI.Container;
  private smokePuffs: { graphic: PIXI.Graphics; tween: gsap.core.Timeline }[] = [];
  private ticker: PIXI.Ticker;
  private onTick: () => void;
  private _destroyed = false;

  constructor(stage: PIXI.Container, x: number, y: number, ticker: PIXI.Ticker) {
    this.ticker = ticker;
    this.container = new PIXI.Container();
    this.container.x = x;
    this.container.y = y;
    this.container.zIndex = 15;
    stage.addChild(this.container);
    this.createSmokePuffs();
    this.onTick = () => this.update();
    ticker.add(this.onTick);
  }

  private makeCloud(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const base = 9 + Math.random() * 8;
    const blobs = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < blobs; b++) {
      const ox = (Math.random() - 0.5) * base * 1.4;
      const oy = (Math.random() - 0.5) * base * 0.9;
      const r = base * (0.55 + Math.random() * 0.7);
      const shade = 0x6e6e6e + Math.floor(Math.random() * 0x14) * 0x010101;
      g.beginFill(shade, 0.48 + Math.random() * 0.16);
      g.drawCircle(ox, oy, r);
      g.endFill();
    }
    const blur = new PIXI.filters.BlurFilter();
    blur.blur = 5 + Math.random() * 4;
    blur.quality = 2;
    g.filters = [blur];
    g.alpha = 0;
    return g;
  }

  private createSmokePuffs(): void {
    for (let i = 0; i < 18; i++) {
      const cloud = this.makeCloud();
      this.container.addChild(cloud);

      const startX = (Math.random() - 0.5) * 8;
      const startY = (Math.random() - 0.5) * 5;
      const driftX = -(28 + Math.random() * 55);
      const driftY = -(18 + Math.random() * 42);
      const wobble = 8 + Math.random() * 12;
      const peakAlpha = 0.32 + Math.random() * 0.14;
      const life = 2.4 + Math.random() * 1.6;

      const tl = gsap.timeline({
        repeat: -1,
        delay: i * 0.22 + Math.random() * 0.5,
      });

      tl.set(cloud, { x: startX, y: startY, alpha: 0, rotation: 0 });
      tl.set(cloud.scale, { x: 0.35, y: 0.35 });

      tl.to(cloud, { alpha: peakAlpha, duration: 0.55 + Math.random() * 0.25, ease: 'sine.out' });
      tl.to(cloud.scale, { x: 0.85, y: 0.9, duration: 0.55, ease: 'sine.out' }, '<');

      tl.to(cloud, {
        x: startX + driftX * 0.45 + wobble,
        y: startY + driftY * 0.4,
        rotation: (Math.random() - 0.5) * 0.35,
        alpha: peakAlpha * 0.65,
        duration: life * 0.4,
        ease: 'sine.inOut',
      });
      tl.to(cloud.scale, { x: 1.35, y: 1.45, duration: life * 0.4, ease: 'sine.inOut' }, '<');

      tl.to(cloud, {
        x: startX + driftX,
        y: startY + driftY,
        rotation: (Math.random() - 0.5) * 0.5,
        alpha: 0,
        duration: life * 0.55,
        ease: 'power1.out',
      });
      tl.to(cloud.scale, { x: 2.1, y: 2.3, duration: life * 0.55, ease: 'power1.out' }, '<');

      this.smokePuffs.push({ graphic: cloud, tween: tl });
    }
  }

  private update(): void {}

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.ticker.remove(this.onTick);
    for (const puff of this.smokePuffs) puff.tween.kill();
    this.container.destroy({ children: true });
  }
}

