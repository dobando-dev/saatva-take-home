// Browser-only helpers: relative URLs go through the /api rewrite in next.config.mjs, so requests
// are same-origin and the BFF's cookies land on the web origin. Server Components use
// lib/server-api.ts instead.

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`GET ${path} failed (${res.status})`)
  }
  return (await res.json()) as T
}

export async function apiSend<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status})`)
  }
  return (await res.json()) as T
}
