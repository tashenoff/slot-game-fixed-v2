import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { SYMBOL_SHINE_CHILD, SymbolShineAnimation } from '../symbolVisual';
import { SymbolAnimContext, SymbolAnimationInstance } from './types';

function parseColor(color?: number | string): number {
  if (color === undefined) return 0xffffff;
  if (typeof color === 'number') return color;
  return parseInt(color.replace('#', ''), 16);
}

function drawBand(g: PIXI.Graphics, width: number, height: number, bandW: number, angle: number, color: number, alpha: number) {
  g.clear();
  const angleRad = (angle * Math.PI) / 180;
  const tan = Math.tan(angleRad);
  const extra = Math.abs(width * tan);
  const totalH = height + extra * 2;
  const offsetY = -height / 2 - extra / 2;
  const layers = [
    { widthMult: 1.0, alpha: alpha * 0.25 },
    { widthMult: 0.55, alpha: alpha * 0.5 },
    { widthMult: 0.25, alpha: alpha * 0.85 },
  ];
  for (const layer of layers) {
    const hw = (bandW * layer.widthMult) / 2;
    const x1 = -hw;
    const x2 = hw;
    const y1 = offsetY;
    const y2 = offsetY + totalH;
    const skew = totalH * tan;
    g.beginFill(color, layer.alpha);
    g.moveTo(x1, y1);
    g.lineTo(x2, y1);
    g.lineTo(x2 + skew, y2);
    g.lineTo(x1 + skew, y2);
    g.closePath();
    g.endFill();
  }
}

export function createShineAnimation(ctx: SymbolAnimContext): SymbolAnimationInstance | null {
  const cfg = ctx.config as SymbolShineAnimation;
  const host = cfg.target === 'content' ? ctx.content : ctx.root;
  if (!host) return null;

  const existing = host.getChildByName(SYMBOL_SHINE_CHILD);
  if (existing) {
    host.removeChild(existing);
    existing.destroy({ children: true });
  }

  const color = parseColor(cfg.color);
  const alpha = cfg.alpha ?? 0.7;
  const duration = cfg.duration ?? 1.4;
  const pause = cfg.pause ?? 1.2;
  const bandW = cfg.width ?? 70;
  const angle = cfg.angle ?? -25;

  const w = host.texture.width || host.width;
  const h = host.texture.height || host.height;

  const overlay = new PIXI.Container();
  overlay.name = SYMBOL_SHINE_CHILD;

  const band = new PIXI.Graphics();
  drawBand(band, w, h, bandW, angle, color, alpha);
  overlay.addChild(band);

  const mask = new PIXI.Sprite(host.texture);
  mask.anchor.set(0.5);
  mask.width = w;
  mask.height = h;
  overlay.addChild(mask);
  overlay.mask = mask;

  host.addChild(overlay);
  overlay.visible = false;

  const travel = w + bandW * 2;
  const state = { x: -travel / 2 };
  band.x = state.x;

  const tween = gsap.to(state, {
    x: travel / 2,
    duration,
    ease: 'none',
    repeat: -1,
    repeatDelay: pause,
    paused: true,
    onUpdate: () => { band.x = state.x; },
  });

  return {
    type: 'shine',
    start() {
      overlay.visible = true;
      state.x = -travel / 2;
      band.x = state.x;
      tween.restart();
    },
    stop() {
      tween.pause();
      overlay.visible = false;
      state.x = -travel / 2;
      band.x = state.x;
    },
    destroy() {
      tween.kill();
      if (overlay.parent) overlay.parent.removeChild(overlay);
      overlay.destroy({ children: true });
    },
  };
}
