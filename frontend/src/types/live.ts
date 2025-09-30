export type LiveBetDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type LiveBet = {
  id: number;
  nonce: number;
  date_time?: string;
  amount: number;
  payout: number;
  difficulty: LiveBetDifficulty;
  round_target?: number;
  round_result: number;
};

export type LiveBetPage = {
  total: number | null;
  rows: LiveBet[];
};
