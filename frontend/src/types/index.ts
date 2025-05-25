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
