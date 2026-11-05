"use client"

import * as React from "react"

export async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json as T
}

type Interval<T> = number | false | ((data: T) => number | false)

/**
 * Loads `path` and keeps polling it while `interval` (a number of ms, or a
 * function of the latest data) says so. Returns the data plus `reload`.
 */
export function useApi<T>(path: string | null, interval?: Interval<T>) {
  const [data, setData] = React.useState<T>()
  const [error, setError] = React.useState<string>()
  const [tick, setTick] = React.useState(0)
  const pathRef = React.useRef(path)
  const intervalRef = React.useRef(interval)

  React.useEffect(() => {
    pathRef.current = path
    intervalRef.current = interval
  })

  const reload = React.useCallback(async () => {
    const current = pathRef.current
    if (!current) return
    try {
      const result = await api<T>(current)
      if (pathRef.current === current) {
        setData(result)
        setError(undefined)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setTick((t) => t + 1)
    }
  }, [])

  React.useEffect(() => {
    pathRef.current = path
    void reload()
  }, [path, reload])

  // Each completed load schedules the next one, if polling is on.
  React.useEffect(() => {
    const spec = intervalRef.current
    if (!path || !spec || data === undefined) return
    const delay = typeof spec === "function" ? spec(data) : spec
    if (!delay) return
    const id = setTimeout(reload, delay)
    return () => clearTimeout(id)
  }, [tick, data, path, reload])

  return { data, error, reload, setData }
}

export function timeAgo(iso?: string) {
  if (!iso) return ""
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString()
}
