import { ACCENT } from "./theme.js?v=3";

const SHAPES = {
  late: (x, y, s, color) =>
    `<rect x="${x - s * 0.09}" y="${y - s * 0.5}" width="${s * 0.18}" height="${s * 0.62}" rx="${s * 0.09}" fill="${color}"/>` +
    `<circle cx="${x}" cy="${y + s * 0.38}" r="${s * 0.12}" fill="${color}"/>`,
  check: (x, y, s, color) =>
    `<path d="M${x - s * 0.4} ${y} L${x - s * 0.1} ${y + s * 0.32} L${x + s * 0.42} ${y - s * 0.3}" fill="none" stroke="${color}" stroke-width="${s * 0.16}" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export function icon(kind, cx, cy, size, color = ACCENT) {
  return SHAPES[kind](cx, cy, size, color);
}

export function inlineIcon(kind, size = 14, color = ACCENT) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${icon(kind, size / 2, size / 2, size * 0.8, color)}</svg>`;
}
