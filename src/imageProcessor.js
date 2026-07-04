import sharp from 'sharp';
import { CARD_W_CUT, CARD_H_CUT, CARD_W_BLEED, CARD_H_BLEED, BLEED_PX, DPI } from './constants.js';

// Convert a source card image (path or Buffer) into an MPC-ready PNG:
//   1. upscale/resize the face to the final cut size at 300 DPI
//   2. add bleed by replicating the edge pixels outward
//   3. tag the output at 300 DPI
// Returns a PNG Buffer sized CARD_W_BLEED x CARD_H_BLEED.
export async function toMpcBuffer(input) {
  const face = await sharp(input)
    .resize(CARD_W_CUT, CARD_H_CUT, { fit: 'fill' })
    .toBuffer();

  return sharp(face)
    .extend({
      top: BLEED_PX,
      bottom: BLEED_PX,
      left: BLEED_PX,
      right: BLEED_PX,
      extendWith: 'copy', // edge-replicate for the bleed area
    })
    .withMetadata({ density: DPI })
    .png()
    .toBuffer();
}

// Resize a source image (path or Buffer) to the exact cut size (no bleed),
// at 300 DPI. Used for the home-print PDF sheets where cards are trimmed on
// their true 2.5x3.5in boundary.
export async function toCutBuffer(input) {
  return sharp(input)
    .resize(CARD_W_CUT, CARD_H_CUT, { fit: 'fill' })
    .withMetadata({ density: DPI })
    .png()
    .toBuffer();
}

export const MPC_OUTPUT = { width: CARD_W_BLEED, height: CARD_H_BLEED, dpi: DPI };
export const CUT_OUTPUT = { width: CARD_W_CUT, height: CARD_H_CUT, dpi: DPI };
