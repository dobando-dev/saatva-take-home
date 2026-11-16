import { cookies } from 'next/headers'

const API_URL = process.env.API_URL ?? 'http://localhost:4000'

/** Server Component fetch that forwards the incoming request's cookies to the BFF. */
export async function serverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Cookie: (await cookies()).toString() },
    cache: 'no-store',
    // A hung BFF must not hang every page render; callers degrade on failure.
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) {
    throw new Error(`GET ${path} failed (${res.status})`)
  }
  return (await res.json()) as T
}
