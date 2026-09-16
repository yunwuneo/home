import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coffee,
  Crown,
  Flower2,
  Heart,
  Leaf,
  Moon,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  Trophy,
  X,
} from 'lucide-react';
import type { ChessGame, DrinksGame, Game, PairsGame, Recipe, State } from './types';

type Action = (path: string, body: unknown) => Promise<boolean>;
type Move = (body: Record<string, unknown>) => Promise<boolean>;
const names = { chess: '窗边棋桌', pairs: '心动翻牌', drinks: '两人的调饮台' };
const symbols: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const pieceNames: Record<string, string> = { k: '王', q: '后', r: '车', b: '象', n: '马', p: '兵' };
const motifs = [Heart, Flower2, Moon, Sun, Leaf, Coffee, Star, Sparkles];
const motifNames = ['爱心', '花朵', '月亮', '太阳', '叶子', '咖啡', '星星', '闪光'];

function ChessTable({ game, busy, move }: { game: ChessGame; busy: boolean; move: Move }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [game.id, game.revision]);
  async function choose(square: string) {
    const legal = game.legal.filter((m) => m.from === selected && m.to === square);
    if (legal.length) {
      if (legal.some((m) => m.promotion)) setPromotion({ from: selected!, to: square });
      else if (await move({ action: 'move', from: selected, to: square })) setSelected(null);
    } else setSelected(game.board.find((p) => p?.square === square)?.color === 'w' ? square : null);
  }
  return (
    <div className="table-layout">
      <div className="chess-surface">
        <div className="opponent-label">
          <span className="echo-token">E</span>
          <strong>Echo</strong>
          <span>黑棋 · {game.difficulty === 'gentle' ? '轻松' : '认真'}</span>
        </div>
        <div className="chess-board" role="group" aria-label="国际象棋棋盘">
          {game.board.map((piece, i) => {
            const square = `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
            const target = game.legal.some((m) => m.from === selected && m.to === square);
            return (
              <button
                key={square}
                aria-label={`${square}${piece ? ` ${piece.color === 'w' ? '白' : '黑'}${pieceNames[piece.type]}` : ' 空位'}${target ? ' 可落子' : ''}`}
                aria-pressed={selected === square}
                className={`chess-square ${(Math.floor(i / 8) + (i % 8)) % 2 ? 'dark' : 'light'} ${selected === square ? 'selected' : ''} ${target ? 'legal' : ''}`}
                disabled={busy || game.status !== 'playing' || !!promotion}
                onClick={() => void choose(square)}
              >
                {piece && (
                  <span
                    className={`chess-piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`}
                  >
                    {symbols[piece.type]}
                  </span>
                )}
                {i % 8 === 0 && <small className="rank-label">{8 - Math.floor(i / 8)}</small>}
                {i >= 56 && <small className="file-label">{'abcdefgh'[i % 8]}</small>}
              </button>
            );
          })}
        </div>
        <div className="opponent-label">
          <span className="player-token">你</span>
          <strong>白棋</strong>
          <span>
            {game.status === 'playing' ? (game.check ? '将军 · 轮到你' : '轮到你落子') : '本局结束'}
          </span>
        </div>
        {promotion && (
          <div className="promotion-picker" role="group" aria-label="兵升变">
            <strong>升变为</strong>
            {['q', 'r', 'b', 'n'].map((p) => (
              <button
                key={p}
                className="secondary"
                disabled={busy}
                onClick={() => void move({ action: 'move', ...promotion, promotion: p })}
              >
                {symbols[p]} {pieceNames[p]}
              </button>
            ))}
            <button className="icon-button" title="取消升变" onClick={() => setPromotion(null)}>
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      <aside className="game-side">
        <h3>这一局的脚步</h3>
        <div className="chess-moves">
          {game.moves.length ? (
            Array.from({ length: Math.ceil(game.moves.length / 2) }, (_, i) => (
              <div key={i}>
                <span>{i + 1}.</span>
                <b>{game.moves[i * 2]}</b>
                <b>{game.moves[i * 2 + 1] || '…'}</b>
              </div>
            ))
          ) : (
            <p>等你走出第一步。</p>
          )}
        </div>
        <div className="game-note">
          <Crown size={18} />
          <span>你执白 · Echo 执黑</span>
        </div>
      </aside>
    </div>
  );
}

function PairsTable({ game, busy, move }: { game: PairsGame; busy: boolean; move: Move }) {
  return (
    <div className="pairs-surface">
      <div className="scoreboard">
        <div>
          <span>你</span>
          <strong>
            {game.scores.player}
            <small> 对</small>
          </strong>
        </div>
        <span className="score-separator">{game.matched.length / 2} / 8</span>
        <div>
          <span>Echo</span>
          <strong>
            {game.scores.echo}
            <small> 对</small>
          </strong>
        </div>
      </div>
      <div className="pairs-board" role="group" aria-label="翻牌桌">
        {game.cards.map((value, i) => {
          const Icon = value === null ? Flower2 : motifs[value];
          const matched = game.matched.includes(i);
          return (
            <button
              key={i}
              className={`pair-card ${value !== null ? 'face-up' : ''} ${matched ? 'matched' : ''} motif-${value ?? 'back'}`}
              aria-label={`第 ${i + 1} 张牌${value === null ? ' 未翻开' : ` ${motifNames[value]}${matched ? ' 已配对' : ''}`}`}
              disabled={
                busy ||
                game.status !== 'playing' ||
                game.turn !== 'player' ||
                value !== null ||
                game.revealed.length === 2
              }
              onClick={() => void move({ action: 'flip', index: i })}
            >
              <Icon size={30} strokeWidth={1.6} />
              <span>{value === null ? String(i + 1).padStart(2, '0') : motifNames[value]}</span>
              {matched && <Check className="pair-check" size={13} />}
            </button>
          );
        })}
      </div>
      <div className="table-next">
        <span>
          {game.status !== 'playing'
            ? '八对都找到了'
            : game.revealed.length === 1
              ? '再选一张'
              : game.turn === 'player'
                ? '轮到你翻牌'
                : '轮到 Echo'}
        </span>
        {game.status === 'playing' && game.revealed.length === 2 && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => void move({ action: 'continue' })}
          >
            {game.turn === 'echo' ? '看看 Echo 的选择' : '继续翻牌'}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function DrinksTable({ game, busy, move }: { game: DrinksGame; busy: boolean; move: Move }) {
  const [recipe, setRecipe] = useState<Recipe>({
    base: 'jasmine',
    sweetness: 50,
    ice: 50,
    strength: 50,
  });
  useEffect(() => {
    setRecipe(game.feedback?.recipe || { base: 'jasmine', sweetness: 50, ice: 50, strength: 50 });
  }, [game.id, game.round]);
  const locked = busy || game.served || game.status !== 'playing';
  return (
    <div className="drink-table">
      <div className="drink-order">
        <span className="small-label">ECHO 的点单 · {game.round + 1} / 3</span>
        <h3>{game.order.name}</h3>
        <p>{game.order.wish}</p>
      </div>
      <div className="drink-layout">
        <div
          className={`drink-still-life ${recipe.base}`}
          aria-label={`${{ jasmine: '茉莉', matcha: '抹茶', black: '红茶' }[recipe.base]}特调预览`}
          role="img"
        >
          <div className="cup-handle" />
          <div className="drink-glass">
            <div className="drink-liquid" style={{ opacity: 0.55 + recipe.strength / 225 }} />
            <div className="drink-ice">
              {Array.from({ length: Math.round(recipe.ice / 25) }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <span className="glass-mark">E + YOU</span>
          </div>
          <div className="cup-saucer" />
          <Leaf className="tea-leaf" size={40} />
        </div>
        <div className="recipe-controls">
          <fieldset disabled={locked}>
            <legend>茶底</legend>
            <div className="segmented">
              {(['jasmine', 'matcha', 'black'] as const).map((base) => (
                <button
                  key={base}
                  type="button"
                  aria-pressed={recipe.base === base}
                  className={recipe.base === base ? 'active' : ''}
                  onClick={() => setRecipe({ ...recipe, base })}
                >
                  {{ jasmine: '茉莉', matcha: '抹茶', black: '红茶' }[base]}
                </button>
              ))}
            </div>
            {(['sweetness', 'ice', 'strength'] as const).map((key) => (
              <label className="recipe-slider" key={key}>
                <span>
                  {{ sweetness: '甜度', ice: '冰量', strength: '茶香' }[key]}
                  <output>{recipe[key]}%</output>
                </span>
                <input
                  aria-label={{ sweetness: '甜度', ice: '冰量', strength: '茶香' }[key]}
                  type="range"
                  min={0}
                  max={100}
                  step={25}
                  value={recipe[key]}
                  onChange={(e) => setRecipe({ ...recipe, [key]: Number(e.target.value) })}
                />
                <span className="range-ends">
                  <small>{{ sweetness: '无糖', ice: '无冰', strength: '清淡' }[key]}</small>
                  <small>{{ sweetness: '全糖', ice: '满冰', strength: '浓郁' }[key]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {game.status === 'playing' &&
            (game.served ? (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void move({ action: 'next' })}
              >
                {game.round === 2 ? '收下今日特调' : '下一杯'}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void move({ action: 'serve', recipe })}
              >
                <Coffee size={17} />请 Echo 尝一口
              </button>
            ))}
        </div>
      </div>
      <div className="drink-feedback" role="status">
        {game.feedback ? (
          <>
            <strong>
              {game.feedback.score}
              <small> 分</small>
            </strong>
            <span>
              {game.feedback.tips.length ? game.feedback.tips.join(' · ') : '刚刚好的味道'}
            </span>
          </>
        ) : (
          <span>第 {game.round + 1} 杯 · 等待第一口</span>
        )}
        <small>{game.attempts} / 3 次试味</small>
      </div>
    </div>
  );
}

export default function TogetherPanel({
  state,
  busy,
  action,
}: {
  state: State;
  busy: boolean;
  action: Action;
}) {
  const [selected, setSelected] = useState<Game['kind']>('chess');
  const [difficulty, setDifficulty] = useState('gentle');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const game = state.game;
  const [showResult, setShowResult] = useState(true);
  useEffect(() => {
    setShowResult(true);
    setConfirmEnd(false);
  }, [game?.id]);
  const showingGame =
    game && (game.status === 'playing' || (game.status === 'finished' && showResult));
  async function move(body: Record<string, unknown>) {
    return action('/game/action', { id: game?.id, revision: game?.revision, ...body });
  }
  return (
    <div className="together-workspace">
      {showingGame ? (
        <>
          <div className="game-heading">
            <div>
              <span className="small-label">JUST THE TWO OF US</span>
              <h3>{names[game.kind]}</h3>
            </div>
            <span className="game-live">
              {game.status === 'playing' ? '这一局 · 进行中' : '属于我们的新回忆'}
            </span>
          </div>
          <div className="echo-game-line" aria-live="polite">
            <span className="echo-token">E</span>
            <p>{game.line}</p>
          </div>
          {game.kind === 'chess' && <ChessTable game={game} busy={busy} move={move} />}
          {game.kind === 'pairs' && <PairsTable game={game} busy={busy} move={move} />}
          {game.kind === 'drinks' && <DrinksTable game={game} busy={busy} move={move} />}
          {game.status === 'finished' ? (
            <div className="game-result" role="status">
              <Trophy size={25} />
              <div>
                <h3>
                  {game.result === 'win'
                    ? '今天的胜利属于你'
                    : game.result === 'draw'
                      ? '一段刚刚好的默契'
                      : '下一局，再来挑战'}
                </h3>
                <p>已记入我们的回忆</p>
              </div>
              <button className="secondary" disabled={busy} onClick={() => setShowResult(false)}>
                <ArrowLeft size={16} />
                游戏桌
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void action('/game/start', { kind: game.kind, difficulty: game.difficulty })
                }
              >
                <RotateCcw size={16} />
                再来一局
              </button>
            </div>
          ) : (
            <div className="game-end-actions">
              {confirmEnd ? (
                <>
                  <span>现在结束这一局？</span>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void move({ action: game.kind === 'chess' ? 'resign' : 'end' })}
                  >
                    {game.kind === 'chess' ? '认输结束' : '结束本局'}
                  </button>
                  <button className="text-button" onClick={() => setConfirmEnd(false)}>
                    继续玩
                  </button>
                </>
              ) : (
                <button className="text-button" onClick={() => setConfirmEnd(true)}>
                  <X size={14} />
                  结束这一局
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <section className="close-moments">
            <div className="section-heading">
              <Heart size={18} />
              <h3>靠近一点</h3>
              <span>{state.relationship}</span>
            </div>
            <div className="interaction-options">
              {[
                { kind: 'hand', text: '轻轻牵手', icon: Heart },
                { kind: 'hug', text: '要一个拥抱', icon: Flower2 },
                { kind: 'listen', text: '听她说心事', icon: Moon },
                { kind: 'praise', text: '认真夸夸她', icon: Sparkles },
              ].map(({ kind, text, icon: Icon }) => (
                <button
                  className="interaction-option"
                  key={kind}
                  disabled={busy || !!state.companion?.pending}
                  onClick={() => void action('/interaction', { kind })}
                >
                  <Icon size={22} />
                  <span>{text}</span>
                </button>
              ))}
            </div>
            {state.companion?.lastLine && (
              <div className="companion-response">
                <span className="echo-token">E</span>
                <p>{state.companion.lastLine}</p>
              </div>
            )}
            {state.companion?.pending && (
              <div className="companion-choices">
                {state.companion.pending.choices.map((choice) => (
                  <button
                    key={choice}
                    className="secondary"
                    disabled={busy}
                    onClick={() => void action('/interaction', { kind: 'answer', choice })}
                  >
                    {choice}
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="game-library">
            <div className="section-heading">
              <Crown size={18} />
              <h3>今晚的游戏桌</h3>
            </div>
            <div className="game-catalog">
              {(['chess', 'pairs', 'drinks'] as const).map((kind, i) => {
                const Icon = [Crown, Flower2, Coffee][i];
                const stats = state.gameStats?.[kind];
                return (
                  <button
                    key={kind}
                    className={`game-cover ${kind} ${selected === kind ? 'selected' : ''}`}
                    aria-pressed={selected === kind}
                    onClick={() => setSelected(kind)}
                  >
                    <div className="game-cover-art">
                      {kind === 'chess' ? (
                        <span className="cover-chess">♞ ♟</span>
                      ) : kind === 'pairs' ? (
                        <div className="cover-pairs">
                          <Heart size={29} />
                          <Flower2 size={29} />
                        </div>
                      ) : (
                        <Coffee size={58} strokeWidth={1.2} />
                      )}
                    </div>
                    <div className="game-cover-title">
                      <Icon size={17} />
                      <h4>{names[kind]}</h4>
                    </div>
                    <span>
                      {['白棋与黑棋的认真较量', '把看过的瞬间放在心里', '为彼此调一杯刚刚好'][i]}
                    </span>
                    <small>
                      {stats
                        ? `一起玩过 ${stats.played} 局${kind === 'drinks' ? ` · 最佳 ${stats.best} 分` : ` · 你赢过 ${stats.wins} 局`}`
                        : '等待我们的第一局'}
                    </small>
                  </button>
                );
              })}
            </div>
            <div className="game-invite">
              <div>
                <strong>{names[selected]}</strong>
                {selected === 'chess' && (
                  <div className="segmented" aria-label="Echo 棋力">
                    <button
                      className={difficulty === 'gentle' ? 'active' : ''}
                      onClick={() => setDifficulty('gentle')}
                    >
                      轻松下
                    </button>
                    <button
                      className={difficulty === 'thoughtful' ? 'active' : ''}
                      onClick={() => setDifficulty('thoughtful')}
                    >
                      认真下
                    </button>
                  </div>
                )}
              </div>
              <button
                className="primary"
                disabled={busy || !!state.activity?.together}
                onClick={() => void action('/game/start', { kind: selected, difficulty })}
              >
                <Heart size={16} />
                邀请 Echo 开始
                <ArrowRight size={16} />
              </button>
            </div>
            {state.activity?.together && (
              <div className="game-activity-conflict">
                <span>还在一起{state.activity.kind === 'cook' ? '做饭' : '活动'}</span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void action('/activity/cancel', {})}
                >
                  结束活动
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
