export function mix(color, t, base = "#ffffff") {
  const channels = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = channels(color);
  const b = channels(base);
  const hex = b.map((bv, k) => Math.round(bv + (a[k] - bv) * t).toString(16).padStart(2, "0"));
  return `#${hex.join("")}`;
}

export const PAPER = "#fcfcfb";
export const INK = "#1f2430";
export const INK_2 = "#4f4c46";
export const MUTED = "#8a867d";
export const RULE = "#e3e0d9";
export const DARK = "#2b3850";
export const ACCENT = "#c8372f";

export const GROUPS = ["運營本部", "前導組", "活動組", "總務組"];
export const GROUP_COLORS = { 運營本部: "#6b6860", 前導組: "#2a78d6", 活動組: "#eb6834", 總務組: "#1baf7a" };

export const PHASE_COLORS = ["#2a78d6", "#1baf7a", "#eb6834", "#8a8780", "#eda100", "#e34948", "#6250d6"];
export const PHASE_TINTS = PHASE_COLORS.map((c) => mix(c, 0.16));

export const CIRCLED = "①②③④⑤⑥⑦⑧⑨";

// [文字色, 底色, 框線色]
export const STATUS_STYLE = {
  未開始: ["#6b6860", "#ffffff", "#c9c5bc"],
  進行中: ["#1d5fae", mix("#2a78d6", 0.14), mix("#2a78d6", 0.14)],
  待決: ["#8a5a00", mix("#eda100", 0.2), mix("#eda100", 0.2)],
  完成: ["#0d6b48", mix("#1baf7a", 0.18), mix("#1baf7a", 0.18)],
  已定: ["#ffffff", DARK, DARK],
};
