import { BLEED_PX, CARD_W_CUT, CARD_H_CUT } from '../constants.js';

// Pure geometry for canvas edge-replicated bleed (the equivalent of sharp's
// extend({ extendWith: 'copy' })): a list of drawImage operations mapping
// source rects on the cut-size face to destination rects on the bleed canvas.
// 1px edge strips and corner pixels are stretched into the bleed margin.
export function bleedOps({ w = CARD_W_CUT, h = CARD_H_CUT, b = BLEED_PX } = {}) {
  return [
    { sx: 0, sy: 0, sw: w, sh: h, dx: b, dy: b, dw: w, dh: h }, // face
    { sx: 0, sy: 0, sw: w, sh: 1, dx: b, dy: 0, dw: w, dh: b }, // top edge
    { sx: 0, sy: h - 1, sw: w, sh: 1, dx: b, dy: b + h, dw: w, dh: b }, // bottom edge
    { sx: 0, sy: 0, sw: 1, sh: h, dx: 0, dy: b, dw: b, dh: h }, // left edge
    { sx: w - 1, sy: 0, sw: 1, sh: h, dx: b + w, dy: b, dw: b, dh: h }, // right edge
    { sx: 0, sy: 0, sw: 1, sh: 1, dx: 0, dy: 0, dw: b, dh: b }, // top-left corner
    { sx: w - 1, sy: 0, sw: 1, sh: 1, dx: b + w, dy: 0, dw: b, dh: b }, // top-right corner
    { sx: 0, sy: h - 1, sw: 1, sh: 1, dx: 0, dy: b + h, dw: b, dh: b }, // bottom-left corner
    { sx: w - 1, sy: h - 1, sw: 1, sh: 1, dx: b + w, dy: b + h, dw: b, dh: b }, // bottom-right corner
  ];
}
