'use client'

// 列表的展示状态：区分加载、空结果与失败，只允许当前筛选条件的最新响应更新页面。
import { useCallback, useEffect, useRef, useState } from 'react'

export function useListView<T>(read: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([])
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const latest = useRef(0)

  const refresh = useCallback(async () => {
    const request = ++latest.current
    setPhase('loading')
    try {
      const result = await read()
      if (request === latest.current) {
        setRows(result)
        setPhase('ready')
      }
    } catch {
      if (request === latest.current) setPhase('error')
    }
  }, [read])

  useEffect(() => {
    setRows([])
    void refresh()
    return () => { latest.current++ }
  }, [refresh])

  return { rows, phase, refresh }
}
