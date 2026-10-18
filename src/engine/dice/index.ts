// Dice mechanics, selected per system by `dice.mechanic`. All take an injectable
// RNG (returns [0,1)) so tests are deterministic.
import type { DiceConfig } from '../schema';

export type Rng = () => number;
const d = (rng: Rng, sides: number) => Math.floor(rng() * sides) + 1;

export type RollKind = 'success' | 'failure' | 'botch' | 'crit' | 'critfail';

export interface RollRequest {
  pool?: number; // pool-successes: dice count
  difficulty?: number; // pool-successes target number / d20 DC
  specialty?: boolean;
  modifier?: number; // d20-modifier
  advantage?: 'adv' | 'dis'; // d20-modifier
  skill?: number; // d100-under: skill value
  bonus?: number; // d100-under: bonus dice (negative = penalty dice)
  notation?: string; // notation: "2d6+3"
}

export interface RollResult {
  mechanic: DiceConfig['mechanic'];
  dice: number[];
  kind: RollKind;
  /** headline number: net successes / total / roll value */
  result: number;
  successes?: number;
  ones?: number;
  degree?: 'regular' | 'hard' | 'extreme' | 'fail'; // d100-under
}

export function roll(cfg: DiceConfig, req: RollRequest, rng: Rng = Math.random): RollResult {
  switch (cfg.mechanic) {
    case 'pool-successes': return poolSuccesses(cfg, req, rng);
    case 'd20-modifier': return d20(cfg, req, rng);
    case 'd100-under': return d100(req, rng);
    case 'notation': return notation(req.notation ?? '1d20', rng);
  }
}

function poolSuccesses(cfg: Extract<DiceConfig, { mechanic: 'pool-successes' }>, req: RollRequest, rng: Rng): RollResult {
  const count = Math.max(0, (req.pool ?? 0) + (req.specialty && cfg.specialty === 'extra-die' ? 1 : 0));
  const target = req.difficulty ?? cfg.defaultDifficulty;
  const dice = Array.from({ length: count }, () => d(rng, cfg.die));
  let successes = 0;
  let ones = 0;
  for (const x of dice) {
    if (cfg.onesCancel && x === 1) ones++;
    else if (x >= target) successes++;
  }
  const net = successes - ones;
  let kind: RollKind = 'failure';
  let result = 0;
  if (net <= 0 && ones > 0 && successes === 0) kind = 'botch';
  else if (net > 0) { kind = 'success'; result = net; }
  return { mechanic: cfg.mechanic, dice, kind, result, successes, ones };
}

function d20(cfg: Extract<DiceConfig, { mechanic: 'd20-modifier' }>, req: RollRequest, rng: Rng): RollResult {
  const dice = [d(rng, 20)];
  if (req.advantage) dice.push(d(rng, 20));
  const natural = req.advantage === 'adv' ? Math.max(...dice) : req.advantage === 'dis' ? Math.min(...dice) : dice[0];
  const total = natural + (req.modifier ?? 0);
  let kind: RollKind;
  if (natural >= cfg.critSuccess) kind = 'crit';
  else if (natural <= cfg.critFail) kind = 'critfail';
  else if (req.difficulty != null) kind = total >= req.difficulty ? 'success' : 'failure';
  else kind = 'success';
  return { mechanic: cfg.mechanic, dice, kind, result: total };
}

function d100(req: RollRequest, rng: Rng): RollResult {
  const skill = req.skill ?? 0;
  const tens = d(rng, 10) - 1;
  const extra = Math.abs(req.bonus ?? 0);
  const tensRolls = [tens, ...Array.from({ length: extra }, () => d(rng, 10) - 1)];
  const units = d(rng, 10) % 10;
  const cand = tensRolls.map((t) => (t === 0 && units === 0 ? 100 : t * 10 + units));
  const value = (req.bonus ?? 0) < 0 ? Math.max(...cand) : Math.min(...cand);
  let degree: RollResult['degree'] = 'fail';
  if (value <= Math.floor(skill / 5)) degree = 'extreme';
  else if (value <= Math.floor(skill / 2)) degree = 'hard';
  else if (value <= skill) degree = 'regular';
  const kind: RollKind = value === 1 ? 'crit' : degree === 'fail' ? (value >= (skill < 50 ? 96 : 100) ? 'critfail' : 'failure') : 'success';
  return { mechanic: 'd100-under', dice: [value], kind, result: value, degree };
}

function notation(src: string, rng: Rng): RollResult {
  const m = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(src);
  if (!m) throw new Error(`Bad dice notation "${src}"`);
  const n = Number(m[1] || 1);
  const dice = Array.from({ length: n }, () => d(rng, Number(m[2])));
  const mod = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  return { mechanic: 'notation', dice, kind: 'success', result: dice.reduce((a, b) => a + b, 0) + mod };
}
