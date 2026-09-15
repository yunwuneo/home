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
