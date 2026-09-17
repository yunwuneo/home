export type PlaceId = 'home' | 'market' | 'cinema' | 'office' | 'cafe' | 'park';
export type ActivityKind =
  | 'cook'
  | 'eat'
  | 'tea'
  | 'tv'
  | 'rest'
  | 'water'
  | 'read'
  | 'wash'
  | 'shop'
  | 'movie'
  | 'work'
  | 'coffee'
  | 'stroll';
export type Message = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  source: string;
  day: number;
  minute: number;
  replyTo?: { id: string; content: string; role: string };
  memoryIds?: string[];
  memoryExcluded?: boolean;
  topicId?: string;
  attachments?: { id: string; name: string; mime: string; size: number }[];
  memoryUsed?: {
    id: string;
    text: string;
    score?: number;
    method?: string;
    sourceMessageIds?: string[];
  }[];
  toolTrace?: { server: string; name: string; result: string }[];
};
export type Memory = {
  id: string;
  day: number;
  minute: number;
  title: string;
  text: string;
  kind: string;
  pinned?: boolean;
  source?: string;
  updatedDay?: number;
};
export type State = {
  topics?: {
    id: string;
    title: string;
    model?: { providerId: string; model: string };
    mcpIds?: string[];
  }[];
  location: PlaceId;
  day: number;
  minute: number;
  speed: number;
  playerName: string;
  echoPosition: [number, number];
  playerPosition: [number, number];
  activity: null | {
    kind: ActivityKind;
    together: boolean;
    progress: number;
    duration: number;
    stage: string;
  };
  hunger: number;
  energy: number;
  meals: number;
  mood: string;
  relationship: string;
  messages: Message[];
  memories: Memory[];
  preferences: string[];
  configured: boolean;
  completed: string[];
  chatBusy?: boolean;
  game: Game | null;
  gameStats: Record<string, { played: number; wins: number; best: number }>;
  companion: {
    pending: { kind: string; label: string; line: string; choices: string[] } | null;
    lastLine: string;
  } | null;
};
export type Settings = {
  streaming?: boolean;
  canPair: boolean;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  playerName: string;
  configured: boolean;
};
export type View = 'home' | 'journal' | 'routine' | 'together';
export type Recipe = {
  base: 'jasmine' | 'matcha' | 'black';
  sweetness: number;
  ice: number;
  strength: number;
};
type GameBase = {
  id: string;
  kind: string;
  status: 'playing' | 'finished' | 'abandoned';
  revision: number;
  difficulty: 'gentle' | 'thoughtful';
  line: string;
  result: 'win' | 'loss' | 'draw' | null;
};
export type ChessGame = GameBase & {
  kind: 'chess';
  fen: string;
  board: ({ square: string; color: string; type: string } | null)[];
  legal: { from: string; to: string; promotion?: string }[];
  moves: string[];
  check: boolean;
};
export type PairsGame = GameBase & {
  kind: 'pairs';
  cards: (number | null)[];
  matched: number[];
  revealed: number[];
  turn: 'player' | 'echo';
  scores: { player: number; echo: number };
  rounds: number;
};
export type DrinksGame = GameBase & {
  kind: 'drinks';
  round: number;
  attempts: number;
  best: number;
  scores: number[];
  served: boolean;
  order: { name: string; wish: string };
  feedback: { score: number; tips: string[]; recipe: Recipe } | null;
};
export type Game = ChessGame | PairsGame | DrinksGame;
