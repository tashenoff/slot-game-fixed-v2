import * as PIXI from 'pixi.js';
import { SymbolAnimationConfig } from '../symbolVisual';

export interface SymbolAnimContext {
  /** Корневой спрайт символа (фон / целый символ) */
  root: PIXI.Sprite;
  /** Слой content, если есть */
  content: PIXI.Sprite | null;
  config: SymbolAnimationConfig;
}

export interface SymbolAnimationInstance {
  readonly type: string;
  start(): void;
  stop(): void;
  destroy(): void;
}

export type SymbolAnimationFactory = (ctx: SymbolAnimContext) => SymbolAnimationInstance | null;
