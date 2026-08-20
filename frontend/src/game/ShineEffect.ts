import * as PIXI from 'pixi.js';

/**
 * ShineEffect - эффект блика для выигрышных символов
 * Блик виден только на самом символе (использует спрайт как маску)
 */
export class ShineEffect {
  private container: PIXI.Container;
  private shineGraphics: PIXI.Graphics;
  private maskSprite: PIXI.Sprite | null = null;
  private targetSprite: PIXI.Sprite | null = null;
  private ticker: PIXI.Ticker;
  private tickerCallback: (() => void) | null = null;
  
  private isAnimating: boolean = false;
  private progress: number = 0;
  private speed: number = 0.012;
  private looping: boolean = true;
  private pauseBetweenLoops: number = 0;
  private pauseCounter: number = 0;
  
  private targetWidth: number = 0;
  private targetHeight: number = 0;
  
  private shineWidth: number = 80;
  private shineAngle: number = -30;
  private shineColor: number = 0xffffff;
  private shineAlpha: number = 0.8;

  constructor(ticker: PIXI.Ticker) {
    this.ticker = ticker;
    this.container = new PIXI.Container();
    this.shineGraphics = new PIXI.Graphics();
    this.container.addChild(this.shineGraphics);
    this.container.visible = false;
  }

  getContainer(): PIXI.Container { return this.container; }

  setOptions(options: {
    width?: number; angle?: number; color?: number;
    alpha?: number; speed?: number; looping?: boolean; pauseBetweenLoops?: number;
  }) {
    if (options.width !== undefined) this.shineWidth = options.width;
    if (options.angle !== undefined) this.shineAngle = options.angle;
    if (options.color !== undefined) this.shineColor = options.color;
    if (options.alpha !== undefined) this.shineAlpha = options.alpha;
    if (options.speed !== undefined) this.speed = options.speed;
    if (options.looping !== undefined) this.looping = options.looping;
    if (options.pauseBetweenLoops !== undefined) this.pauseBetweenLoops = options.pauseBetweenLoops;
  }

  playOn(sprite: PIXI.Sprite) {
    this.stop();
    this.targetSprite = sprite;
    this.targetWidth = sprite.width;
    this.targetHeight = sprite.height;
    
    // Создаём копию спрайта для использования как маски
    this.maskSprite = new PIXI.Sprite(sprite.texture);
    this.maskSprite.anchor.copyFrom(sprite.anchor);
    this.maskSprite.width = sprite.width;
    this.maskSprite.height = sprite.height;
    this.maskSprite.x = sprite.x;
    this.maskSprite.y = sprite.y;
    
    // Позиционируем контейнер блика
    this.container.x = sprite.x;
    this.container.y = sprite.y;

    if (sprite.parent) {
      sprite.parent.addChild(this.maskSprite);
      sprite.parent.addChild(this.container);
    }
    
    // Используем копию спрайта как маску для блика
    this.container.mask = this.maskSprite;

    this.progress = 0;
    this.pauseCounter = 0;
    this.container.visible = true;
    this.isAnimating = true;
    this.startAnimation();
  }

  private startAnimation() {
    if (this.tickerCallback) this.ticker.remove(this.tickerCallback);
    this.tickerCallback = () => this.update();
    this.ticker.add(this.tickerCallback);
  }

  private update() {
    if (!this.isAnimating) return;
    if (this.pauseCounter > 0) { this.pauseCounter--; return; }
    this.progress += this.speed;
    if (this.progress >= 1) {
      if (this.looping) { this.progress = 0; this.pauseCounter = this.pauseBetweenLoops; }
      else { this.stop(); return; }
    }
    this.drawShine();
  }

  private drawShine() {
    this.shineGraphics.clear();
    const totalDistance = this.targetWidth + this.shineWidth * 2;
    const currentX = -this.shineWidth + totalDistance * this.progress;
    const angleRad = (this.shineAngle * Math.PI) / 180;
    const tan = Math.tan(angleRad);
    const extraHeight = Math.abs(this.targetWidth * tan);
    const totalHeight = this.targetHeight + extraHeight * 2;
    const offsetY = -this.targetHeight / 2 - extraHeight / 2;

    // Градиентный блик из нескольких слоёв
    const layers = [
      { widthMult: 1.0, alpha: this.shineAlpha * 0.2 },
      { widthMult: 0.6, alpha: this.shineAlpha * 0.4 },
      { widthMult: 0.3, alpha: this.shineAlpha * 0.7 },
      { widthMult: 0.1, alpha: this.shineAlpha * 1.0 },
    ];

    for (const layer of layers) {
      const layerWidth = this.shineWidth * layer.widthMult;
      const halfWidth = layerWidth / 2;
      const x1 = currentX - halfWidth - this.targetWidth / 2;
      const x2 = currentX + halfWidth - this.targetWidth / 2;
      const y1 = offsetY;
      const y2 = offsetY + totalHeight;
      const skew = totalHeight * tan;

      this.shineGraphics.beginFill(this.shineColor, layer.alpha);
      this.shineGraphics.moveTo(x1, y1);
      this.shineGraphics.lineTo(x2, y1);
      this.shineGraphics.lineTo(x2 + skew, y2);
      this.shineGraphics.lineTo(x1 + skew, y2);
      this.shineGraphics.closePath();
      this.shineGraphics.endFill();
    }
  }

  stop() {
    this.isAnimating = false;
    this.container.visible = false;
    this.container.mask = null;
    if (this.tickerCallback) { this.ticker.remove(this.tickerCallback); this.tickerCallback = null; }
    this.shineGraphics.clear();
    if (this.maskSprite) {
      if (this.maskSprite.parent) this.maskSprite.parent.removeChild(this.maskSprite);
      this.maskSprite.destroy();
      this.maskSprite = null;
    }
    this.targetSprite = null;
  }

  destroy() {
    this.stop();
    this.container.destroy({ children: true });
  }
}

/** ShineEffectManager - менеджер для управления множеством эффектов блика */
export class ShineEffectManager {
  private effects: ShineEffect[] = [];
  private activeEffects: Map<PIXI.Sprite, ShineEffect> = new Map();
  private ticker: PIXI.Ticker;

  constructor(ticker: PIXI.Ticker, poolSize: number = 15) {
    this.ticker = ticker;
    for (let i = 0; i < poolSize; i++) {
      const effect = new ShineEffect(ticker);
      effect.setOptions({
        width: 70, angle: -25, alpha: 0.7, speed: 0.012,
        looping: true, pauseBetweenLoops: 60
      });
      this.effects.push(effect);
    }
  }

  playOnSprite(sprite: PIXI.Sprite, options?: { delay?: number; width?: number; speed?: number; color?: number; }) {
    if (this.activeEffects.has(sprite)) return;
    const effect = this.effects.find(e => ![...this.activeEffects.values()].includes(e));
    if (!effect) { console.warn('ShineEffectManager: no free effects'); return; }
    if (options) effect.setOptions({ width: options.width, speed: options.speed, color: options.color });

    const startEffect = () => { effect.playOn(sprite); this.activeEffects.set(sprite, effect); };
    if (options?.delay) setTimeout(startEffect, options.delay);
    else startEffect();
  }

  stopOnSprite(sprite: PIXI.Sprite) {
    const effect = this.activeEffects.get(sprite);
    if (effect) { effect.stop(); this.activeEffects.delete(sprite); }
  }

  stopAll() {
    this.activeEffects.forEach(effect => effect.stop());
    this.activeEffects.clear();
  }

  destroy() {
    this.stopAll();
    this.effects.forEach(effect => effect.destroy());
    this.effects = [];
  }
}
