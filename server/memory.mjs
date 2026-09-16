import { randomUUID } from 'node:crypto';

export function normalizeMemories(s) {
  s.memories ??= [];
  s.chatRequests ??= [];
  for (const m of s.memories) {
    m.pinned ??= false;
    m.source ??= m.kind === 'preference' ? 'chat' : 'life';
    if (m.kind === 'preference' && !m.slot) {
      const taste = (m.fact || m.text).match(/(不喜欢|喜欢)([^。]+)[。]?$/);
      if (taste) {
        m.slot = `taste:${taste[2]}`;
        m.fact = `${taste[1]}${taste[2]}`;
      }
    }
  }
  syncPreferences(s);
}

export function syncPreferences(s) {
  s.preferences = s.memories
    .filter((m) => m.kind === 'preference')
    .map(
      (m) =>
        m.fact ||
        m.text.replace(new RegExp(`^${escapeRegex(s.playerName)}`), '').replace(/[。]$/, ''),
    );
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function addMemory(
  s,
  { title, text, kind = 'moment', source = 'manual', slot, fact, messageId, pinned = false },
) {
  const old = slot
    ? s.memories.find((m) => m.slot === slot)
    : ['chat', 'manual'].includes(source)
      ? s.memories.find((m) => m.text === text && m.kind === kind)
      : null;
  if (old) {
    if (old.text !== text) excludeMemory(s, old);
    old.sourceMessageIds = [
      ...new Set([...(old.sourceMessageIds || []), old.messageId, messageId].filter(Boolean)),
    ];
    Object.assign(old, { title, text, kind, source, fact, messageId, updatedDay: s.day });
    syncPreferences(s);
    return old;
  }
  const memory = {
    id: randomUUID(),
    day: s.day,
    minute: s.minute,
    title,
    text,
    kind,
    source,
    slot,
    fact,
    messageId,
    sourceMessageIds: messageId ? [messageId] : [],
    pinned,
  };
  s.memories.unshift(memory);
  syncPreferences(s);
  return memory;
}

function excludeSource(s, id) {
  const m = s.messages.find((m) => m.id === id);
  if (m) m.memoryExcluded = true;
  // The response can repeat the outdated fact as well.
  const index = s.messages.findIndex((m) => m.id === id);
  if (index >= 0 && s.messages[index + 1]?.role === 'assistant')
    s.messages[index + 1].memoryExcluded = true;
}

function excludeMemory(s, memory) {
  for (const id of new Set([...(memory.sourceMessageIds || []), memory.messageId].filter(Boolean)))
    excludeSource(s, id);
  for (const m of s.messages)
    if (
      m.memoryIds?.includes(memory.id) ||
      m.content.includes(memory.fact || memory.text.replace(/[。]$/, ''))
    )
      excludeSource(s, m.id);
}

export function changeMemory(s, input) {
  const m = s.memories.find((m) => m.id === input.id);
  if (!m) throw new Error('这条记忆已经不在手记里了。');
  if (input.operation === 'forget') {
    excludeMemory(s, m);
    s.memories = s.memories.filter((item) => item.id !== m.id);
  } else if (input.operation === 'pin') m.pinned = !m.pinned;
  else {
    excludeMemory(s, m);
    m.text = input.text;
    m.title = input.title || m.title;
    m.fact = undefined;
    if (m.kind === 'preference') {
      const taste = m.text.match(/(不喜欢|喜欢)([^。]+)[。]?$/);
      m.slot = taste ? `taste:${taste[2]}` : undefined;
      m.fact = taste ? `${taste[1]}${taste[2]}` : undefined;
    } else if (m.kind === 'profile') {
      const profile = m.text.match(/^我(?:的)?(生日是|叫|住在|的工作是|职业是|希望你叫我)/);
      m.slot = profile ? `profile:${profile[1]}` : undefined;
    }
    m.source = 'manual';
    m.updatedDay = s.day;
  }
  syncPreferences(s);
}

// Only explicit first-person statements become facts. Questions and model prose do not.
export function learnFromChat(s, text, messageId) {
  const learned = [];
  for (const sentence of text
    .split(/[。！!\n；;]/)
    .map((v) => v.trim())
    .filter(Boolean)) {
    if (/[？?]|什么|吗$|是否|是不是|如果|假如|例如|比如|可能|也许/.test(sentence)) continue;
    let match, data;
    if (
      (match = sentence.match(
        /^(?:其实|现在|以后)?我(?:现在|以后|已经|最)?(不喜欢|讨厌|喜欢|爱吃|爱喝)([^，,]{1,45})$/,
      ))
    ) {
      const object = match[2].replace(/了$/, '').trim();
      if (/^(?:你[呀啊呢]?|echo)$/i.test(object)) continue;
      const negative = ['不喜欢', '讨厌'].includes(match[1]);
      const fact = `${negative ? '不喜欢' : '喜欢'}${object}`;
      data = {
        title: '关于你的小事',
        kind: 'preference',
        slot: `taste:${object}`,
        fact,
        text: `${s.playerName}${fact}。`,
      };
    } else if (
      (match = sentence.match(/^我(?:的)?(生日是|叫|住在|的工作是|职业是|希望你叫我)(.{1,60})$/))
    ) {
      data = {
        title: '关于你的生活',
        kind: 'profile',
        slot: `profile:${match[1]}`,
        text: sentence,
      };
    } else if ((match = sentence.match(/^我对(.{1,40})过敏$/))) {
      data = {
        title: '需要留意的事',
        kind: 'boundary',
        slot: `allergy:${match[1]}`,
        text: sentence,
      };
    } else if (/^(?:(?:请)?(?:不要|别)(?:再)?(?:叫我|提起|催我|碰我)|我不吃)/.test(sentence)) {
      data = { title: '你的边界', kind: 'boundary', text: sentence };
    } else if ((match = sentence.match(/^(?:请)?记住[：:，,]?(.{1,160})$/))) {
      data = { title: '你希望我记住的事', kind: 'profile', text: match[1] };
    } else if (/^我们(?:约好|说好|下次|明天|周末)/.test(sentence)) {
      data = { title: '我们的约定', kind: 'promise', text: sentence };
    }
    if (data) learned.push(addMemory(s, { ...data, source: 'chat', messageId }));
  }
  return learned;
}

export function relevantMemories(s, query = '', limit = 14) {
  const words = [
    ...new Set([
      ...(query.toLowerCase().match(/[a-z0-9]+/g) || []),
      ...(query.match(/[\u4e00-\u9fff]+/g) || []).flatMap((text) =>
        Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => text.slice(i, i + 2)),
      ),
    ]),
  ].filter((word) => !['什么', '记得', '还记', '我们', '我的', '你的'].includes(word));
  return s.memories
    .map((m, index) => {
      const content = `${m.title} ${m.text}`.toLowerCase();
      const overlap = words.reduce((n, word) => n + (content.includes(word) ? 12 : 0), 0);
      const topic = /玩|棋|赢|输|翻牌|调饮/.test(query) && m.kind === 'game' ? 12 : 0;
      const preference = /喜欢|讨厌|口味/.test(query) && m.kind === 'preference' ? 10 : 0;
      return {
        m,
        score:
          overlap +
          topic +
          preference +
          (m.pinned ? 8 : 0) +
          (m.kind === 'boundary' ? 10 : 0) +
          4 / (index + 1),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ m }) => m);
}

export function memoryContext(s, query) {
  return (
    relevantMemories(s, query)
      .map((m) => `[${m.id}] 第${m.day}天 / ${m.kind} / ${m.title}: ${m.text}`)
      .join('\n') || '还没有记录。'
  );
}
