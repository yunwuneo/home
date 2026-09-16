import { randomUUID } from 'node:crypto';
import { ACTIVITIES } from '../shared/world.mjs';
import { PLACES, OUTINGS } from '../shared/places.mjs';
import { addMemory, learnFromChat } from './memory.mjs';
import { conversationReply } from './companion.mjs';
import { publicGame } from './games.mjs';

export function initialState() {
  return {
    version: 1,
    location: 'home',
    day: 1,
    minute: 16 * 60 + 20,
    speed: 1,
    playerName: '你',
    echoPosition: [0, 1.15],
    playerPosition: [0.2, 2.75],
    activity: null,
    hunger: 70,
    energy: 85,
    warmth: 0,
    meals: 1,
    mood: '有一点期待',
    lastAuto: 0,
    elapsed: 0,
    completed: [],
    messages: [
      {
        id: randomUUID(),
        role: 'assistant',
        content:
          '你来啦！我刚把家里收拾好。还不太习惯两个人一起住，不过……我有点期待。要不要一起做点什么？',
        day: 1,
        minute: 980,
        source: 'life',
      },
    ],
    memories: [
      {
        id: randomUUID(),
        day: 1,
        minute: 980,
        title: '初次见面',
        text: '搬进同一个小家。故事从一句“你来啦”开始。',
        kind: 'milestone',
      },
    ],
    preferences: [],
  };
}
export function message(s, role, content, source = 'life') {
  s.messages.push({ id: randomUUID(), role, content, source, day: s.day, minute: s.minute });
  s.messages = s.messages.slice(-500);
  return s.messages.at(-1);
}
export function remember(s, title, text, kind = 'daily') {
  addMemory(s, { title, text, kind, source: 'life' });
}
export function startActivity(s, kind, together = true) {
  if (s.game?.status === 'playing') throw new Error('先结束游戏，再一起活动吧。');
  const a = ACTIVITIES[kind];
  if (!a) throw new Error('没有找到这项活动。');
  if ((a.place || 'home') !== (s.location || 'home'))
    throw new Error('先到对应的地点，再一起做这件事吧。');
  if (kind === 'eat' && s.meals < 1) throw new Error('还没有准备好的料理，先一起做饭吧。');
  if (s.activity?.together) throw new Error('我们还在一起活动，结束后再做这件事吧。');
  s.activity = { kind, together, progress: 0, duration: a.duration, stage: 'walking' };
  s.echoPosition = a.echo;
  if (together) s.playerPosition = a.player;
  s.mood = together ? (s.warmth > 8 ? '和你在一起很开心' : '悄悄有些开心') : '专心做自己的事';
  message(
    s,
    'assistant',
    together
      ? a.line
      : `我想去${a.verb}。${kind === 'cook' ? '做好了叫你来吃。' : '你也可以过来陪我呀。'}`,
  );
  s.lastAuto = s.elapsed;
}
export function travel(s, location) {
  if (s.game?.status === 'playing') throw new Error('先结束这一局，再一起出门吧。');
  if (!Object.hasOwn(PLACES, location)) throw new Error('没有找到这个地点。');
  if ((s.location || 'home') === location) return;
  const place = PLACES[location];
  s.location = location;
  s.activity = null;
  s.echoPosition = [...place.echo];
  s.playerPosition = [...place.player];
  s.lastAuto = s.elapsed;
  s.mood = location === 'home' ? '回家真好' : '和你一起出门';
  message(
    s,
    'assistant',
    location === 'home'
      ? '到家啦。把外面的热闹留在门外，慢慢歇一会儿。'
      : `到${place.name}啦。${place.subtitle}，想和你一起。`,
  );
}
export function advance(s, seconds) {
  if (s.game?.status === 'playing') return false;
  if (!s.speed) return false;
  const delta = Math.min(seconds, 5) * s.speed;
  s.elapsed += delta;
  s.minute += delta;
  if (s.minute >= 1440) {
    s.day += Math.floor(s.minute / 1440);
    s.minute %= 1440;
  }
  s.hunger = Math.max(0, s.hunger - delta * 0.035);
  s.energy = Math.max(0, s.energy - delta * 0.023);
  if (s.activity) {
    s.activity.progress += delta;
    s.activity.stage = s.activity.progress < 7 ? 'walking' : 'doing';
    if (s.activity.progress >= s.activity.duration) {
      const { kind, together } = s.activity,
        a = ACTIVITIES[kind];
      if (kind === 'cook') s.meals = Math.min(6, s.meals + 1);
      if (kind === 'eat') {
        s.meals = Math.max(0, s.meals - 1);
        s.hunger = Math.min(100, s.hunger + 45);
      }
      if (kind === 'rest') s.energy = Math.min(100, s.energy + 45);
      if (kind === 'tea') s.energy = Math.min(100, s.energy + 8);
      if (kind === 'shop') s.meals = Math.min(6, s.meals + 2);
      if (kind === 'coffee') {
        s.energy = Math.min(100, s.energy + 18);
        s.hunger = Math.min(100, s.hunger + 12);
      }
      if (kind === 'stroll' || kind === 'movie') s.energy = Math.min(100, s.energy + 10);
      if (together) {
        const novel = !s.completed.includes(kind);
        s.warmth += novel ? 3 : 0.35;
        if (novel) s.completed.push(kind);
        remember(s, a.label, a.memory);
        const endings = {
          cook: '做好啦！闻起来不错吧？趁热一起吃。',
          eat: '吃饱啦。两个人一起吃饭，连收拾碗筷都觉得开心。',
          tea: '茶喝完了，可是还有好多话想慢慢说给你听。',
          tv: '刚才那一段，我们居然一起笑了！下次换你来挑电影。',
          rest: '唔，精神好多了。醒来看到你还在，心里暖暖的。',
          water: '浇好水啦。等它再长高一点，我们一起给它换个花盆。',
          read: '这句话先夹在书里，下次我们接着读。',
          wash: '收拾好啦！整整齐齐的，看着就心情好。',
        };
        message(s, 'assistant', OUTINGS[kind]?.ending || endings[kind]);
      }
      s.mood = together ? '心里暖暖的' : '悠然自得';
      s.activity = null;
      s.lastAuto = s.elapsed;
    }
  } else if (s.elapsed - s.lastAuto > 42) {
    if (s.location && s.location !== 'home') {
      startActivity(s, PLACES[s.location].activities[0], false);
      return true;
    }
    const h = s.minute / 60;
    const alternate = Math.floor(s.elapsed / 42) % 2;
    const kind =
      s.energy < 30 || h >= 23 || h < 7
        ? 'rest'
        : s.hunger < 45
          ? s.meals > 0
            ? 'eat'
            : 'cook'
          : h < 9
            ? alternate
              ? 'wash'
              : s.meals
                ? 'eat'
                : 'cook'
            : h < 12
              ? alternate
                ? 'water'
                : 'read'
              : h < 14
                ? s.meals > 0
                  ? 'eat'
                  : 'cook'
                : h < 17
                  ? alternate
                    ? 'read'
                    : 'tea'
                  : h < 19
                    ? s.meals < 3
                      ? 'cook'
                      : 'tea'
                    : alternate
                      ? 'tv'
                      : 'tea';
    startActivity(s, kind, false);
  }
  return true;
}
export function publicState(s, configured) {
  const { warmth, lastAuto, elapsed, game, chatRequests, conversation, companion, ...rest } = s;
  return {
    ...rest,
    game: publicGame(game),
    gameStats: s.gameStats || {},
    companion: companion ? { pending: companion.pending, lastLine: companion.lastLine } : null,
    location: s.location || 'home',
    configured,
    relationship: warmth < 6 ? '开始熟悉彼此' : warmth < 15 ? '慢慢靠近' : '心照不宣的陪伴',
  };
}
export function localReply(s, text, learned = learnFromChat(s, text)) {
  const reply = conversationReply(s, text, learned);
  if (reply) return reply;
  if (/记得|喜欢什么/.test(text) && s.preferences.length)
    return `当然记得，你${s.preferences.slice(-3).join('，还')}。和你有关的小事，我有认真听。`;
  if (/累|难过|不开心|压力/.test(text))
    return '今天辛苦啦。你可以慢慢说，也可以先安静地坐一会儿，我在这里陪你。';
  if (/你好|早安|晚安/.test(text))
    return /晚安/.test(text)
      ? '晚安。今天能见到你，我很开心。明天再一起吃早餐吧。'
      : '见到你就忍不住想笑。今天想怎么度过呢？';
  if (/名字|叫我/.test(text)) return `好呀，${s.playerName}。这样叫你的时候，好像又熟悉了一点。`;
  if (s.location && s.location !== 'home')
    return s.activity
      ? `嗯，我在听。一起${ACTIVITIES[s.activity.kind].verb}的时候，也想听听你今天的心情。`
      : `在${PLACES[s.location].name}和你待一会儿，感觉很好。要不要${ACTIVITIES[PLACES[s.location].activities[0]].verb}？`;
  if (/家|住/.test(text))
    return '我最喜欢窗边那一小块阳光。以后这里会慢慢留下我们一起生活的痕迹吧。';
  if (/做饭|吃|饿/.test(text))
    return s.meals
      ? '家里还有准备好的料理，一起坐下来吃吧？'
      : '那就一起做点好吃的吧！厨房里还有新鲜的食材。';
  return s.activity
    ? `嗯，我在听。等我们${ACTIVITIES[s.activity.kind].verb}的时候，你可以再多和我说一点。`
    : [
        '想听你说说，今天有没有一件让你觉得开心的小事？',
        '窗外的光刚好照进来了。和你这样待一会儿，感觉很好。',
        '我们还在慢慢认识彼此呢。你平时在家最喜欢做什么？',
      ][s.messages.length % 3];
}
