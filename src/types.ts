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
};
export type Memory = {
  id: string;
  day: number;
  minute: number;
  title: string;
  text: string;
  kind: string;
};
export type State = {
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
};
export type Settings = {
  canPair: boolean;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  playerName: string;
  configured: boolean;
};
export type View = 'home' | 'journal' | 'routine';
