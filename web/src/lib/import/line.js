// One pasted line -> the readings the resolver may choose from.
//
// The module deliberately does NOT decide between them. "Bûrat 2" is either
// two copies of Bûrat or one copy of a card called "Bûrat 2"; punctuation
// cannot settle that, but cards.json can. So this returns candidates, most
// peeled first, and resolve.js keeps the first that matches a real card.
//
// INVARIANT: the LAST candidate reproduces the pre-refactor parseLine exactly
// -- leading quantity only, nothing peeled off the end. importDeck.js's
// facade exposes it as `qty`/`name`, which is what lets test/importDeck.test.js
// pass untouched.

// A bullet needs the trailing space, so "*Bûrat*" stays emphasis rather than
// becoming a bullet.
const BULLET = /^[-*+•]\s+/;
// "1." and "2)" are enumerators and are dropped. "1" and "1x" are quantities.
// Nobody writes "3. Bûrat" meaning three copies; they write "3 Bûrat".
const ENUMERATOR = /^\d+[.)]\s+/;

const LEAD_QTY_MARKED = /^(\d+)\s*[x×]\s*(.+)$/i;
const LEAD_QTY_BARE = /^(\d+)\s+(.+)$/;

// A trailing "(...)" or "[...]" — either a quantity or a hint, decided below.
const TRAIL_GROUP = /^(.*?)\s*[([]([^)\]]*)[)\]]$/;
// A trailing bare quantity, optionally introduced by a dash: "- 2", "-2x", "x2", "2".
const TRAIL_QTY = /^(.*?)\s*(?:[-–—]\s*)?(?:x\s*(\d+)|(\d+)\s*[x×]?)$/i;
// The whole content of a group, when it is nothing but a quantity.
const ONLY_QTY = /^\s*(?:x\s*(\d+)|(\d+)\s*[x×]?)\s*$/i;

export function stripDecoration(s) {
  let out = String(s || '').trim();
  // Twice: a bullet may precede an enumerator ("- 1) Bûrat") and the reverse.
  for (let i = 0; i < 2; i += 1) out = out.replace(BULLET, '').replace(ENUMERATOR, '').trim();
  for (const wrap of [/^\*\*(.+)\*\*$/, /^__(.+)__$/, /^\*(.+)\*$/, /^_(.+)_$/, /^`(.+)`$/]) {
    const m = out.match(wrap);
    if (m) { out = m[1].trim(); break; }
  }
  return out;
}

const floor1 = (n) => (Number.isFinite(n) && n > 0 ? n : 1);

export function parseLineCandidates(raw) {
  const body = stripDecoration(raw);

  // Leading quantity, extracted once and shared by every candidate.
  let qty = 1;
  let rest = body;
  const lead = body.match(LEAD_QTY_MARKED) || body.match(LEAD_QTY_BARE);
  if (lead) { qty = floor1(parseInt(lead[1], 10)); rest = lead[2].trim(); }

  // The un-peeled reading. Built first, appended last: it is the fallback.
  const baseline = { qty, name: rest, hints: [] };

  const peeled = [];
  let name = rest;
  let hints = [];
  let cur = qty;

  // Peel one trailing group at a time, emitting a candidate after each peel.
  // Guarded against an empty name so "(2x)" alone cannot peel itself to "".
  for (let guard = 0; guard < 6; guard += 1) {
    const g = name.match(TRAIL_GROUP);
    if (g && g[1].trim()) {
      const inner = g[2].trim();
      const only = inner.match(ONLY_QTY);
      if (only) cur = floor1(parseInt(only[1] || only[2], 10));
      else hints = [inner, ...hints];
      name = g[1].trim();
      peeled.push({ qty: cur, name, hints: [...hints] });
      continue;
    }
    const q = name.match(TRAIL_QTY);
    if (q && q[1].trim()) {
      cur = floor1(parseInt(q[2] || q[3], 10));
      name = q[1].trim();
      peeled.push({ qty: cur, name, hints: [...hints] });
      continue;
    }
    break;
  }

  // Most peeled first, baseline last.
  return [...peeled.reverse(), baseline];
}
