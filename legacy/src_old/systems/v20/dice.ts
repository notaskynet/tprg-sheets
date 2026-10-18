// V20 dice engine.
// d10 pool; counts ≥ difficulty as successes; 1s subtract; a specialty adds one
// extra die to the pool; a net ≤ 0 with at least one 1 and no successes is a botch.
import type { RollOptions, RollResult } from '@/systems/types';

export const DEFAULT_DIFFICULTY = 6;

export function rollPool({ pool, difficulty, specialty = false }: RollOptions): RollResult {
  const count = pool + (specialty ? 1 : 0);
  const dice: number[] = [];
  for (let i = 0; i < count; i++) dice.push(Math.floor(Math.random() * 10) + 1);

  let successes = 0;
  let ones = 0;
  for (const d of dice) {
    if (d === 1) ones += 1;
    else if (d >= difficulty) successes += 1;
  }

  const net = successes - ones;
  let kind: RollResult['kind'];
  let result = 0;
  if (net <= 0 && ones > 0 && successes === 0) kind = 'botch';
  else if (net <= 0) kind = 'failure';
  else {
    kind = 'success';
    result = net;
  }

  return { dice, successes, ones, net, result, kind };
}
