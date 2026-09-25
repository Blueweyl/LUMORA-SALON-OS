let counter = 0;

export function makeId(prefix: string): string {
  counter += 1;
  // Time + counter keeps ids ordered; the random part avoids collisions between two open windows.
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
