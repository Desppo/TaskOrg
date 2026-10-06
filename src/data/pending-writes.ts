// Writes belong to the database, not to a screen's lifetime. Keep the latest
// failed write available for retry before exporting or replacing any data.
type Write = { run: () => Promise<unknown>; promise: Promise<unknown> };
const queues = new WeakMap<object, Map<string, Write>>();

export function queueWrite(db: object, key: string, run: () => Promise<unknown>): Promise<unknown> {
  let queue = queues.get(db);
  if (!queue) { queue = new Map(); queues.set(db, queue); }
  const previous = queue.get(key)?.promise ?? Promise.resolve();
  const write: Write = { run, promise: previous.catch(() => undefined).then(run) };
  queue.set(key, write);
  void write.promise.then(() => {
    if (queue.get(key) === write) queue.delete(key);
  }, () => undefined);
  return write.promise;
}

export async function flushPendingWrites(db: object): Promise<void> {
  const queue = queues.get(db);
  while (queue?.size) {
    await Promise.all([...queue.entries()].map(async ([key, write]) => {
      try { await write.promise; }
      catch {
        // A newer edit supersedes this failure; the loop will wait for it.
        if (queue.get(key) === write) await queueWrite(db, key, write.run);
      }
    }));
  }
}
