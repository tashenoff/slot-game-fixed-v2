/**
 * Описание визуала символа — отдельно от игровой логики (веса, выплаты, ленты).
 */

export interface SymbolLayerConfig {
  bg: string;
  content: string;
  /** Масштаб content относительно ячейки (1 = как фон). По умолчанию 1.08 */
  contentScale?: number;
}

/** Слой, на который вешается анимация */
export type SymbolAnimTarget = 'bg' | 'content';

export interface SymbolShineAnimation {
  type: 'shine';
  target: SymbolAnimTarget;
  color?: number | string;
  alpha?: number;
  duration?: number;
  pause?: number;
  width?: number;
  angle?: number;
}

export interface SymbolDimAnimation {
  type: 'dim';
  target: SymbolAnimTarget;
  /** Итоговая непрозрачность затемнения (0–1). По умолчанию 0.55 */
  alpha?: number;
  duration?: number;
}

export type SymbolAnimationConfig = SymbolShineAnimation | SymbolDimAnimation;

export interface SymbolVisualConfig {
  layers?: SymbolLayerConfig;
  animated?: string;
  animations?: SymbolAnimationConfig[];
}

export type ThemeSymbolVisuals = Record<string, SymbolVisualConfig>;

export const SYMBOL_CONTENT_CHILD = 'symbol-content';
export const SYMBOL_SHINE_CHILD = 'symbol-shine';
export const SYMBOL_DIM_CHILD = 'symbol-dim';
export const DEFAULT_CONTENT_SCALE = 1.08;

