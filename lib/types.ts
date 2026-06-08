export type Wheel = {
  id: string;
  title: string;
  published: boolean;
  submissions_open: boolean;
  submit_deadline: string | null;
  total_submissions: number;
  last_winner_item_id: string | null;
  last_spun_at: string | null;
  created_at: string;
};

export type Item = {
  id: string;
  wheel_id: string;
  label: string;
  color: string;
  submitter_name: string | null;
  created_at: string;
};

export type Claim = {
  id: string;
  wheel_id: string;
  item_id: string;
  name: string;
  email: string;
  phone_e164: string;
  country: string | null;
  created_at: string;
};

/** Broadcast payload for a synced spin. winnerItemId is stable across clients;
 *  each client looks up its own index so slice order differences don't matter. */
export type SpinSignal = {
  winnerItemId: string;
  extraTurns: number;
  durationMs: number;
  nonce: number;
};
