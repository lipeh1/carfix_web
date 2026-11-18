'use client'

// 消息提示出口：主题跟随系统，字体和实色面板沿用工作台令牌
import { useEffect, useState } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function useSystemTheme(): 'light' | 'dark' {
  const [dark, setDark] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return dark ? 'dark' : 'light'
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSystemTheme()

  return (
    <Sonner
      theme={theme}
      position="top-center"
      className="toaster group"
      style={
        {
          fontFamily: 'var(--type-sans)',
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)'
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
