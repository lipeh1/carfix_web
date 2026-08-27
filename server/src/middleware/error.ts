import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('[Error]', err.message)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message })
  }
  res.status(500).json({ message: err.message || '服务器内部错误' })
}

// 回调参数显式声明为 Express 类型，路由内联处理函数可借此获得类型上下文，
// 避免 strict 模式下每个 (req, res) 参数都报 TS7006 隐式 any
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
