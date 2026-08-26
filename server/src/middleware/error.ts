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

export const asyncHandler = (fn: Function) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
