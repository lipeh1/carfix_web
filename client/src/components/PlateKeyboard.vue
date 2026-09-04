<!-- 车牌专用键盘：省份简称 → 字母 → 字母数字逐段切换，杜绝系统键盘中英切换与脏字符 -->
<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="plate-kb">
      <!-- 预览区：格子化展示当前输入 -->
      <div class="kb-header">
        <div class="cells" :class="{ ne: isNewEnergy }">
          <div
            v-for="i in cellCount"
            :key="i"
            class="cell"
            :class="{ filled: i <= modelValue.length, cursor: i === modelValue.length + 1 }"
          >
            {{ modelValue[i - 1] || '' }}
          </div>
        </div>
        <div class="header-ops">
          <van-checkbox v-model="isNewEnergy" shape="square" icon-size="14px">新能源</van-checkbox>
        </div>
      </div>

      <!-- 键盘面板：按已输入长度自动切换段位 -->
      <div class="kb-panel">
        <!-- 第 1 位：省份网格 -->
        <template v-if="modelValue.length === 0">
          <button
            v-for="p in PROVINCES"
            :key="p"
            class="key province"
            type="button"
            @click="press(p)"
          >{{ p }}</button>
        </template>
        <!-- 第 2 位：字母 -->
        <template v-else-if="modelValue.length === 1">
          <button
            v-for="k in PLATE_LETTERS"
            :key="k"
            class="key"
            type="button"
            :disabled="reachedLimit"
            @click="press(k)"
          >{{ k }}</button>
        </template>
        <!-- 后段：字母数字混合 -->
        <template v-else>
          <button
            v-for="k in PLATE_ALNUM"
            :key="k"
            class="key alnum"
            type="button"
            :disabled="reachedLimit"
            @click="press(k)"
          >{{ k }}</button>
        </template>
      </div>

      <!-- 功能键行 -->
      <div class="kb-actions">
        <van-button size="small" plain @click="backspace">删格</van-button>
        <van-button size="small" plain @click="clearAll">清空</van-button>
        <van-button size="small" type="primary" @click="finish">完成</van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  PROVINCES, PLATE_LETTERS, PLATE_ALNUM,
  PLATE_NORMAL_LEN, PLATE_NE_LEN
} from '@/utils/plate'

const props = defineProps<{
  show: boolean
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'update:modelValue', v: string): void
}>()

// 新能源标记：8 位已达上限时自动勾上（从 OCR/手输回填的场景）
const isNewEnergy = ref(false)

const cellCount = computed(() => (isNewEnergy.value ? PLATE_NE_LEN : PLATE_NORMAL_LEN))
const reachedLimit = computed(() => props.modelValue.length >= cellCount.value)

// 打开时按现有值长度初始化新能源态；关闭切换截断超出部分
watch(
  () => props.show,
  (open) => {
    if (open) {
      isNewEnergy.value = props.modelValue.length > PLATE_NORMAL_LEN
    }
  }
)
watch(isNewEnergy, (ne) => {
  if (!ne && props.modelValue.length > PLATE_NORMAL_LEN) {
    emit('update:modelValue', props.modelValue.slice(0, PLATE_NORMAL_LEN))
  }
})

// 按键输入（达上限后忽略）
const press = (ch: string) => {
  if (reachedLimit.value) return
  emit('update:modelValue', props.modelValue + ch)
}

// 删除最后一位
const backspace = () => {
  emit('update:modelValue', props.modelValue.slice(0, -1))
}

// 清空后回到省份面板
const clearAll = () => {
  emit('update:modelValue', '')
}

// 完成：格式不对也允许关闭，由表单提交时统一校验提示
const finish = () => {
  emit('update:show', false)
}
</script>

<style scoped>
.plate-kb {
  padding: 16px 12px calc(16px + env(safe-area-inset-bottom));
}
/* 预览格子 */
.kb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.cells {
  display: flex;
  gap: 4px;
  flex: 1;
}
.cell {
  flex: 1;
  height: 38px;
  border: 1px solid var(--hairline-strong);
  border-radius: 6px;
  background: var(--surface-1);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cell.filled {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.cell.cursor {
  border-color: var(--primary-hover);
}
.header-ops {
  flex-shrink: 0;
}
/* 键盘网格 */
.kb-panel {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 6px;
}
.key {
  height: 42px;
  border: 1px solid var(--hairline);
  border-radius: 8px;
  background: var(--surface-1);
  color: var(--ink-muted);
  font-size: 16px;
  font-family: var(--font-mono);
  cursor: pointer;
  user-select: none;
}
.key:active {
  background: var(--surface-2);
  color: var(--ink);
}
.key:disabled {
  opacity: 0.35;
  cursor: default;
}
/* 功能键行 */
.kb-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
