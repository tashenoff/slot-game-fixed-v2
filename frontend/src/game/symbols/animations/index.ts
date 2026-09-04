import { SymbolAnimationConfig } from '../symbolVisual';
import { SymbolAnimContext, SymbolAnimationFactory, SymbolAnimationInstance } from './types';
import { createShineAnimation } from './shine';
import { createDimAnimation } from './dim';

const FACTORIES: Record<string, SymbolAnimationFactory> = {
  shine: createShineAnimation,
  dim: createDimAnimation,
};

export function createSymbolAnimations(ctxBase: Omit<SymbolAnimContext, 'config'>, configs?: SymbolAnimationConfig[]): SymbolAnimationInstance[] {
  if (!configs || configs.length === 0) return [];
  const instances: SymbolAnimationInstance[] = [];
  for (const config of configs) {
    const factory = FACTORIES[config.type];
    if (!factory) continue;
    const inst = factory({ ...ctxBase, config });
    if (inst) instances.push(inst);
  }
  return instances;
}

export function destroySymbolAnimations(list: SymbolAnimationInstance[]): void {
  list.forEach(a => a.destroy());
}

export type { SymbolAnimationInstance, SymbolAnimContext };
