'use client'

// 命令式确认弹窗：对等旧版 vant 的 showConfirmDialog，调用处只需 await confirm({...})
import { createContext, useCallback, useContext, useState } from 'react'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog'

interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  /** 确认按钮危险样式（删除/取消工单等破坏性操作） */
  danger?: boolean
}

interface ConfirmEntry {
  options: ConfirmOptions
  resolve: (v: boolean) => void
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

// 页面里调用：const confirm = useConfirm(); if (await confirm({ title: '...' })) {...}
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = useState<ConfirmEntry | null>(null)

  const confirm = useCallback<ConfirmFn>(
    options => new Promise<boolean>(resolve => setEntry({ options, resolve })),
    []
  )

  const settle = (v: boolean) => {
    entry?.resolve(v)
    setEntry(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!entry} onOpenChange={open => { if (!open) settle(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{entry?.options.title}</AlertDialogTitle>
            {entry?.options.message && (
              <AlertDialogDescription className="whitespace-pre-line">
                {entry.options.message}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {entry?.options.cancelText ?? '取消'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={entry?.options.danger ? 'bg-destructive text-white hover:bg-destructive/90' : ''}
            >
              {entry?.options.confirmText ?? '确定'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
