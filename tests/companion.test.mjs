import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  publicState,
  advance,
  localReply,
  message,
  startActivity,
  travel,
} from '../server/simulation.mjs';
import {
  learnFromChat,
  changeMemory,
  addMemory,
  normalizeMemories,
  relevantMemories,
} from '../server/memory.mjs';
import { startGame, gameAction } from '../server/games.mjs';
import { interact } from '../server/companion.mjs';
import { echoPrompt } from '../server/provider.mjs';
import { openStore } from '../server/store.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function act(s, body) {
  gameAction(s, { id: s.game.id, revision: s.game.revision, ...body });
}

test('global memory learns explicit facts, updates contradictions, and never learns hypothetical facts', () => {
  const s = initialState();
  normalizeMemories(s);
  const first = message(s, 'user', '我喜欢抹茶。');
  learnFromChat(s, first.content, first.id);
  message(s, 'assistant', '记得你喜欢抹茶。');
  const duplicate = message(s, 'user', '我喜欢抹茶。');
  learnFromChat(s, duplicate.content, duplicate.id);
  learnFromChat(s, '我现在不喜欢抹茶了。');
  assert.deepEqual(s.preferences, ['不喜欢抹茶']);
  assert.equal(s.memories.filter((m) => m.kind === 'preference').length, 1);
  assert.equal(s.messages.find((m) => m.id === first.id).memoryExcluded, true);
  assert.equal(s.messages.find((m) => m.id === duplicate.id).memoryExcluded, true);
  learnFromChat(s, '我喜欢咖啡吗？如果我喜欢奶茶。');
  assert.equal(s.preferences.length, 1);
  learnFromChat(s, '我的生日是9月16日。我住在上海。我对花生过敏。我们周末一起看电影。');
  assert.ok(s.memories.some((m) => m.kind === 'profile' && m.text.includes('生日')));
  assert.ok(s.memories.some((m) => m.kind === 'boundary' && m.text.includes('花生')));
  assert.ok(s.memories.some((m) => m.kind === 'promise'));
  assert.match(echoPrompt(s, '生日'), /9月16日/);
  assert.match(localReply(s, '还记得我的生日吗'), /9月16日/);
  localReply(s, '我喜欢你');
  assert.ok(!s.preferences.includes('喜欢你'));
});

test('editing and forgetting remove outdated source messages from future context; pins survive migration', () => {
  const s = initialState();
  normalizeMemories(s);
  const m = message(s, 'user', '我的生日是9月16日');
  const [fact] = learnFromChat(s, m.content, m.id);
  const echo = message(s, 'assistant', '我记得你的生日是9月16日');
  echo.memoryIds = [fact.id];
  changeMemory(s, { operation: 'pin', id: fact.id });
  changeMemory(s, { operation: 'edit', id: fact.id, text: '我的生日是9月17日' });
  assert.equal(m.memoryExcluded, true);
  assert.equal(echo.memoryExcluded, true);
  assert.match(echoPrompt(s, '生日'), /9月17日/);
  assert.doesNotMatch(echoPrompt(s, '生日'), /9月16日/);
  normalizeMemories(s);
  assert.equal(fact.pinned, true);
  changeMemory(s, { operation: 'forget', id: fact.id });
  assert.doesNotMatch(echoPrompt(s, '生日'), /9月17日/);
  assert.throws(() => changeMemory(s, { operation: 'forget', id: fact.id }));
  const old = initialState();
  old.memories.push({
    id: 'legacy',
    kind: 'preference',
    title: '关于你的小事',
    text: '你喜欢抹茶。',
    day: 1,
    minute: 0,
  });
  old.playerName = '小林';
  normalizeMemories(old);
  learnFromChat(old, '我不喜欢抹茶。');
  assert.deepEqual(old.preferences, ['不喜欢抹茶']);
  changeMemory(old, { operation: 'edit', id: 'legacy', text: '我喜欢咖啡。' });
  learnFromChat(old, '我不喜欢抹茶');
  assert.deepEqual(new Set(old.preferences), new Set(['喜欢咖啡', '不喜欢抹茶']));
});

test('relevant memories survive many unrelated days, while games and moments become conversational context', () => {
  const s = initialState();
  normalizeMemories(s);
  learnFromChat(s, '我的生日是9月16日');
  for (let i = 0; i < 200; i++)
    addMemory(s, { title: '日常', text: `第${i}次喝茶`, kind: 'daily', source: 'life' });
  assert.ok(relevantMemories(s, '我的生日是什么时候？').some((m) => m.text.includes('9月16日')));
  for (let i = 0; i < 20; i++)
    addMemory(s, { title: '置顶的日常', text: `第${i}次散步`, pinned: true });
  assert.ok(relevantMemories(s, '还记得生日吗').some((m) => m.text.includes('9月16日')));
  interact(s, 'hug');
  assert.throws(() => interact(s, 'hand'));
  assert.throws(() => interact(s, 'answer', '不存在的回答'));
  interact(s, 'answer', '只是想抱抱你');
  assert.equal(s.companion.pending, null);
  assert.ok(s.memories.some((m) => m.kind === 'moment'));
  const warmth = s.warmth;
  interact(s, 'hug');
  assert.equal(s.warmth, warmth, 'repeated gestures do not farm daily relationship rewards');
});

test('chess enforces moves, gives Echo a real turn, rejects stale actions and persists a resumable board', () => {
  const s = initialState();
  startGame(s, 'chess', 'thoughtful');
  assert.equal(publicState(s, false).game.legal.length, 20);
  const before = structuredClone(s);
  assert.throws(() => act(s, { action: 'move', from: 'e2', to: 'e5' }));
  assert.deepEqual(s, before);
  const oldRevision = s.game.revision;
  act(s, { action: 'move', from: 'e2', to: 'e4' });
  assert.equal(s.game.moves.length, 2);
  assert.equal(publicState(s, false).game.fen.split(' ')[1], 'w');
  assert.throws(() => gameAction(s, { id: s.game.id, revision: oldRevision, action: 'resign' }));
  assert.throws(() => startActivity(s, 'tea'));
  assert.throws(() => travel(s, 'cafe'));
  assert.equal(advance(s, 5), false);
  const directory = mkdtempSync(join(tmpdir(), 'echo-game-test-'));
  try {
    let store = openStore(directory);
    store.saveState(s);
    store.close();
    store = openStore(directory);
    assert.deepEqual(publicState(store.state, false).game, publicState(s, false).game);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  act(s, { action: 'resign' });
  assert.equal(s.game.status, 'finished');
  assert.equal(s.gameStats.chess.played, 1);
  assert.match(localReply(s, '刚才谁赢了棋？'), /Echo/);
  assert.throws(() => act(s, { action: 'resign' }));
});

test('chess recognizes real checkmate, promotion and a draw without fabricated scores', () => {
  const s = initialState();
  startGame(s, 'chess');
  s.game.moves = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6'];
  act(s, { action: 'move', from: 'h5', to: 'f7' });
  assert.equal(s.game.result, 'win');
  assert.equal(s.gameStats.chess.wins, 1);
  const draw = initialState();
  startGame(draw, 'chess');
  draw.game.moves = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];
  act(draw, { action: 'move', from: 'g1', to: 'f3' });
  assert.equal(draw.game.result, 'draw');
  const promotion = initialState();
  startGame(promotion, 'chess');
  promotion.game.moves = ['a4', 'h5', 'a5', 'h4', 'a6', 'h3', 'axb7', 'hxg2'];
  act(promotion, { action: 'move', from: 'b7', to: 'a8', promotion: 'n' });
  assert.match(promotion.game.moves[8], /bxa8=N/);
});

test('pairs hides unturned cards and Echo only remembers cards actually exposed', () => {
  const s = initialState();
  startGame(s, 'pairs');
  const publicGame = publicState(s, false).game;
  assert.ok(publicGame.cards.every((v) => v === null));
  assert.equal('deck' in publicGame, false);
  assert.equal('known' in publicGame, false);
  const mismatch = s.game.deck.findIndex((v) => v !== s.game.deck[0]);
  act(s, { action: 'flip', index: 0 });
  assert.throws(() => act(s, { action: 'flip', index: 0 }));
  act(s, { action: 'flip', index: mismatch });
  assert.equal(s.game.turn, 'echo');
  assert.equal(Object.keys(s.game.known).length, 2);
  act(s, { action: 'continue' });
  assert.equal(s.game.revealed.length, 2);
  assert.ok(Object.keys(s.game.known).length <= 4);
  assert.throws(() => act(s, { action: 'flip', index: 15 }));
});

test('pairs can be completed with real scoring, replay and no duplicate rewards', () => {
  const s = initialState();
  startGame(s, 'pairs');
  for (let value = 0; value < 8; value++) {
    const indices = s.game.deck.flatMap((v, i) => (v === value ? [i] : []));
    for (const index of indices) act(s, { action: 'flip', index });
    if (value < 7) act(s, { action: 'continue' });
  }
  assert.equal(s.game.status, 'finished');
  assert.equal(s.game.result, 'win');
  assert.equal(s.game.scores.player, 8);
  assert.equal(s.gameStats.pairs.played, 1);
  assert.match(echoPrompt(s, '上次的翻牌'), /你 8 对/);
  assert.throws(() => act(s, { action: 'continue' }));
  startGame(s, 'pairs');
  assert.equal(s.game.matched.length, 0);
  act(s, { action: 'end' });
  assert.equal(s.gameStats.pairs.played, 1);
});

test('drinks has three playable rounds, useful feedback and preference-aware orders', () => {
  const s = initialState();
  learnFromChat(s, '我不喜欢太甜');
  startGame(s, 'drinks');
  assert.match(s.game.orders[0].wish, /不加糖/);
  assert.equal('orders' in publicState(s, false).game, false);
  for (let round = 0; round < 3; round++) {
    assert.throws(() => act(s, { action: 'next' }));
    const order = s.game.orders[round];
    act(s, {
      action: 'serve',
      recipe: {
        ...order,
        sweetness: order.sweetness === 100 ? 0 : 100,
        base: order.base === 'black' ? 'matcha' : 'black',
      },
    });
    assert.ok(s.game.feedback.tips.length);
    assert.equal(s.game.served, false);
    act(s, { action: 'serve', recipe: order });
    assert.equal(s.game.feedback.score, 100);
    assert.throws(() => act(s, { action: 'serve', recipe: order }));
    act(s, { action: 'next' });
  }
  assert.equal(s.game.status, 'finished');
  assert.equal(s.gameStats.drinks.best, 100);
  assert.ok(s.memories.some((m) => m.kind === 'game' && m.text.includes('100')));
});
