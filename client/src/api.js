import axios from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Base Axios instance (kept for backward compatibility)
const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' })

// Attach JWT if present on every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// React hooks API
export function useApi() {
  // Recompute when baseURL env changes at build time; token is injected per-request by interceptor
  const instance = useMemo(() => API, [])
  return instance
}

export function useGet(path, { params, enabled = true, config } = {}, deps = []) {
  const api = useApi()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const controllerRef = useRef(null)

  const fetcher = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    controllerRef.current?.abort?.()
    controllerRef.current = new AbortController()
    try {
      const res = await api.get(path, { ...(config || {}), params, signal: controllerRef.current.signal })
      setData(res.data)
      return res.data
    } catch (err) {
      const isCanceled = err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError'
      if (!isCanceled) setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [api, path, JSON.stringify(params), enabled, JSON.stringify(config)])

  useEffect(() => {
    if (enabled) fetcher().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.abort?.()
    }
  }, [])

  const refetch = useCallback(() => fetcher(), [fetcher])
  return { data, error, loading, refetch }
}

export function useMutation(method, basePath) {
  const api = useApi()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const mutate = useCallback(async (payload = undefined, { path = basePath, config } = {}) => {
    setLoading(true)
    setError(null)
    try {
      let res
      switch (method.toLowerCase()) {
        case 'post':
          res = await api.post(path, payload, config)
          break
        case 'put':
          res = await api.put(path, payload, config)
          break
        case 'patch':
          res = await api.patch(path, payload, config)
          break
        case 'delete':
          // axios.delete signature: (url, config)
          res = await api.delete(path, config)
          break
        default:
          res = await api.request({ url: path, method, data: payload, ...(config || {}) })
      }
      setData(res.data)
      return res.data
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [api, method, basePath])

  return { mutate, data, error, loading }
}

// Shorthands
export const usePost = (path) => useMutation('post', path)
export const usePut = (path) => useMutation('put', path)
export const usePatch = (path) => useMutation('patch', path)
export const useDelete = (path) => useMutation('delete', path)

// Keep default export for existing imports
export default API

