// 整页空态把下一步操作放在说明旁边，单据内的空项只占一行。
import type { ReactNode } from 'react'

export default function Empty({ description, page, children }: { description: string; page?: boolean; children?: ReactNode }) {
  if (!page) return <p className="empty-state">{description}</p>
  return <div className="list-empty"><p>{description}</p>{children}</div>
}
