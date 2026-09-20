'use client'

// 车牌专用键盘：省份简称 → 字母 → 字母数字逐段切换，杜绝系统键盘中英切换与脏字符
// （自旧 client/src/components/PlateKeyboard.vue 移植，弹层改用 BottomSheet）
import { useEffect, useState } from 'react'
import BottomSheet from '@/components/mobile/BottomSheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  PROVINCES, PLATE_LETTERS, PLATE_ALNUM,
  PLATE_NORMAL_LEN, PLATE_NE_LEN
} from '@/lib/plate'
import { cn } from '@/lib/utils'

interface PlateKeyboardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onChange: (value: string) => void
}

export default function PlateKeyboard({ open, onOpenChange, value, onChange }: PlateKeyboardProps) {
  // 新能源标记：8 位已达上限时自动勾上（从 OCR/手输回填的场景）
  const [isNewEnergy, setIsNewEnergy] = useState(false)

  // 打开时按现有值长度初始化新能源态
  useEffect(() => {
    if (open) setIsNewEnergy(value.length > PLATE_NORMAL_LEN)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 取消新能源时截断超出的第 8 位
  useEffect(() => {
    if (!isNewEnergy && value.length > PLATE_NORMAL_LEN) {
      onChange(value.slice(0, PLATE_NORMAL_LEN))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewEnergy])

  const cellCount = isNewEnergy ? PLATE_NE_LEN : PLATE_NORMAL_LEN
  const reachedLimit = value.length >= cellCount

  // 按键输入（达上限后忽略）
  const press = (ch: string) => {
    if (reachedLimit) return
    onChange(value + ch)
  }

  const keys = value.length === 0 ? PROVINCES : value.length === 1 ? PLATE_LETTERS : PLATE_ALNUM

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <div className="pb-1">
        {/* 预览区：格子化展示当前输入 */}
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <div className="flex flex-1 gap-1">
            {Array.from({ length: cellCount }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'flex h-[38px] flex-1 items-center justify-center rounded-md border font-mono text-[17px] font-semibold',
                  i < value.length ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--hairline-strong)] bg-[var(--surface-1)] text-[var(--ink)]',
                  i === value.length && 'border-[var(--primary-hover)]'
                )}
              >
                {value[i] || ''}
              </div>
            ))}
          </div>
          <label className="flex shrink-0 items-center gap-1.5 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            <Checkbox
              checked={isNewEnergy}
              onCheckedChange={v => setIsNewEnergy(!!v)}
              className="h-3.5 w-3.5"
            />
            新能源
          </label>
        </div>

        {/* 键盘面板：按已输入长度自动切换段位（省份网格 / 字母 / 字母数字） */}
        <div className="grid grid-cols-9 gap-1.5">
          {keys.map(k => (
            <button
              key={k}
              type="button"
              className="pressable h-[42px] rounded-lg border font-mono text-[16px]"
              style={{
                borderColor: 'var(--hairline)',
                background: 'var(--surface-1)',
                color: 'var(--ink-muted)'
              }}
              disabled={value.length !== 0 && reachedLimit}
              onClick={() => press(k)}
            >
              {k}
            </button>
          ))}
        </div>

        {/* 功能键行 */}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onChange(value.slice(0, -1))}>删格</Button>
          <Button variant="outline" size="sm" onClick={() => onChange('')}>清空</Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>完成</Button>
        </div>
      </div>
    </BottomSheet>
  )
}
