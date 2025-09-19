// TypeScript types for Wails bindings and data structures

export interface Seeds {
  Server: string;
  Client: string;
}

export interface ScanRequest {
  Game: string;
  Seeds: Seeds;
  NonceStart: number;
  NonceEnd: number;
  Params: Record<string, any>;
  TargetOp: 'ge' | 'gt' | 'eq' | 'le' | 'lt';
  TargetVal: number;
  Tolerance: number;
  Limit: number;
  TimeoutMs: number;
}

export interface Hit {
  Nonce: number;
  Metric: number;
}

export interface HitWithDelta extends Hit {
  DeltaNonce?: number;
}

export interface Summary {
  TotalEvaluated: number;
  HitCount: number;
  Min?: number;
  Max?: number;
  Sum?: number;
}

export interface ScanResult {
  RunID: number;
  Hits: Hit[];
  Summary: Summary;
  EngineVersion: string;
  Echo: ScanRequest;
  TimedOut: boolean;
  ServerSeedHash: string;
}

export interface GameInfo {
  ID: string;
  Name: string;
  MetricLabel: string;
}

export interface Run {
  ID: number;
  CreatedAt: string;
  Game: string;
  EngineVersion: string;
  ServerSeedHash: string;
  ClientSeed: string;
  NonceStart: number;
  NonceEnd: number;
  ParamsJSON: string;
  TargetOp: string;
  TargetVal: number;
  Tolerance: number;
  HitLimit: number;
  TimedOut: boolean;
  TotalEvaluated: number;
  SummaryMin?: number;
  SummaryMax?: number;
  SummarySum?: number;
  SummaryCount: number;
}

export interface HitsPage {
  Hits: HitWithDelta[];
  Total: number;
  Page: number;
  PerPage: number;
  HasNext: boolean;
}

export interface RunsQuery {
  Page?: number;
  PerPage?: number;
  Game?: string;
}

export interface RunsList {
  Runs: Run[];
  Total: number;
  Page: number;
  PerPage: number;
  HasNext: boolean;
}

export interface AppError {
  Code: string;
  Message: string;
  Field?: string;
  Details?: any;
}