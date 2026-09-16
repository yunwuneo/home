import { randomInt, randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import { addMemory } from './memory.mjs';

export const GAME_NAMES = { chess: '窗边棋桌', pairs: '心动翻牌', drinks: '两人的调饮台' };
const drinkOrders = [
  {
    name: '雨后的茉莉',
    base: 'jasmine',
    sweetness: 25,
    ice: 75,
    strength: 50,
    wish: '茉莉茶，微甜，多冰，茶香适中。',
  },
  {
    name: '午后的抹茶',
    base: 'matcha',
    sweetness: 50,
    ice: 25,
    strength: 75,
    wish: '抹茶，半糖，少冰，浓一点。',
  },
  {
    name: '夜晚的红茶',
    base: 'black',
    sweetness: 0,
    ice: 0,
    strength: 50,
    wish: '红茶，不加糖，不加冰，茶香适中。',
  },
  {
    name: '夏末的茉莉',
    base: 'jasmine',
    sweetness: 50,
    ice: 100,
    strength: 25,
    wish: '茉莉茶，半糖，满冰，清淡一点。',
  },
  {
    name: '温柔的抹茶',
    base: 'matcha',
    sweetness: 25,
    ice: 0,
    strength: 50,
    wish: '抹茶，微甜，不加冰，茶香适中。',
  },
];
function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function say(s, line) {
  s.messages.push({
    id: randomUUID(),
    role: 'assistant',
    content: line,
    source: 'game',
    day: s.day,
    minute: s.minute,
  });
  s.messages = s.messages.slice(-500);
}
function chessBoard(game) {
  const board = new Chess();
  for (const move of game.moves) board.move(move);
  return board;
}
export function startGame(s, kind, difficulty = 'gentle') {
  if (s.game?.status === 'playing') throw new Error('先完成或结束当前这一局吧。');
  if (s.activity?.together) throw new Error('先结束共同活动，再到游戏桌来吧。');
  if (!GAME_NAMES[kind]) throw new Error('没有找到这款游戏。');
  s.activity = null;
  s.game = {
    id: randomUUID(),
    kind,
    difficulty,
    status: 'playing',
    revision: 0,
    startedDay: s.day,
    line: '',
    result: null,
  };
  const g = s.game;
  if (kind === 'chess')
    Object.assign(g, { moves: [], line: '你执白先走。我把茶放在旁边，这一局认真陪你。' });
  if (kind === 'pairs')
    Object.assign(g, {
      deck: shuffle(Array.from({ length: 16 }, (_, i) => i % 8)),
      matched: [],
      revealed: [],
      known: {},
      turn: 'player',
      scores: { player: 0, echo: 0 },
      rounds: 0,
      line: '你先翻。我会记住看过的牌，可不会偷看背面哦。',
    });
  if (kind === 'drinks') {
    const orders = shuffle(drinkOrders)
      .slice(0, 3)
      .map((o) => ({ ...o }));
    const taste = s.memories.find(
      (m) => m.kind === 'preference' && /不喜欢.*甜|少糖|无糖/.test(m.text),
    );
    if (taste)
      orders[0] = {
        ...orders[0],
        sweetness: 0,
        wish: orders[0].wish.replace(/微甜|半糖/, '不加糖'),
        name: '记得你的口味',
      };
    Object.assign(g, {
      orders,
      round: 0,
      attempts: 0,
      scores: [],
      best: 0,
      feedback: null,
      served: false,
      line: taste
        ? '我记得你不喜欢太甜，第一杯就一起试试无糖的吧。'
        : '今天一人尝一口。让我点三杯，你来决定最后的味道。',
    });
  }
  s.mood = '期待和你认真玩一会儿';
  s.lastAuto = s.elapsed;
  say(s, `一起玩${GAME_NAMES[kind]}吧。${g.line}`);
}
function finish(s, result, summary) {
  const g = s.game;
  g.status = 'finished';
  g.result = result;
  g.line = summary;
  s.gameStats ??= {};
  const stats = (s.gameStats[g.kind] ??= { played: 0, wins: 0, best: 0 });
  stats.played++;
  if (result === 'win') stats.wins++;
  stats.best = Math.max(
    stats.best,
    g.kind === 'drinks'
      ? Math.round(g.scores.reduce((a, b) => a + b, 0) / 3)
      : g.kind === 'pairs'
        ? g.scores.player
        : 0,
  );
  const key = `game:${g.kind}`;
  const novel = !s.completed.includes(key);
  s.warmth += novel ? 2 : 0.2;
  if (novel) s.completed.push(key);
  addMemory(s, {
    title: GAME_NAMES[g.kind],
    text: summary,
    kind: 'game',
    source: 'game',
    slot: undefined,
  });
  say(s, summary);
  s.mood = result === 'win' ? '笑着说下次还要挑战你' : '享受和你较量的时光';
  s.lastAuto = s.elapsed;
}
function chessEnding(s, board) {
  if (!board.isGameOver()) return false;
  const result = board.isCheckmate() ? (board.turn() === 'b' ? 'win' : 'loss') : 'draw';
  const line =
    result === 'win'
      ? '这局棋是你赢啦。（托着下巴笑）最后那一步很漂亮，下次我会留意的。'
      : result === 'loss'
        ? '这局棋我赢了一点点。别急，想复盘最后几步，还是再陪我来一盘？'
        : '这局棋握手言和。棋盘上势均力敌，窗边的时间倒是过得很快。';
  finish(s, result, line);
  return true;
}
const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function evaluate(board) {
  if (board.isCheckmate()) return board.turn() === 'w' ? 100000 : -100000;
  if (board.isDraw()) return 0;
  return board
    .board()
    .flat()
    .filter(Boolean)
    .reduce((sum, p) => sum + (p.color === 'b' ? 1 : -1) * values[p.type], 0);
}
function echoMove(board, difficulty) {
  const moves = shuffle(board.moves({ verbose: true }));
  if (difficulty === 'gentle') {
    return moves.sort(
      (a, b) =>
        Number(b.san.includes('#')) - Number(a.san.includes('#')) ||
        (values[b.captured] || 0) - (values[a.captured] || 0),
    )[0];
  }
  let best = -Infinity,
    chosen = moves[0];
  for (const move of moves) {
    board.move(move);
    let score = evaluate(board);
    if (!board.isGameOver()) {
      score = Infinity;
      for (const reply of board.moves()) {
        board.move(reply);
        score = Math.min(score, evaluate(board));
        board.undo();
      }
    }
    board.undo();
    if (score > best) {
      best = score;
      chosen = move;
    }
  }
  return chosen;
}

export function gameAction(s, input) {
  const g = s.game;
  if (!g || g.id !== input.id || g.revision !== input.revision)
    throw new Error('棋桌有了新变化，已同步最新进度，请再试一次。');
  if (g.status !== 'playing') throw new Error('这一局已经结束了。');
  if (input.action === 'end') {
    g.status = 'abandoned';
    g.line = '先把这一局放下吧。等你想玩，我们再开始。';
    g.revision++;
    s.lastAuto = s.elapsed;
    return;
  }
  if (g.kind === 'chess') {
    if (input.action === 'resign') {
      finish(s, 'loss', '你把这一局棋让给了 Echo。她笑着收好棋子，说下次再一起挑战。');
    } else {
      if (input.action !== 'move') throw new Error('请选择要走的棋子。');
      const board = chessBoard(g);
      let move;
      try {
        move = board.move({ from: input.from, to: input.to, promotion: input.promotion || 'q' });
      } catch {
        throw new Error('这一步不符合棋规，换一个高亮的落点吧。');
      }
      g.moves.push(move.san);
      if (!chessEnding(s, board)) {
        const reply = board.move(echoMove(board, g.difficulty));
        g.moves.push(reply.san);
        g.line = board.isCheck()
          ? '将军。先照顾好你的王，我在等你下一步。'
          : reply.captured
            ? '这个棋子我就先收下啦。轮到你了。'
            : [
                '让我想想……好，就这样。轮到你啦。',
                '你刚才那一步，我有认真看。',
                '越下越有意思了，下一步你会怎么走？',
              ][g.moves.length % 3];
        chessEnding(s, board);
      }
    }
  } else if (g.kind === 'pairs') {
    if (input.action === 'flip') {
      if (
        g.turn !== 'player' ||
        g.revealed.length === 2 ||
        !Number.isInteger(input.index) ||
        input.index < 0 ||
        input.index >= 16 ||
        g.matched.includes(input.index) ||
        g.revealed.includes(input.index)
      )
        throw new Error('这张牌现在不能翻开。');
      g.revealed.push(input.index);
      g.known[input.index] = g.deck[input.index];
      if (g.revealed.length === 2) resolvePair(s);
    } else if (input.action === 'continue') {
      if (g.revealed.length !== 2) throw new Error('先翻开两张牌吧。');
      g.revealed = [];
      if (g.turn === 'echo') {
        const available = Array.from({ length: 16 }, (_, i) => i).filter(
          (i) => !g.matched.includes(i),
        );
        let pair;
        for (const a of available)
          for (const b of available)
            if (a !== b && g.known[a] !== undefined && g.known[a] === g.known[b]) pair = [a, b];
        const first =
          pair?.[0] ??
          shuffle(
            available.filter((i) => g.known[i] === undefined).length
              ? available.filter((i) => g.known[i] === undefined)
              : available,
          )[0];
        g.known[first] = g.deck[first];
        const second =
          pair?.[1] ??
          available.find((i) => i !== first && g.known[i] === g.deck[first]) ??
          shuffle(available.filter((i) => i !== first))[0];
        g.revealed = [first, second];
        g.known[second] = g.deck[second];
        resolvePair(s);
      }
    } else throw new Error('没有找到这个翻牌动作。');
  } else if (g.kind === 'drinks') {
    if (input.action === 'serve') {
      if (g.served) throw new Error('这一杯已经完成，开始下一杯吧。');
      const recipe = input.recipe;
      if (
        !recipe ||
        !['jasmine', 'matcha', 'black'].includes(recipe.base) ||
        !['sweetness', 'ice', 'strength'].every(
          (key) => Number.isInteger(recipe[key]) && recipe[key] >= 0 && recipe[key] <= 100,
        )
      )
        throw new Error('调饮配方不完整。');
      const order = g.orders[g.round];
      const labels = { sweetness: '甜度', ice: '冰量', strength: '茶香' };
      const tips = Object.keys(labels)
        .filter((key) => Math.abs(recipe[key] - order[key]) > 10)
        .map((key) => `${labels[key]}${recipe[key] > order[key] ? '再少一点' : '再多一点'}`);
      if (recipe.base !== order.base) tips.unshift('茶底不太对');
      const score = Math.max(
        0,
        Math.round(
          100 -
            (recipe.base !== order.base ? 40 : 0) -
            ['sweetness', 'ice', 'strength'].reduce(
              (sum, key) => sum + Math.abs(recipe[key] - order[key]) / 3,
              0,
            ),
        ),
      );
      g.attempts++;
      g.best = Math.max(g.best, score);
      g.feedback = { score, tips, recipe };
      g.served = score >= 85 || g.attempts >= 3;
      g.line =
        score >= 85
          ? '（捧起杯子尝了一口）就是这个味道。你真的有把我的话放在心上。'
          : `唔，已经有感觉了。${tips.join('，')}。`;
      if (g.served) g.scores.push(g.best);
    } else if (input.action === 'next') {
      if (!g.served) throw new Error('先完成这一杯吧。');
      if (g.round === 2) {
        const total = Math.round(g.scores.reduce((a, b) => a + b, 0) / 3);
        finish(
          s,
          total >= 85 ? 'win' : 'draw',
          `一起完成了三杯特调，平均 ${total} 分。Echo 最喜欢的是一起试味道的过程，还约好下次换她给你调一杯。`,
        );
      } else {
        g.round++;
        g.attempts = 0;
        g.best = 0;
        g.feedback = null;
        g.served = false;
        g.line = '下一杯，换一种心情。';
      }
    } else throw new Error('没有找到这个调饮动作。');
  }
  g.revision++;
}
function resolvePair(s) {
  const g = s.game;
  const matched = g.deck[g.revealed[0]] === g.deck[g.revealed[1]];
  const actor = g.turn;
  g.rounds++;
  if (matched) {
    g.matched.push(...g.revealed);
    g.scores[actor]++;
  } else g.turn = actor === 'player' ? 'echo' : 'player';
  g.line =
    actor === 'player'
      ? matched
        ? '一对！你的记性真好，继续吧。'
        : '差一点。现在让我来找一找。'
      : matched
        ? '这两张我记得。再让我试一次。'
        : '唔，记错了。轮到你啦。';
  if (g.matched.length === 16) {
    const result =
      g.scores.player === g.scores.echo ? 'draw' : g.scores.player > g.scores.echo ? 'win' : 'loss';
    finish(
      s,
      result,
      `心动翻牌结束，你 ${g.scores.player} 对，Echo ${g.scores.echo} 对。${result === 'win' ? '她笑着认输，又说下次要挑战你。' : result === 'draw' ? '你们默契地打成了平手。' : '她小小得意了一下，又把牌递给你，期待下一局。'}`,
    );
  }
}
export function publicGame(g) {
  if (!g) return null;
  const { deck, known, orders, ...view } = g;
  if (g.kind === 'chess') {
    const board = chessBoard(g);
    return {
      ...view,
      fen: board.fen(),
      board: board
        .board()
        .flat()
        .map((p) => (p ? { square: p.square, type: p.type, color: p.color } : null)),
      legal:
        g.status === 'playing'
          ? board
              .moves({ verbose: true })
              .map(({ from, to, promotion }) => ({ from, to, promotion }))
          : [],
      check: board.isCheck(),
    };
  }
  if (g.kind === 'pairs')
    return {
      ...view,
      cards: deck.map((value, i) =>
        g.matched.includes(i) || g.revealed.includes(i) ? value : null,
      ),
    };
  return { ...view, order: { name: orders[g.round].name, wish: orders[g.round].wish } };
}
