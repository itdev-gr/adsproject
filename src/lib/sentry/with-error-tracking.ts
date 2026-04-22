import * as Sentry from '@sentry/nextjs'

export function withErrorTracking<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      Sentry.captureException(err)
      throw err
    }
  }
}
