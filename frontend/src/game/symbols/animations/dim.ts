import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { SYMBOL_DIM_CHILD, SymbolDimAnimation } from '../symbolVisual';
import { SymbolAnimContext, SymbolAnimationInstance } from './types';

export function createDimAnimation(ctx: SymbolAnimContext): SymbolAnimationInstance | null {
  const cfg = ctx.config as SymbolDimAnimation;
  const host = cfg.target === 'content' ? ctx.content : ctx.root;
  if (!host) return null;

  const existing = host.getChildByName(SYMBOL_DIM_CHILD);
  if (existing) {
    host.removeChild(existing);
    existing.destroy({ children: true });
  }

  const dimAlpha = cfg.alpha ?? 0.55;
  const duration = cfg.duration ?? 0.35;
  const w = host.texture.width || host.width;
  const h = host.texture.height || host.height;

  const overlay = new PIXI.Container();
  overlay.name = SYMBOL_DIM_CHILD;
  overlay.visible = false;
  overlay.alpha = 0;

  const veil = new PIXI.Graphics();
  veil.beginFill(0x000000, 1);
  veil.drawRect(-w / 2, -h / 2, w, h);
  veil.endFill();
  overlay.addChild(veil);

  const mask = new PIXI.Sprite(host.texture);
  mask.anchor.set(0.5);
  mask.width = w;
  mask.height = h;
  overlay.addChild(mask);
  overlay.mask = mask;

  // Затемнение под content, но поверх текстуры bg
  host.addChildAt(overlay, 0);

  return {
    type: 'dim',
    start() {
      overlay.visible = true;
      gsap.killTweensOf(overlay);
      gsap.to(overlay, { alpha: dimAlpha, duration, ease: 'power2.out' });
    },
    stop() {
      gsap.killTweensOf(overlay);
      overlay.alpha = 0;
      overlay.visible = false;
    },
    destroy() {
      gsap.killTweensOf(overlay);
      if (overlay.parent) overlay.parent.removeChild(overlay);
      overlay.destroy({ children: true });
    },
  };
}
