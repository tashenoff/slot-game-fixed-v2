export interface Symbol {
  id: string;
  name: string;
  weight: number;
  payout: Record<string, number>;
}

export interface PaylinePosition {
  row: number;
  col: number;
}

export interface Win {
  line: number;
  symbol: string;
  count: number;
  win: number;
}

export interface SpinResult {
  matrix: string[][];
  wins: Win[];
  win_amount: number;
  balance: number;
  // Поля фриспинов
  is_free_spin: boolean;
  free_spins_triggered: number;
  free_spins_remaining: number;
  free_spins_multiplier: number;
  scatter_count?: number;
  // Поля бонусной игры Dice Ladder
  bonus_triggered?: boolean;
  bonus_symbol_count?: number;
  bonus_levels?: DiceLevel[];
}

// ===== БОНУСНАЯ ИГРА DICE LADDER =====

/** Грани кубика: coin 🪙 / diamond 💎 / fire 🔥 / skull 💀 */
export type DiceFace = 'coin' | 'diamond' | 'fire' | 'skull';

/** Ступень бонусной лестницы */
export interface DiceLevel {
  level: number;
  multiplier: number;
}

/** Результат броска кубика */
export interface DiceRollResult {
  face: DiceFace;
  new_level: number;
  win_amount: number;
  game_over: boolean;
  reached_top: boolean;
  balance: number;
  levels: DiceLevel[];
  multiplier: number;
}

/** Результат забора выигрыша */
export interface DiceCashoutResult {
  win_amount: number;
  balance: number;
  level: number;
  multiplier: number;
}

export interface Stats {
  total_bet: number;
  total_win: number;
  spins: number;
  symbol_frequency: Record<string, number>;
  win_frequency: number;
  biggest_win: number;
  rtp: number;
  balance: number;
}
