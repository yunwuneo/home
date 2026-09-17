export function baseURL(value) {
  const url = new URL(value.trim().replace(/\/+$/, ''));
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['https:', 'http:'].includes(url.protocol)
  )
    throw new Error('模型地址格式不正确。');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('远程模型地址需要 HTTPS。');
  return url.href.replace(/\/+$/, ''); // Preserve non-OpenAI provider prefixes.
}
export async function aiRequest(provider, path, body, signal) {
  const response = await fetch(`${baseURL(provider.baseUrl)}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(90000)])
      : AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`模型服务 ${path} 返回 ${response.status}。`);
  return response;
}
export async function modelMessage(provider, model, messages, tools, signal, options = {}) {
  const response = await aiRequest(
    provider,
    '/chat/completions',
    {
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1800,
      ...(tools?.length ? { tools } : {}),
      stream: false,
      ...options,
    },
    signal,
  );
  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message || (!message.content && !message.tool_calls?.length))
    throw new Error('模型没有返回有效回复。');
  return message;
}
export async function embeddings(provider, model, input, signal) {
  const response = await aiRequest(
    provider,
    '/embeddings',
    { model, input, encoding_format: 'float' },
    signal,
  );
  const data = await response.json();
  const vectors = data.data?.sort((a, b) => a.index - b.index).map((x) => x.embedding);
  if (
    vectors?.length !== input.length ||
    vectors.some((v) => !Array.isArray(v) || !v.length || v.some((n) => !Number.isFinite(n)))
  )
    throw new Error('向量服务返回了无效数据。');
  return vectors;
}
