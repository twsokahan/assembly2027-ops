const clockOf = (fetchedAt) => fetchedAt.slice(11, 16);

export function statusLine(kind, fetchedAt) {
  const clock = clockOf(fetchedAt);
  if (kind === "refreshing") return { text: `上次更新 ${clock}，更新中…`, alert: false };
  if (kind === "offline") return { text: `連不上，顯示的是 ${clock} 的資料`, alert: true };
  return { text: `更新於 ${clock}`, alert: false };
}
