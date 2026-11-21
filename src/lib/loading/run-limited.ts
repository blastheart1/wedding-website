/** Runs tasks in order with at most `limit` at a time. Every task is attempted even if another fails. */
export async function runLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<unknown>): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      await task(item).catch(() => undefined)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
}
