import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Coffee,
  CookingPot,
  Flower2,
  Heart,
  Home,
  Leaf,
  LoaderCircle,
  Maximize2,
  MessageCircle,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Sun,
  Tv,
  Utensils,
  Waves,
  X,
  BedDouble,
  CloudSun,
  WifiOff,
  KeyRound,
  Map,
  ShoppingBasket,
  Clapperboard,
  Building2,
  Trees,
  Focus,
} from 'lucide-react';
import { api, ApiError } from './api';
import LanLogin from './LanLogin';
import type { ActivityKind, PlaceId, Settings, State, View } from './types';
import { ACTIVITIES } from '../shared/world.mjs';
import { PLACES } from '../shared/places.mjs';
import { CAMERA_VIEWS } from './cameraViews';
import CityMap from './CityMap';

const World = lazy(() => import('./World'));
const icons = {
  shop: ShoppingBasket,
  movie: Clapperboard,
  work: Building2,
  coffee: Coffee,
  stroll: Trees,
  cook: CookingPot,
  eat: Utensils,
  tea: Coffee,
  tv: Tv,
  rest: BedDouble,
  water: Leaf,
  read: BookOpen,
  wash: Waves,
};
const time = (minute: number) =>
  `${Math.floor(minute / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(minute % 60)
    .toString()
    .padStart(2, '0')}`;
function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
class SceneBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="scene-failure">
        <CloudSun size={40} />
        <h2>小家暂时没有加载成功</h2>
        <p>请检查浏览器的硬件加速设置。</p>
        <button className="primary" onClick={() => location.reload()}>
          重新加载
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function SettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [key, setKey] = useState(''),
    [clearKey, setClearKey] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(''),
    [failed, setFailed] = useState(false);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: number } | null>(null);
  async function generatePairing() {
    setBusy(true);
    setFeedback('');
    try {
      setPairing(await api('/pairing', {}));
    } catch (error) {
      setFailed(true);
      setFeedback((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api<Settings>('/settings')
      .then(setSettings)
      .catch((e) => {
        setFeedback(e.message);
        setFailed(true);
      });
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    panel.current?.focus();
    function keys(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
      if (e.key === 'Tab') {
        const items = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      previous?.focus();
    };
  }, [busy, onClose]);
  async function save(test = false, local = false) {
    if (!settings) return;
    setBusy(true);
    setFeedback('');
    setFailed(false);
    try {
      const result = await api<Settings>('/settings', {
        baseUrl: local ? '' : settings.baseUrl,
        model: local ? '' : settings.model,
        apiKey: local ? '' : key,
        clearKey: local || clearKey,
        playerName: settings.playerName,
      });
      setSettings(result);
      setKey('');
      setClearKey(false);
      onSaved();
      if (test) {
        await api('/settings/test', {});
        setFeedback('连接成功，Echo 已准备好和你聊天。');
      } else setFeedback('已保存。');
    } catch (e) {
      setFeedback((e as Error).message);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={panel}
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">HOME SETTINGS</span>
            <h2 id="settings-title">小家的设置</h2>
          </div>
          <IconButton label="关闭设置" onClick={onClose} disabled={busy}>
            <X size={20} />
          </IconButton>
        </div>
        {settings ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Echo 对你的称呼
                <input
                  maxLength={24}
                  value={settings.playerName}
                  onChange={(e) => setSettings({ ...settings, playerName: e.target.value })}
                  required
                />
              </label>
              <div className="form-divider">
                <MessageCircle size={16} />
                <h3>文字模型</h3>
                <span className="status-tag">
                  {settings.configured ? '自定义 API' : '本地对话'}
                </span>
              </div>
              <label>
                API Base URL
                <input
                  type="url"
                  placeholder="https://your-provider.com/v1"
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label>
                模型名称
                <input
                  placeholder="输入服务商提供的模型 ID"
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label>
                API Key{' '}
                <span className="field-aside">
                  {settings.hasKey ? '已保存密钥' : '本地无密钥服务可留空'}
                </span>
                <input
                  type="password"
                  placeholder={settings.hasKey ? '留空保留已保存的密钥' : '输入 API 密钥'}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              {settings.hasKey && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={clearKey}
                    onChange={(e) => setClearKey(e.target.checked)}
                  />
                  清除已保存的密钥
                </label>
              )}
            </fieldset>
            <div className={`form-feedback ${failed ? 'error' : 'success'}`} role="status">
              {feedback}
            </div>
            <div className="dialog-actions">
              <button
                className="secondary"
                type="button"
                disabled={busy || !settings.baseUrl || !settings.model}
                onClick={() => void save(true)}
              >
                {busy ? <LoaderCircle size={16} className="spin" /> : <CheckCircle2 size={16} />}
                保存并测试
              </button>
              <button
                className="primary"
                type="submit"
                disabled={busy || !settings.playerName.trim()}
              >
                <Check size={16} />
                保存设置
              </button>
            </div>
            {settings.configured && (
              <button
                className="text-button local-switch"
                disabled={busy}
                type="button"
                onClick={() => void save(false, true)}
              >
                切换为本地对话
              </button>
            )}
            <section className="pairing-section">
              <div className="form-divider">
                <KeyRound size={16} />
                <h3>局域网设备</h3>
              </div>
              {settings.canPair ? (
                <>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void generatePairing()}
                  >
                    <KeyRound size={15} />
                    生成配对码
                  </button>
                  {pairing && (
                    <div className="pairing-code">
                      <output>{pairing.code}</output>
                      <span>
                        一次有效 ·{' '}
                        {new Date(pairing.expiresAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        前可用
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    void api('/session/logout', {})
                      .then(() => location.reload())
                      .catch((e) => {
                        setFailed(true);
                        setFeedback(e.message);
                      })
                  }
                >
                  断开此设备
                </button>
              )}
            </section>
          </form>
        ) : (
          <div className="dialog-loading">{feedback || '正在读取设置…'}</div>
        )}
      </div>
    </div>
  );
}
export default function App() {
  const [showMap, setShowMap] = useState(false);
  const [focus, setFocus] = useState<ActivityKind | null>(null);
  const [journey, setJourney] = useState<{
    destination: PlaceId;
    phase: 'leaving' | 'arriving';
  } | null>(null);
  const traveling = useRef(false);
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(true),
    [view, setView] = useState<View>('home'),
    [showSettings, setShowSettings] = useState(false),
    [needsPairing, setNeedsPairing] = useState(false);
  const [selected, setSelected] = useState<ActivityKind | null>(null),
    [reset, setReset] = useState(0),
    [zoom, setZoom] = useState(1),
    [more, setMore] = useState(false),
    [draft, setDraft] = useState(''),
    [sending, setSending] = useState(false),
    [acting, setActing] = useState(false),
    [pendingMessage, setPendingMessage] = useState(''),
    [mobileChat, setMobileChat] = useState(false);
  const [journalFilter, setJournalFilter] = useState('all'),
    [autoScroll, setAutoScroll] = useState(true),
    [unread, setUnread] = useState(false);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  useEffect(() => {
    setFocus(null);
    setSelected(null);
    setMore(false);
    setZoom(1);
  }, [state?.location]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]') && !showSettings) {
        setFocus(null);
        setSelected(null);
        setZoom(1);
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [showSettings]);
  function selectFurniture(kind: ActivityKind) {
    setSelected(kind);
    setFocus(kind);
    setZoom(1);
    setReset((r) => r + 1);
  }
  async function travelTo(destination: PlaceId) {
    if (traveling.current || acting || sending || destination === (state?.location || 'home'))
      return;
    traveling.current = true;
    setShowMap(false);
    setSelected(null);
    setMore(false);
    setJourney({ destination, phase: 'leaving' });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise((resolve) => setTimeout(resolve, reduced ? 0 : 400));
    if (!(await action('/travel', { location: destination }))) {
      setJourney(null);
      traveling.current = false;
      return;
    }
    setFocus(null);
    setZoom(1);
    setReset((r) => r + 1);
    await new Promise((resolve) => setTimeout(resolve, reduced ? 100 : 700));
    setJourney({ destination, phase: 'arriving' });
    await new Promise((resolve) => setTimeout(resolve, reduced ? 0 : 500));
    setJourney(null);
    traveling.current = false;
  }
  const log = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    chatForm = useRef<HTMLFormElement>(null),
    generation = useRef(0);
  async function refresh() {
    const stamp = generation.current;
    try {
      const result = await api<State>('/state');
      if (stamp === generation.current) setState(result);
      setNeedsPairing(false);
      setConnected(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'LAN_AUTH_REQUIRED') setNeedsPairing(true);
      else setConnected(false);
    }
  }
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await refresh();
      if (active) timer = setTimeout(poll, 1500);
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (autoScroll && log.current) log.current.scrollTop = log.current.scrollHeight;
    else setUnread(true);
  }, [state?.messages.length, state?.messages.at(-1)?.id, pendingMessage, autoScroll]);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 6500);
    return () => clearTimeout(timer);
  }, [error]);
  async function action(path: string, body: unknown) {
    generation.current++;
    setActing(true);
    try {
      setState(await api<State>(path, body));
      setConnected(true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      generation.current++;
      setActing(false);
    }
  }
  async function activity(kind: ActivityKind) {
    setFocus(kind);
    setZoom(1);
    setSelected(null);
    setMore(false);
    await action('/activity', { kind });
  }
  async function send(text: string) {
    if (!text.trim() || sending) return;
    const value = text.trim();
    setSending(true);
    setPendingMessage(value);
    setDraft('');
    setAutoScroll(true);
    generation.current++;
    try {
      setState(await api<State>('/chat', { text: value }));
    } catch (e) {
      setDraft(value);
      setError((e as Error).message);
    } finally {
      setSending(false);
      setPendingMessage('');
      generation.current++;
      input.current?.focus();
    }
  }
  function focusChat() {
    setMobileChat(true);
    setTimeout(() => input.current?.focus(), 100);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError('此浏览器暂不支持全屏模式。');
    }
  }
  if (needsPairing)
    return (
      <LanLogin
        onPaired={() => {
          setNeedsPairing(false);
          void refresh();
        }}
      />
    );
  if (!state)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Home size={30} />
        </div>
        <h1>和 Echo 的家</h1>
        {connected ? (
          <>
            <LoaderCircle className="spin" size={22} />
            <p>正在打开小家的门…</p>
          </>
        ) : (
          <>
            <p>暂时无法连接到家</p>
            <button className="primary" onClick={() => void refresh()}>
              重新连接
            </button>
          </>
        )}
      </div>
    );
  const current = state.activity ? ACTIVITIES[state.activity.kind] : null;
  const locationId = state.location || 'home';
  const place = PLACES[locationId];
  const dockActivities = (
    locationId === 'home' ? ['cook', 'eat', 'tv', 'rest'] : place.activities
  ) as ActivityKind[];
  const remaining = state.activity
    ? Math.max(0, Math.ceil(state.activity.duration - state.activity.progress))
    : 0;
  const night = state.minute < 360 || state.minute > 1140;
  const suggestions = state.preferences.length
    ? ['还记得我喜欢什么吗？', '今天和你一起很开心。', '你现在在想什么？']
    : ['今天想做什么？', '你喜欢这个家吗？', '我喜欢抹茶。'];
  return (
    <div className={`app ${mobileChat ? 'chat-open' : ''}`}>
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="回到家">
          <div className="brand-mark">
            <Home size={23} />
            <span />
          </div>
          <div>
            <h1>和 Echo 的家</h1>
            <span>OUR LITTLE DAYS</span>
          </div>
        </button>
        <nav className="main-nav" aria-label="主要导航">
          {(
            [
              { id: 'home', label: '小家', icon: Home },
              { id: 'journal', label: '回忆手记', icon: BookOpen },
              { id: 'routine', label: '今日生活', icon: Sun },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => setView(item.id)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="saved-status">
            {connected ? (
              <>
                <span className="status-dot" />
                已保存
              </>
            ) : (
              <>
                <WifiOff size={14} />
                连接中断
              </>
            )}
          </span>
          <IconButton label="设置" onClick={() => setShowSettings(true)}>
            <Settings2 size={20} />
          </IconButton>
        </div>
      </header>
      <main className="main-space">
        <section className={`home-space ${focus ? 'close-view' : ''}`} aria-label={place.name}>
          <SceneBoundary>
            <Suspense
              fallback={
                <div className="scene-loading">
                  <LoaderCircle className="spin" />
                  小家正在醒来…
                </div>
              }
            >
              <World
                state={state}
                onSelect={selectFurniture}
                onMove={(p) => {
                  if (!acting) void action('/move', { position: p });
                }}
                onEcho={focusChat}
                reset={reset}
                zoom={zoom}
                focus={focus}
              />
            </Suspense>
          </SceneBoundary>
          <div className="day-label">
            <span className="eyebrow">
              {locationId === 'home' ? 'HOME, SWEET HOME' : place.district}
            </span>
            <h2>
              {locationId === 'home' ? `一起生活的第 ${state.day} 天` : place.name}
              <span className="tiny-flower">
                <Flower2 size={22} />
              </span>
            </h2>
            <p>
              {night ? <Moon size={14} /> : <Sun size={14} />}初秋 ·{' '}
              {night ? '静谧的夜晚' : '阳光正好'}
              <span className="dot-separator">·</span>
              {focus
                ? CAMERA_VIEWS[focus].label
                : current?.room || (locationId === 'home' ? '客厅' : place.subtitle)}
            </p>
          </div>
          <div className="time-control">
            <div className="time-readout">
              {night ? <Moon size={17} /> : <Sun size={18} />}
              <span>{time(state.minute)}</span>
            </div>
            <span className="control-divider" />
            <IconButton
              label={state.speed ? '暂停时间' : '继续时间'}
              onClick={() => void action('/control', { speed: state.speed ? 0 : 1 })}
              disabled={acting}
            >
              {state.speed ? (
                <Pause size={15} fill="currentColor" />
              ) : (
                <Play size={15} fill="currentColor" />
              )}
            </IconButton>
            <button
              className={`speed-button ${state.speed === 3 ? 'active' : ''}`}
              title="切换时间速度"
              aria-label="切换时间速度"
              onClick={() => void action('/control', { speed: state.speed === 3 ? 1 : 3 })}
              disabled={acting}
            >
              {state.speed === 3 ? '3×' : '1×'}
            </button>
          </div>
          <aside className="echo-status" inert={!!focus}>
            <div className="status-heading">
              <span className="flower-avatar">
                <Flower2 size={21} />
              </span>
              <div>
                <h3>Echo 的小日常</h3>
                <p>
                  <span className="status-dot" />
                  {state.mood}
                </p>
              </div>
            </div>
            <div className="relationship">
              <Heart size={14} />
              {state.relationship}
            </div>
            <div className="echo-needs">
              <span>
                <Coffee size={14} />
                {state.hunger > 65 ? '肚子饱饱的' : state.hunger > 35 ? '想吃点东西' : '有些饿了'}
              </span>
              <span>
                <Sparkles size={14} />
                {state.energy > 60 ? '元气满满' : state.energy > 30 ? '有点困了' : '想休息了'}
              </span>
            </div>
            {current ? (
              <div className="current-activity">
                <span className="small-label">
                  {state.activity!.together ? '正在一起' : 'Echo 正在'}
                </span>
                <strong>
                  {current.verb}
                  <span>{state.activity!.stage === 'walking' ? '走过去…' : `${remaining}s`}</span>
                </strong>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${Math.min(100, (state.activity!.progress / state.activity!.duration) * 100)}%`,
                    }}
                  />
                </div>
                {state.activity!.together ? (
                  <button
                    className="text-button"
                    disabled={acting}
                    onClick={() => void action('/activity/cancel', {})}
                  >
                    结束这次活动
                    <X size={12} />
                  </button>
                ) : (
                  <button
                    className="join-button"
                    disabled={acting}
                    onClick={() => void activity(state.activity!.kind)}
                  >
                    陪她一起
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="idle-note">
                <span className="small-label">此刻</span>
                <p>
                  {locationId === 'home' ? '在家里悠闲地待着' : `在${place.name}待一会儿`}
                  <Leaf size={14} />
                </p>
              </div>
            )}
          </aside>
          <div className="room-labels">
            <span>{locationId === 'home' ? '客厅 · 餐厨' : place.district}</span>
            <span>{locationId === 'home' ? '卧室 · 浴室' : '和 Echo 在一起'}</span>
          </div>
          <div className="place-controls">
            <button
              className="place-map-button"
              onClick={() => setShowMap(true)}
              disabled={acting || sending || !!journey}
            >
              <Map size={18} />
              <span>生活地图</span>
            </button>
            {focus && (
              <button
                className="back-overview"
                onClick={() => {
                  setFocus(null);
                  setSelected(null);
                  setZoom(1);
                }}
              >
                <ArrowLeft size={15} />
                <span>返回全景</span>
              </button>
            )}
            {focus && state.activity?.together && (
              <button
                className="close-activity"
                disabled={acting}
                onClick={() => void action('/activity/cancel', {})}
              >
                <X size={14} />
                <span>结束这次活动</span>
              </button>
            )}
          </div>
          <div className="camera-controls">
            <IconButton
              label="近景镜头"
              active={!!focus}
              onClick={() => {
                if (focus) {
                  setFocus(null);
                  setSelected(null);
                  setZoom(1);
                } else
                  selectFurniture(
                    state.activity?.kind || (locationId === 'home' ? 'eat' : dockActivities[0]),
                  );
              }}
            >
              <Focus size={17} />
            </IconButton>
            <IconButton
              label="缩小视角"
              onClick={() => setZoom((z) => Math.max(0.65, z - 0.15))}
              disabled={zoom <= 0.65}
            >
              <Minus size={17} />
            </IconButton>
            <IconButton
              label="放大视角"
              onClick={() => setZoom((z) => Math.min(1.75, z + 0.15))}
              disabled={zoom >= 1.75}
            >
              <Plus size={17} />
            </IconButton>
            <span />
            <IconButton
              label="重置视角"
              onClick={() => {
                setReset((r) => r + 1);
                setZoom(1);
                setFocus(null);
                setSelected(null);
              }}
            >
              <RotateCcw size={16} />
            </IconButton>
            <IconButton label="全屏" onClick={() => void fullscreen()}>
              <Maximize2 size={16} />
            </IconButton>
          </div>
          {selected && !state.activity?.together && (
            <div className="furniture-popover">
              <div className="furniture-icon">
                {(() => {
                  const Icon = icons[selected];
                  return <Icon size={25} />;
                })()}
              </div>
              <div>
                <span className="small-label">{ACTIVITIES[selected].room}</span>
                <h3>{ACTIVITIES[selected].label}</h3>
              </div>
              <button
                className="primary"
                disabled={
                  acting ||
                  Boolean(state.activity?.together) ||
                  (selected === 'eat' && state.meals < 1)
                }
                onClick={() => void activity(selected)}
              >
                邀请 Echo
                <ArrowUpRight size={15} />
              </button>
              <IconButton label="关闭活动" onClick={() => setSelected(null)}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          <div className="activity-dock">
            <span className="dock-label">和她一起</span>
            {dockActivities.map((kind) => {
              const Icon = icons[kind];
              return (
                <button
                  key={kind}
                  title={
                    kind === 'eat' && state.meals < 1 ? '先准备一份料理' : ACTIVITIES[kind].label
                  }
                  disabled={
                    acting ||
                    Boolean(state.activity?.together) ||
                    (kind === 'eat' && state.meals < 1)
                  }
                  onClick={() => void activity(kind)}
                  className={state.activity?.kind === kind ? 'selected' : ''}
                >
                  <Icon size={21} />
                  <span>
                    {(
                      { cook: '做饭', eat: '吃饭', tv: '看电视', rest: '休息' } as Record<
                        string,
                        string
                      >
                    )[kind] || ACTIVITIES[kind].label}
                  </span>
                </button>
              );
            })}
            {locationId === 'home' && (
              <>
                <span className="dock-divider" />
                <button
                  aria-label="更多活动"
                  onClick={() => setMore(!more)}
                  className={more ? 'selected' : ''}
                >
                  <Plus size={21} />
                  <span>更多</span>
                </button>
              </>
            )}
            {more && (
              <div className="more-menu">
                {(['tea', 'water', 'read', 'wash'] as ActivityKind[]).map((kind) => {
                  const Icon = icons[kind];
                  return (
                    <button
                      key={kind}
                      disabled={acting || Boolean(state.activity?.together)}
                      onClick={() => void activity(kind)}
                    >
                      <Icon size={17} />
                      {ACTIVITIES[kind].label}
                      <ChevronRight size={14} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button className="mobile-chat-toggle" onClick={() => setMobileChat(true)}>
            <MessageCircle size={22} />
            <span>和 Echo 聊聊</span>
            <span className="status-dot" />
          </button>
          {journey && (
            <div className={`journey-overlay ${journey.phase}`} role="status" aria-live="polite">
              <Map size={30} />
              <span>
                {journey.phase === 'leaving'
                  ? `正在前往${PLACES[journey.destination].name}`
                  : `抵达${place.name}`}
              </span>
              <small>你 · Echo</small>
            </div>
          )}
        </section>
        {view !== 'home' && (
          <section className="page-overlay">
            <div className="page-title">
              <div>
                <span className="eyebrow">
                  {view === 'journal' ? 'LITTLE THINGS, TOGETHER' : 'A DAY AT HOME'}
                </span>
                <h2>
                  {view === 'journal' ? '回忆手记' : '今日生活'}
                  <Flower2 size={26} />
                </h2>
                <p>
                  {view === 'journal'
                    ? '那些想要好好记住的小事。'
                    : `第 ${state.day} 天 · ${time(state.minute)}`}
                </p>
              </div>
              <IconButton label="返回小家" onClick={() => setView('home')}>
                <X size={20} />
              </IconButton>
            </div>
            {view === 'journal' ? (
              <>
                <div className="filter-tabs">
                  <button
                    className={journalFilter === 'all' ? 'active' : ''}
                    onClick={() => setJournalFilter('all')}
                  >
                    全部回忆<span>{state.memories.length}</span>
                  </button>
                  <button
                    className={journalFilter === 'preference' ? 'active' : ''}
                    onClick={() => setJournalFilter('preference')}
                  >
                    关于你
                  </button>
                </div>
                <div className="memory-list">
                  {state.memories
                    .filter((m) => journalFilter === 'all' || m.kind === 'preference')
                    .map((memory) => (
                      <article className="memory-entry" key={memory.id}>
                        <span className={`memory-symbol ${memory.kind}`}>
                          {memory.kind === 'preference' ? (
                            <Heart size={20} />
                          ) : memory.kind === 'milestone' ? (
                            <Home size={20} />
                          ) : (
                            <Flower2 size={20} />
                          )}
                        </span>
                        <div>
                          <span className="small-label">
                            第 {memory.day} 天 · {time(memory.minute)}
                          </span>
                          <h3>{memory.title}</h3>
                          <p>{memory.text}</p>
                        </div>
                      </article>
                    ))}
                  {journalFilter === 'preference' && !state.preferences.length && (
                    <div className="empty-state">
                      <Heart size={30} />
                      <h3>还在慢慢了解你</h3>
                      <p>属于你的小偏好，会被珍藏在这里。</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="routine-summary">
                  <Sun size={27} />
                  <div>
                    <h3>{current ? `Echo 正在${current.verb}` : '一段自由自在的时光'}</h3>
                    <p>
                      {state.meals} 份家常料理已备好 · {state.completed.length} 种共同经历
                    </p>
                  </div>
                </div>
                <div className="schedule">
                  {[
                    {
                      t: '07:00',
                      title: '早安，小家',
                      text: '洗漱、早餐，给新的一天留一点从容。',
                      icon: Sun,
                    },
                    {
                      t: '10:00',
                      title: '各自的小爱好',
                      text: '读书、照顾植物，也会想和你说说话。',
                      icon: Leaf,
                    },
                    {
                      t: '12:00',
                      title: '好好吃饭',
                      text: '饿了就准备料理，累了就休息一会儿。',
                      icon: Utensils,
                    },
                    {
                      t: '17:00',
                      title: '厨房里的香气',
                      text: '开始准备晚餐，期待你一起过来。',
                      icon: CookingPot,
                    },
                    {
                      t: '20:00',
                      title: '慢一点的夜晚',
                      text: '泡茶、看电影，分享今天的小事。',
                      icon: Moon,
                    },
                    {
                      t: '23:00',
                      title: '晚安，明天见',
                      text: '放下今天的忙碌，补充好精神。',
                      icon: BedDouble,
                    },
                  ].map((item, i, arr) => {
                    const hour = state.minute / 60;
                    const h = Number(item.t.slice(0, 2));
                    const next = i < arr.length - 1 ? Number(arr[i + 1].t.slice(0, 2)) : 31;
                    return (
                      <article key={item.t} className={hour >= h && hour < next ? 'current' : ''}>
                        <time>{item.t}</time>
                        <span className="schedule-icon">
                          <item.icon size={19} />
                        </span>
                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.text}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
        <aside className="chat-panel" aria-label="与 Echo 聊天">
          <div className="chat-heading">
            <button
              className="mobile-back icon-button"
              onClick={() => setMobileChat(false)}
              aria-label="返回小家"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="echo-portrait">
              <div className="portrait-hair" />
              <div className="portrait-face">
                <i />
                <i />
                <span />
              </div>
              <Flower2 size={13} />
            </div>
            <div className="chat-name">
              <h2>
                Echo
                <span className="status-dot" />
              </h2>
              <p>{state.mood}</p>
            </div>
            <button className="chat-mode" onClick={() => setShowSettings(true)} title="模型设置">
              {state.configured ? '自定义模型' : '本地对话'}
              <Settings2 size={12} />
            </button>
          </div>
          <div className="chat-date">
            <span />第 {state.day} 天 · {place.name}
            <span />
          </div>
          <div
            className="chat-log"
            ref={log}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            onScroll={() => {
              if (!log.current) return;
              const near =
                log.current.scrollHeight - log.current.scrollTop - log.current.clientHeight < 60;
              setAutoScroll(near);
              if (near) setUnread(false);
            }}
          >
            {state.messages.map((m, index) => (
              <div className={`message ${m.role}`} key={m.id}>
                {m.role === 'assistant' && <span className="message-avatar">E</span>}
                <div className="message-body">
                  {(index === 0 || state.messages[index - 1].role !== m.role) && (
                    <div className="message-meta">
                      {m.role === 'assistant' ? 'Echo' : state.playerName}
                      <time>{time(m.minute)}</time>
                    </div>
                  )}
                  <p>{m.content}</p>
                  {m.source === 'life' && index > 0 && (
                    <span className="message-source">
                      <Leaf size={10} />
                      共同的日常
                    </span>
                  )}
                </div>
              </div>
            ))}
            {pendingMessage && (
              <>
                <div className="message user">
                  <div className="message-body">
                    <div className="message-meta">{state.playerName}</div>
                    <p>{pendingMessage}</p>
                  </div>
                </div>
                <div className="typing">
                  <span />
                  <span />
                  <span />
                  <small>Echo 正在想怎么说</small>
                </div>
              </>
            )}
          </div>
          {unread && !autoScroll && (
            <button
              className="new-message"
              onClick={() => {
                setAutoScroll(true);
                setUnread(false);
              }}
            >
              <ArrowDown size={14} />
              新消息
            </button>
          )}
          <div className="chat-bottom">
            <div className="suggestion-heading">
              <Sparkles size={13} />
              此刻想说
            </div>
            <div className="suggestions">
              {suggestions.map((text) => (
                <button key={text} disabled={sending || !connected} onClick={() => void send(text)}>
                  {text}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
            <form
              className="chat-composer"
              ref={chatForm}
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
            >
              <textarea
                ref={input}
                placeholder="和 Echo 说点什么…"
                aria-label="和 Echo 说点什么"
                value={draft}
                disabled={sending}
                maxLength={1500}
                rows={2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    chatForm.current?.requestSubmit();
                  }
                }}
              />
              <div className="composer-footer">
                <span>
                  {draft.length > 1200 ? (
                    `${draft.length}/1500`
                  ) : (
                    <>
                      <Flower2 size={13} />
                      慢慢说，我在听
                    </>
                  )}
                </span>
                <button
                  type="submit"
                  aria-label="发送消息"
                  disabled={sending || !draft.trim() || !connected}
                >
                  {sending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
            <div className="chat-footer">
              <Heart size={11} />
              把平凡的日子，过成我们的故事
            </div>
          </div>
        </aside>
      </main>
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <IconButton label="关闭提示" onClick={() => setError('')}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {showSettings && <SettingsDialog onClose={closeSettings} onSaved={() => void refresh()} />}
      {showMap && (
        <CityMap
          current={locationId}
          onClose={() => setShowMap(false)}
          onTravel={(id) => void travelTo(id)}
          busy={acting || sending || !!journey || !connected}
        />
      )}
    </div>
  );
}
