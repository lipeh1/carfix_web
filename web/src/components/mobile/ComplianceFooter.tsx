'use client'
// 备案信息页脚：工信部要求网站底部展示 ICP 备案号并链接至工信部备案系统，
// 公安联网备案通过后还需展示公安备案号并链接至公安备案平台
// 未配置任何备案号时整体不渲染，本地开发与备案前不会出现空白占位
import { useEffect, useState } from 'react'

interface SiteInfo {
  icp: string
  police: string
}

export default function ComplianceFooter() {
  const [info, setInfo] = useState<SiteInfo | null>(null)

  useEffect(() => {
    // 公开接口，失败静默——页脚缺失不影响主流程
    fetch('/api/site-info')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setInfo(data))
      .catch(() => setInfo(null))
  }, [])

  if (!info?.icp && !info?.police) return null

  return (
    <div
      className="mt-6 flex flex-col items-center gap-1 text-[11px]"
      style={{ color: 'var(--ink-tertiary)' }}
    >
      {info.icp && (
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="pressable hover:underline"
        >
          {info.icp}
        </a>
      )}
      {info.police && (
        <a
          href="https://beian.mps.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="pressable hover:underline"
        >
          {info.police}
        </a>
      )}
    </div>
  )
}
