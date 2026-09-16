export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(32000),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || '暂时无法连接到家。', data.code);
  return data;
}

export async function chatStream<T>(body: unknown, onDelta: (text: string) => void): Promise<T> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
  if (!response.ok || response.headers.get('content-type')?.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) throw new ApiError(data.error || '消息暂时没有送达。', data.code);
    return data;
  }
  const reader = response.body!.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    state: T | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      if (done && buffer) lines.push(buffer);
      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line);
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'delta') onDelta(event.text);
        if (event.type === 'done') state = event.state;
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!state) throw new Error('回复接收中断，点击重试即可继续。');
  return state;
}
