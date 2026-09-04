// 图片压缩工具：上传前在前端压缩，减轻弱网传输与服务器存储压力
// 接车照片等场景原图可达数 MB，压缩到长边 1600px / JPEG 0.8 后体积约降 90%，肉眼无损

export interface CompressOptions {
  /** 最长边像素上限，默认 1600 */
  maxEdge?: number
  /** JPEG 质量 0-1，默认 0.8 */
  quality?: number
  /** 小于该字节数的文件直接原样返回，默认 300KB */
  skipBelow?: number
}

const DEFAULTS: Required<CompressOptions> = {
  maxEdge: 1600,
  quality: 0.8,
  skipBelow: 300 * 1024
}

/**
 * 压缩图片文件，返回用于上传的新 File。
 * 任何情况下失败都不抛错，回退返回原文件——压缩是优化，不能阻塞上传。
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxEdge, quality, skipBelow } = { ...DEFAULTS, ...opts }

  // GIF 压缩会丢动画；过小文件不值得消耗 CPU
  if (file.type === 'image/gif' || file.size <= skipBelow) return file

  try {
    // imageOrientation: 'from-image' 让 iOS 竖拍照片按 EXIF 方向转正后再绘制，
    // 否则 canvas 重绘出的图会"躺倒"
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    )
    // toBlob 失败或压缩后反而更大（极端情况）时保留原文件
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch (e) {
    // 解码失败（损坏文件、不支持的格式等）回退原文件
    return file
  }
}
