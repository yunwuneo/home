import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { State, Message } from './types';
import './chat-tools.css';
export type Attachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
  truncated?: boolean;
};
type ModelRef = { providerId: string; model: string };
type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  hasKey?: boolean;
  models: string[];
  favorites: string[];
};
type Instruction = {
  id: string;
  title: string;
  prompt: string;
  enabled: boolean;
  topicId?: string;
};
type MCP = {
  id: string;
  name: string;
  transport: 'http' | 'sse' | 'stdio';
  url?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
  headers?: Record<string, string>;
};
export type ChatConfig = {
  providers: Provider[];
  roles: Partial<Record<'chat' | 'memory' | 'embedding' | 'asr' | 'tts', ModelRef>>;
  autoMemory: boolean;
  instructions: Instruction[];
  mcp: MCP[];
};
const empty: ChatConfig = { providers: [], roles: {}, instructions: [], mcp: [], autoMemory: true };
export function ChatTools({
  state,
  topicId,
  onTopic,
  onState,
  onBusy,
  attachments,
  onAttachments,
  onText,
  disabled,
}: {
  state: State;
  topicId: string;
  onTopic: (id: string) => void;
  onState: (s: State) => void;
  onBusy: (busy: boolean) => void;
  attachments: Attachment[];
  onAttachments: (v: Attachment[]) => void;
  onText: (v: string) => void;
  disabled: boolean;
}) {
  const [config, setConfig] = useState<ChatConfig>(empty),
    [open, setOpen] = useState(false),
    [tab, setTab] = useState('模型'),
    [status, setStatus] = useState(''),
    [working, setWorking] = useState(false),
    [recording, setRecording] = useState(false),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<
      Array<{
        id: string;
        text: string;
        score?: number;
        method?: string;
        sourceMessageIds?: string[];
      }>
    >([]);
  useEffect(() => onBusy(working), [working, onBusy]);
  const file = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    recorder = useRef<MediaRecorder | null>(null),
    recognition = useRef<any>(null);
  useEffect(() => {
    api<ChatConfig>('/chat/config')
      .then(setConfig)
      .catch((e) => setStatus(e.message));
    return () => {
      recorder.current?.stop();
      recognition.current?.stop();
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    setWorking(true);
    setStatus('');
    try {
      await fn();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function save() {
    const value = await api<ChatConfig>('/chat/config', config);
    setConfig(value);
    setStatus('已同步到服务端');
    return value;
  }
  async function topic(operation: string, title?: string) {
    await run(async () => {
      const next = await api<State>('/chat/topics', { operation, id: topicId, title });
      onState(next);
      if (operation === 'create') onTopic(next.topics![0].id);
      if (operation === 'delete') onTopic('home');
    });
  }
  const options = config.providers.flatMap((p) =>
    p.models.map((model) => ({
      value: JSON.stringify({ providerId: p.id, model }),
      label: `${p.favorites.includes(model) ? '★ ' : ''}${p.name} / ${model}`,
    })),
  );
  async function upload(files: FileList | null) {
    if (!files) return;
    await run(async () => {
      const next = [...attachments];
      for (const f of Array.from(files)) {
        if (next.length >= 6) throw new Error('每次最多 6 个附件');
        if (f.size > 10 * 1024 * 1024) throw new Error('附件需小于 10 MB');
        const data = await toBase64(f);
        next.push(await api<Attachment>('/chat/upload', { name: f.name, mime: f.type, data }));
        onAttachments([...next]);
      }
      setStatus('附件已上传，发送消息后 Echo 就能查看。');
    });
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      recognition.current?.stop();
      setRecording(false);
      return;
    }
    await run(async () => {
      if (config.roles.asr) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const r = new MediaRecorder(stream);
        recorder.current = r;
        const chunks: Blob[] = [];
        r.ondataavailable = (e) => chunks.push(e.data);
        r.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          setRecording(false);
          void run(async () => {
            const blob = new Blob(chunks, { type: r.mimeType });
            const result = await api<{ text: string }>('/chat/voice/transcribe', {
              data: await toBase64(blob),
              mime: blob.type,
              name: 'recording.webm',
            });
            onText(result.text);
            setStatus('识别完成，可编辑后发送');
          });
        };
        r.start();
        setRecording(true);
      } else {
        const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!C) throw new Error('此浏览器不支持设备语音输入，请配置云端识别模型。');
        const r = new C();
        recognition.current = r;
        r.lang = 'zh-CN';
        r.onresult = (e: any) => onText(e.results[0][0].transcript);
        r.onerror = (e: any) => {
          setStatus('设备语音识别失败：' + e.error);
          setRecording(false);
        };
        r.onend = () => setRecording(false);
        r.start();
        setRecording(true);
        setStatus('设备语音输入');
      }
    });
  }
  return (
    <>
      <div className="chat-toolbox">
        <div className="topic-row">
          <select
            aria-label="话题"
            value={topicId}
            disabled={disabled || working}
            onChange={(e) => onTopic(e.target.value)}
          >
            {(state.topics || [{ id: 'home', title: '和 Echo 的日常' }]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            disabled={disabled || working}
            onClick={() => {
              const title = prompt('新话题名称');
              if (title) void topic('create', title);
            }}
          >
            ＋ 话题
          </button>
          <button
            onClick={() => {
              setOpen(true);
              void api<ChatConfig>('/chat/config').then(setConfig);
            }}
          >
            聊天设置
          </button>
        </div>
        <div className="attachment-row">
          <button disabled={disabled || working} onClick={() => camera.current?.click()}>
            拍照
          </button>
          <button disabled={disabled || working} onClick={() => file.current?.click()}>
            照片 / 文件
          </button>
          <button disabled={disabled || working} onClick={() => void record()}>
            {recording ? '停止录音' : '语音输入'}
          </button>
          <span>记忆{config.autoMemory ? '自动整理' : '手动整理'}</span>
        </div>
        <input
          ref={file}
          hidden
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,.pdf,.docx,.txt,.md,.csv,.json"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={camera}
          hidden
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = '';
          }}
        />
        {attachments.map((a) => (
          <span className="attachment-chip" key={a.id}>
            {a.name}
            {a.truncated ? '（已截取前 4 万字）' : ''}
            <button
              disabled={disabled}
              onClick={() => onAttachments(attachments.filter((x) => x.id !== a.id))}
              aria-label={`移除 ${a.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {status && (
          <p role="status" className="tool-status">
            {status}
          </p>
        )}
      </div>
      {open &&
        createPortal(
          <div className="chat-modal-backdrop" onClick={() => setOpen(false)}>
            <section
              className="chat-settings"
              role="dialog"
              aria-modal="true"
              aria-label="聊天设置"
              onClick={(e) => e.stopPropagation()}
            >
              <header>
                <div>
                  <small>YOUR SPACE WITH ECHO</small>
                  <h2>把对话调成你的习惯</h2>
                </div>
                <button aria-label="关闭聊天设置" onClick={() => setOpen(false)}>
                  ✕
                </button>
              </header>
              <nav>
                {['模型', '记忆', '指令', 'MCP', '话题', '语音'].map((t) => (
                  <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>
                    {t}
                  </button>
                ))}
              </nav>
              <div className="settings-content">
                <fieldset disabled={disabled || working}>
                  {tab === '模型' && (
                    <>
                      <p>
                        服务商与模型保存在家中的服务端，iOS 和 Web
                        共用。密钥保存后仅显示是否已配置。
                      </p>
                      {config.providers.map((p, i) => (
                        <article key={p.id}>
                          <h3>{p.name}</h3>
                          <label>
                            服务商名称
                            <input
                              value={p.name}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  providers: config.providers.map((x, j) =>
                                    i === j ? { ...x, name: e.target.value } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            API 地址
                            <input
                              placeholder="https://example.com/v1"
                              value={p.baseUrl}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  providers: config.providers.map((x, j) =>
                                    i === j ? { ...x, baseUrl: e.target.value } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            API Key
                            <input
                              type="password"
                              autoComplete="off"
                              placeholder={p.hasKey ? '已保存，留空保留' : '填写密钥'}
                              value={p.apiKey || ''}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  providers: config.providers.map((x, j) =>
                                    i === j ? { ...x, apiKey: e.target.value } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <button
                            onClick={() =>
                              void run(async () => {
                                await save();
                                const result = await api<{ models: string[] }>('/chat/models', {
                                  providerId: p.id,
                                });
                                setConfig((c) => ({
                                  ...c,
                                  providers: c.providers.map((x) =>
                                    x.id === p.id ? { ...x, models: result.models } : x,
                                  ),
                                }));
                                setStatus(`已获取 ${result.models.length} 个模型`);
                              })
                            }
                          >
                            保存并获取模型
                          </button>
                          <label>
                            收藏模型
                            <select
                              value=""
                              onChange={(e) => {
                                const favorites = p.favorites.includes(e.target.value)
                                  ? p.favorites.filter((v) => v !== e.target.value)
                                  : [...p.favorites, e.target.value];
                                setConfig({
                                  ...config,
                                  providers: config.providers.map((x) =>
                                    x.id === p.id ? { ...x, favorites } : x,
                                  ),
                                });
                              }}
                            >
                              <option value="">点击模型切换收藏</option>
                              {p.models.map((m) => (
                                <option key={m} value={m}>
                                  {p.favorites.includes(m) ? '★ ' : ''}
                                  {m}
                                </option>
                              ))}
                            </select>
                          </label>
                          <small>{p.favorites.join(' · ')}</small>
                          <button
                            onClick={() =>
                              setConfig({
                                ...config,
                                providers: config.providers.filter((x) => x.id !== p.id),
                                roles: Object.fromEntries(
                                  Object.entries(config.roles).filter(
                                    ([, v]) => v.providerId !== p.id,
                                  ),
                                ),
                              })
                            }
                          >
                            移除服务商
                          </button>
                        </article>
                      ))}
                      <button
                        onClick={() =>
                          setConfig({
                            ...config,
                            providers: [
                              ...config.providers,
                              {
                                id: crypto.randomUUID(),
                                name: '新服务商',
                                baseUrl: '',
                                models: [],
                                favorites: [],
                              },
                            ],
                          })
                        }
                      >
                        添加服务商
                      </button>
                      {(['chat', 'memory', 'embedding'] as const).map((key, i) => (
                        <label key={key}>
                          {['默认对话模型', '记忆提取模型', '向量模型'][i]}
                          <select
                            value={config.roles[key] ? JSON.stringify(config.roles[key]) : ''}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                roles: {
                                  ...config.roles,
                                  [key]: e.target.value ? JSON.parse(e.target.value) : undefined,
                                },
                              })
                            }
                          >
                            <option value="">
                              未配置{key === 'memory' ? '（沿用对话模型）' : ''}
                            </option>
                            {options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </>
                  )}
                  {tab === '记忆' && (
                    <>
                      <h3>让下次对话接得上这一次</h3>
                      <p>
                        从你明确说过的话里提取事实，自动去重与更新。新话题会召回相关记忆；你可以在回忆手记中修改或遗忘。
                      </p>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={config.autoMemory}
                          onChange={(e) => setConfig({ ...config, autoMemory: e.target.checked })}
                        />
                        自动提取并保存记忆
                      </label>
                      <button
                        onClick={() =>
                          void run(async () => {
                            await save();
                            const r = await api<{ count: number }>('/chat/memory/reindex', {});
                            setStatus(`向量索引已更新：${r.count} 条`);
                          })
                        }
                      >
                        更新全部记忆向量
                      </button>
                      <label>
                        试着问一件以前说过的事
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="我平时喜欢喝什么？"
                        />
                      </label>
                      <button
                        disabled={!query}
                        onClick={() =>
                          void run(async () => {
                            const r = await api<{ results: typeof results; mode: string }>(
                              '/chat/memory/search',
                              { query },
                            );
                            setResults(r.results);
                            setStatus(`召回 ${r.results.length} 条 · ${r.mode}`);
                          })
                        }
                      >
                        检索记忆
                      </button>
                      {results.map((m) => (
                        <article key={m.id}>
                          <p>{m.text}</p>
                          <small>
                            {m.method} · {m.score?.toFixed(3)} · 来源{' '}
                            {m.sourceMessageIds?.length || 0} 条消息
                          </small>
                        </article>
                      ))}
                    </>
                  )}
                  {tab === '指令' && (
                    <>
                      <p>
                        支持 {'{{user}}'}、{'{{assistant}}'}、{'{{date}}'}、{'{{topic}}'}
                        。话题指令仅在指定话题生效。
                      </p>
                      {config.instructions.map((r, i) => (
                        <article key={r.id}>
                          <label>
                            名称
                            <input
                              value={r.title}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  instructions: config.instructions.map((v, j) =>
                                    i === j ? { ...v, title: e.target.value } : v,
                                  ),
                                })
                              }
                            />
                          </label>
                          <textarea
                            aria-label="指令内容"
                            rows={5}
                            value={r.prompt}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                instructions: config.instructions.map((v, j) =>
                                  i === j ? { ...v, prompt: e.target.value } : v,
                                ),
                              })
                            }
                          />
                          <label>
                            生效范围
                            <select
                              value={r.topicId || ''}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  instructions: config.instructions.map((v, j) =>
                                    i === j ? { ...v, topicId: e.target.value || undefined } : v,
                                  ),
                                })
                              }
                            >
                              <option value="">所有话题</option>
                              {state.topics?.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={r.enabled}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  instructions: config.instructions.map((v, j) =>
                                    i === j ? { ...v, enabled: e.target.checked } : v,
                                  ),
                                })
                              }
                            />
                            启用
                          </label>
                          <button
                            onClick={() =>
                              setConfig({
                                ...config,
                                instructions: config.instructions.filter((v) => v.id !== r.id),
                              })
                            }
                          >
                            删除指令
                          </button>
                        </article>
                      ))}
                      <button
                        onClick={() =>
                          setConfig({
                            ...config,
                            instructions: [
                              ...config.instructions,
                              {
                                id: crypto.randomUUID(),
                                title: '新的指令',
                                prompt: '',
                                enabled: true,
                              },
                            ],
                          })
                        }
                      >
                        添加指令
                      </button>
                    </>
                  )}
                  {tab === 'MCP' && (
                    <>
                      <p>
                        服务端统一连接工具。启用的工具可以被 Echo 在对话中调用；stdio
                        程序运行在服务端电脑。
                      </p>
                      {config.mcp.map((m, i) => (
                        <article key={m.id}>
                          <label>
                            名称
                            <input
                              value={m.name}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  mcp: config.mcp.map((v, j) =>
                                    i === j ? { ...v, name: e.target.value } : v,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            连接方式
                            <select
                              value={m.transport}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  mcp: config.mcp.map((v, j) =>
                                    i === j
                                      ? { ...v, transport: e.target.value as MCP['transport'] }
                                      : v,
                                  ),
                                })
                              }
                            >
                              <option value="http">Streamable HTTP</option>
                              <option value="sse">SSE</option>
                              <option value="stdio">服务端 stdio</option>
                            </select>
                          </label>
                          {m.transport === 'stdio' ? (
                            <>
                              <label>
                                启动命令
                                <input
                                  value={m.command || ''}
                                  onChange={(e) =>
                                    setConfig({
                                      ...config,
                                      mcp: config.mcp.map((v, j) =>
                                        i === j ? { ...v, command: e.target.value } : v,
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                参数（每行一个）
                                <textarea
                                  value={(m.args || []).join('\n')}
                                  onChange={(e) =>
                                    setConfig({
                                      ...config,
                                      mcp: config.mcp.map((v, j) =>
                                        i === j ? { ...v, args: e.target.value.split('\n') } : v,
                                      ),
                                    })
                                  }
                                />
                              </label>
                            </>
                          ) : (
                            <label>
                              URL
                              <input
                                value={m.url || ''}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    mcp: config.mcp.map((v, j) =>
                                      i === j ? { ...v, url: e.target.value } : v,
                                    ),
                                  })
                                }
                              />
                            </label>
                          )}
                          {m.transport !== 'stdio' && (
                            <label>
                              Authorization（留空保留）
                              <input
                                type="password"
                                autoComplete="off"
                                value={m.headers?.Authorization || ''}
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    mcp: config.mcp.map((v, j) =>
                                      i === j
                                        ? {
                                            ...v,
                                            headers: e.target.value
                                              ? { Authorization: e.target.value }
                                              : undefined,
                                          }
                                        : v,
                                    ),
                                  })
                                }
                              />
                            </label>
                          )}
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={m.enabled}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  mcp: config.mcp.map((v, j) =>
                                    i === j ? { ...v, enabled: e.target.checked } : v,
                                  ),
                                })
                              }
                            />
                            允许 Echo 使用
                          </label>
                          <button
                            onClick={() =>
                              void run(async () => {
                                await save();
                                const r = await api<{
                                  tools: { name: string; description: string }[];
                                }>('/chat/mcp/test', { id: m.id });
                                setStatus(
                                  '连接成功：' +
                                    r.tools.map((t) => t.description.split('.')[0]).join('、'),
                                );
                              })
                            }
                          >
                            保存并测试连接
                          </button>
                          <button
                            onClick={() =>
                              setConfig({ ...config, mcp: config.mcp.filter((v) => v.id !== m.id) })
                            }
                          >
                            移除 MCP
                          </button>
                        </article>
                      ))}
                      <button
                        onClick={() =>
                          setConfig({
                            ...config,
                            mcp: [
                              ...config.mcp,
                              {
                                id: crypto.randomUUID(),
                                name: '新工具服务',
                                transport: 'http',
                                url: '',
                                enabled: false,
                              },
                            ],
                          })
                        }
                      >
                        添加 MCP
                      </button>
                    </>
                  )}
                  {tab === '话题' && (
                    <>
                      <h3>{state.topics?.find((t) => t.id === topicId)?.title}</h3>
                      <button
                        onClick={() => {
                          const title = prompt('修改话题名称');
                          if (title) void topic('update', title);
                        }}
                      >
                        重命名话题
                      </button>
                      <label>
                        此话题的模型
                        <select
                          value={
                            state.topics?.find((t) => t.id === topicId)?.model
                              ? JSON.stringify(state.topics.find((t) => t.id === topicId)!.model)
                              : ''
                          }
                          onChange={(e) =>
                            void run(async () =>
                              onState(
                                await api<State>('/chat/topics', {
                                  operation: 'update',
                                  id: topicId,
                                  model: e.target.value ? JSON.parse(e.target.value) : null,
                                }),
                              ),
                            )
                          }
                        >
                          <option value="">沿用默认模型</option>
                          {options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <h3>此话题可用工具</h3>
                      {config.mcp.map((m) => (
                        <label className="check" key={m.id}>
                          <input
                            type="checkbox"
                            checked={
                              state.topics?.find((t) => t.id === topicId)?.mcpIds?.includes(m.id) ??
                              true
                            }
                            onChange={(e) => {
                              const ids =
                                state.topics?.find((t) => t.id === topicId)?.mcpIds ||
                                config.mcp.map((x) => x.id);
                              void run(async () =>
                                onState(
                                  await api<State>('/chat/topics', {
                                    operation: 'update',
                                    id: topicId,
                                    mcpIds: e.target.checked
                                      ? [...ids, m.id]
                                      : ids.filter((x) => x !== m.id),
                                  }),
                                ),
                              );
                            }}
                          />
                          {m.name}
                        </label>
                      ))}
                      {topicId !== 'home' && (
                        <button
                          onClick={() => {
                            if (confirm('删除此话题及聊天记录？提取的长期记忆会保留。'))
                              void topic('delete');
                          }}
                        >
                          删除话题
                        </button>
                      )}
                    </>
                  )}
                  {tab === '语音' && (
                    <>
                      <h3>说给 Echo 听，也听她说</h3>
                      <p>
                        未配置云端模型时使用设备语音能力。浏览器是否支持识别取决于设备；云端服务需支持
                        audio/transcriptions 与 audio/speech。
                      </p>
                      {(['asr', 'tts'] as const).map((key, i) => (
                        <label key={key}>
                          {['语音识别模型', '语音朗读模型'][i]}
                          <select
                            value={config.roles[key]?.providerId || ''}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                roles: {
                                  ...config.roles,
                                  [key]: e.target.value
                                    ? {
                                        providerId: e.target.value,
                                        model: config.roles[key]?.model || '',
                                      }
                                    : undefined,
                                },
                              })
                            }
                          >
                            <option value="">设备语音服务</option>
                            {config.providers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          {config.roles[key] && (
                            <input
                              aria-label={key + '模型名称'}
                              placeholder={key === 'asr' ? '例如 whisper-1' : '例如 tts-1'}
                              value={config.roles[key]?.model || ''}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  roles: {
                                    ...config.roles,
                                    [key]: { ...config.roles[key]!, model: e.target.value },
                                  },
                                })
                              }
                            />
                          )}
                        </label>
                      ))}
                    </>
                  )}
                </fieldset>
              </div>
              <footer>
                <span role="status">{working ? '处理中…' : status}</span>
                <button
                  disabled={working || disabled}
                  onClick={() =>
                    void run(async () => {
                      await save();
                    })
                  }
                >
                  保存设置
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
export async function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
export function MessageExtras({ message, messages }: { message: Message; messages: Message[] }) {
  const [status, setStatus] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null);
  async function speak() {
    try {
      if (audio.current && !audio.current.paused) {
        audio.current.pause();
        return;
      }
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        return;
      }
      const config = await api<ChatConfig>('/chat/config');
      if (config.roles.tts) {
        const r = await api<{ data: string; mime: string }>('/chat/voice/speak', {
          text: message.content,
        });
        audio.current = new Audio(`data:${r.mime};base64,${r.data}`);
        await audio.current.play();
      } else {
        const u = new SpeechSynthesisUtterance(message.content);
        u.lang = 'zh-CN';
        speechSynthesis.speak(u);
      }
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <div className="message-extras">
      {message.attachments?.map((a) => (
        <a key={a.id} href={`/api/chat/files/${a.id}`} target="_blank" rel="noreferrer">
          {a.mime.startsWith('image/') && <img src={`/api/chat/files/${a.id}`} alt={a.name} />}📎{' '}
          {a.name}
        </a>
      ))}
      {message.memoryUsed?.length ? (
        <details>
          <summary>使用了 {message.memoryUsed.length} 条记忆</summary>
          {message.memoryUsed.map((m) => (
            <p key={m.id}>
              {m.text}
              <small>
                {m.method || '关键词'}
                {m.score !== undefined ? ' · ' + m.score.toFixed(3) : ''}
                {m.sourceMessageIds
                  ?.map((id) => messages.find((source) => source.id === id))
                  .filter(Boolean)
                  .map((source) => (
                    <span key={source!.id}> · 来源：{source!.content}</span>
                  ))}
              </small>
            </p>
          ))}
        </details>
      ) : null}
      {message.toolTrace?.length ? (
        <details>
          <summary>工具调用 {message.toolTrace.length} 次</summary>
          {message.toolTrace.map((t, i) => (
            <p key={i}>
              {t.server} / {t.name}
              <pre>{t.result}</pre>
            </p>
          ))}
        </details>
      ) : null}
      {message.role === 'assistant' && <button onClick={() => void speak()}>朗读 / 停止</button>}
      {message.role === 'user' && (
        <button
          onClick={() =>
            void api('/chat/memory/extract', { messageId: message.id })
              .then(() => setStatus('记忆已整理'))
              .catch((e) => setStatus(e.message))
          }
        >
          提取记忆
        </button>
      )}
      {status && <small role="status">{status}</small>}
    </div>
  );
}
