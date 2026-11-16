import { PAPER, INK, MUTED, ACCENT } from "./theme.js?v=5";

export const FONT_STACK = "'Noto Sans TC', 'PingFang TC', sans-serif";

const escapeXml = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const n = (value) => Number(value.toFixed(1));

const estimateWidth = (s, size) => [...s].reduce((sum, ch) => sum + (ch.codePointAt(0) < 0x2000 ? 0.55 : 1) * size, 0);
let measurer = estimateWidth;

export function setTextMeasurer(fn) {
  measurer = fn ?? estimateWidth;
}

export function textWidth(s, size, weight = 400) {
  return measurer(s, size, weight);
}

export function text(x, y, s, size, { color = INK, weight = 400, anchor = "start", extra = "" } = {}) {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${extra}>${escapeXml(s)}</text>`;
}

function star(cx, cy, s, color) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = s * (i % 2 === 0 ? 0.5 : 0.21);
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${n(cx + r * Math.cos(a))},${n(cy + r * Math.sin(a))}`;
  });
  return `<polygon points="${points.join(" ")}" fill="${color}"/>`;
}

const SHAPES = {
  group: (x, y, s, color) => {
    const r = s * 0.3;
    return `<rect x="${n(x - r)}" y="${n(y - r)}" width="${n(2 * r)}" height="${n(2 * r)}" rx="1" fill="${color}"/>`;
  },
  meeting: (x, y, s, color) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 0.36)}" fill="${color}"/>`,
  stop: (x, y, s) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 0.32)}" fill="none" stroke="${MUTED}" stroke-width="1.6"/>`,
  signup: (x, y, s, color) => {
    const left = x - s * 0.32;
    const top = y - s * 0.48;
    return (
      `<path d="M${n(left)},${n(y + s * 0.48)} V${n(top)}" stroke="${color}" stroke-width="${n(Math.max(1.4, s * 0.11))}" stroke-linecap="round"/>` +
      `<path d="M${n(left)},${n(top)} L${n(x + s * 0.44)},${n(top + s * 0.26)} L${n(left)},${n(top + s * 0.52)} Z" fill="${color}"/>`
    );
  },
  train: (x, y, s, color) => diamond(x, y, s * 0.42, color, "none"),
  star,
  late: (x, y, s, color) =>
    `<rect x="${x - s * 0.09}" y="${y - s * 0.5}" width="${s * 0.18}" height="${s * 0.62}" rx="${s * 0.09}" fill="${color}"/>` +
    `<circle cx="${x}" cy="${y + s * 0.38}" r="${s * 0.12}" fill="${color}"/>`,
  check: (x, y, s, color) =>
    `<path d="M${x - s * 0.4} ${y} L${x - s * 0.1} ${y + s * 0.32} L${x + s * 0.42} ${y - s * 0.3}" fill="none" stroke="${color}" stroke-width="${s * 0.16}" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export function icon(kind, cx, cy, size, color = INK) {
  if (!(kind in SHAPES)) throw new Error(`unknown icon: ${kind}`);
  return SHAPES[kind](cx, cy, size, color);
}

export function inlineIcon(kind, size = 14, color = ACCENT) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${icon(kind, size / 2, size / 2, size * 0.8, color)}</svg>`;
}

export function diamond(cx, cy, r, fill, stroke = PAPER) {
  const stroked = stroke === "none" ? "" : ` stroke="${stroke}" stroke-width="2"`;
  return `<path d="M${n(cx)},${n(cy - r)} L${n(cx + r)},${n(cy)} L${n(cx)},${n(cy + r)} L${n(cx - r)},${n(cy)} Z" fill="${fill}"${stroked}/>`;
}

export function hatchDefs() {
  return '<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#3c3730" stroke-opacity=".26" stroke-width="1.6"/></pattern></defs>';
}

export function arrowDefs() {
  return `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>`;
}

export function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="font-family:${FONT_STACK}">${hatchDefs()}<rect width="${w}" height="${h}" fill="${PAPER}"/>${body}</svg>`;
}
