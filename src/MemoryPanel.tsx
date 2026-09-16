import { useMemo, useState } from 'react';
import { Bookmark, Check, Heart, Pencil, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import type { Memory, State } from './types';

const kinds: Record<string, string> = {
  all: '全部',
  pinned: '置顶',
  preference: '喜好',
  profile: '关于你',
  boundary: '边界',
  promise: '约定',
  game: '游戏',
  moment: '心动瞬间',
  daily: '日常',
  milestone: '里程碑',
};
const sources: Record<string, string> = {
  chat: '来自聊天',
  manual: '亲手记录',
  life: '共同生活',
  game: '一起玩过',
  interaction: '相处时刻',
};
export default function MemoryPanel({
  state,
  busy,
  action,
}: {
  state: State;
  busy: boolean;
  action: (path: string, body: unknown) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState('all'),
    [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Memory | 'new' | null>(null),
    [title, setTitle] = useState(''),
    [text, setText] = useState(''),
    [kind, setKind] = useState('profile');
  const [forget, setForget] = useState<string | null>(null);
  const memories = useMemo(
    () =>
      state.memories
        .filter(
          (m) =>
            (filter === 'all' || (filter === 'pinned' ? m.pinned : m.kind === filter)) &&
            `${m.title} ${m.text}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)),
    [state.memories, filter, search],
  );
  function edit(memory: Memory | 'new') {
    setEditing(memory);
    setTitle(memory === 'new' ? '' : memory.title);
    setText(memory === 'new' ? '' : memory.text);
    setKind(memory === 'new' ? 'profile' : memory.kind);
  }
  return (
    <div className="memory-workspace">
      <div className="memory-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="搜索记忆"
            placeholder="寻找一句话、一段经历…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="primary" onClick={() => edit('new')} disabled={busy}>
          <Plus size={16} />
          记一件事
        </button>
      </div>
      <div className="filter-tabs memory-filters" aria-label="记忆分类">
        {Object.entries(kinds).map(([id, label]) => (
          <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
            {label}
            {id === 'all' && <span>{state.memories.length}</span>}
          </button>
        ))}
      </div>
      {editing && (
        <form
          className="memory-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await action('/memory', {
                operation: editing === 'new' ? 'add' : 'edit',
                id: editing === 'new' ? undefined : editing.id,
                title: title.trim(),
                text: text.trim(),
                ...(editing === 'new' ? { kind } : {}),
              })
            )
              setEditing(null);
          }}
        >
          <label>
            标题
            <input
              required
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {editing === 'new' && (
            <label>
              分类
              <select aria-label="分类" value={kind} onChange={(e) => setKind(e.target.value)}>
                {['profile', 'preference', 'boundary', 'promise', 'moment'].map((k) => (
                  <option key={k} value={k}>
                    {kinds[k]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            想让 Echo 记住的事
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="inline-actions">
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              <X size={16} />
              取消
            </button>
            <button className="primary" disabled={busy || !title.trim() || !text.trim()}>
              <Check size={16} />
              保存记忆
            </button>
          </div>
        </form>
      )}
      <div className="memory-list">
        {memories.map((m) => (
          <article className={`memory-entry ${m.pinned ? 'pinned' : ''}`} key={m.id}>
            <span className={`memory-symbol ${m.kind}`}>
              {m.pinned ? (
                <Pin size={19} />
              ) : m.kind === 'preference' ? (
                <Heart size={20} />
              ) : (
                <Bookmark size={20} />
              )}
            </span>
            <div className="memory-content">
              <span className="small-label">
                第 {m.day} 天 · {kinds[m.kind] || '回忆'} ·{' '}
                {sources[m.source || 'life'] || '共同生活'}
              </span>
              <h3>{m.title}</h3>
              <p>{m.text}</p>
              <div className="memory-actions">
                <button
                  title={m.pinned ? '取消置顶' : '置顶记忆'}
                  aria-label={`${m.pinned ? '取消置顶' : '置顶记忆'}：${m.title}`}
                  className="icon-button"
                  disabled={busy}
                  onClick={() => void action('/memory', { operation: 'pin', id: m.id })}
                >
                  <Pin size={15} />
                </button>
                <button
                  title="编辑记忆"
                  aria-label={`编辑记忆：${m.title}`}
                  className="icon-button"
                  disabled={busy}
                  onClick={() => edit(m)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  title="遗忘记忆"
                  aria-label={`遗忘记忆：${m.title}`}
                  className="icon-button"
                  disabled={busy}
                  onClick={() => setForget(m.id)}
                >
                  <Trash2 size={15} />
                </button>
                {forget === m.id && (
                  <div className="forget-confirm">
                    <span>遗忘这条记忆？</span>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={async () => {
                        if (await action('/memory', { operation: 'forget', id: m.id }))
                          setForget(null);
                      }}
                    >
                      确认遗忘
                    </button>
                    <button className="text-button" onClick={() => setForget(null)}>
                      取消
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!memories.length && (
        <div className="empty-state">
          <Bookmark size={28} />
          <h3>{search ? '没有找到这段回忆' : '这一页还空着'}</h3>
        </div>
      )}
    </div>
  );
}
