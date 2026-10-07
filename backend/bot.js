'use strict';

// ---------------------------------------------------------------------------
//  The bot's brain. Pure functions, no database, no network: easy to read,
//  easy to test (npm test).
//
//  The bot looks at the moves YOU played in the past and tries to predict
//  your NEXT move. Then it plays the move that beats its prediction.
// ---------------------------------------------------------------------------

const MOVES = ['rock', 'paper', 'scissors'];

// COUNTER[x] = the move that beats x
const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

// Result from the PLAYER's point of view: 'win' | 'lose' | 'draw'
function judge(player, bot) {
  if (player === bot) return 'draw';
  return COUNTER[player] === bot ? 'lose' : 'win';
}

function randomMove(rand = Math.random) {
  return MOVES[Math.floor(rand() * MOVES.length)];
}

// Which move has the highest count? Ties are broken randomly.
function best(counts, rand) {
  const max = Math.max(...MOVES.map((m) => counts[m]));
  const winners = MOVES.filter((m) => counts[m] === max);
  return { move: winners[Math.floor(rand() * winners.length)], max, winners: winners.length };
}

const emptyCounts = () => ({ rock: 0, paper: 0, scissors: 0 });

/**
 * history: the player's past moves, oldest first, e.g. ['rock', 'rock', 'paper']
 * returns: {
 *   move        what the bot plays now
 *   predicted   what the bot expects YOU to play (null = it is just guessing)
 *   strategy    'random' | 'frequency' | 'pattern'
 *   confidence  0..1, how sure the bot is
 *   context     for 'pattern': your previous move, otherwise null
 * }
 */
function chooseMove(history, rand = Math.random) {
  const n = history.length;

  // Strategy 0: not enough data yet, so guess.
  if (n < 3) {
    return { move: randomMove(rand), predicted: null, strategy: 'random', confidence: 0, context: null };
  }

  // Strategy 1: PATTERN. What did you usually play AFTER your last move?
  const last = history[n - 1];
  const follow = emptyCounts();
  let samples = 0;
  for (let i = 0; i < n - 1; i++) {
    if (history[i] === last) {
      follow[history[i + 1]]++;
      samples++;
    }
  }
  if (samples >= 4) {
    const top = best(follow, rand);
    const share = top.max / samples;
    if (top.winners === 1 && share > 0.4) {
      return { move: COUNTER[top.move], predicted: top.move, strategy: 'pattern', confidence: share, context: last };
    }
  }

  // Strategy 2: FREQUENCY. What do you play most often (recent 60 rounds)?
  const recent = history.slice(-60);
  const counts = emptyCounts();
  recent.forEach((m) => counts[m]++);
  const top = best(counts, rand);
  if (top.winners < 3) {
    return { move: COUNTER[top.move], predicted: top.move, strategy: 'frequency', confidence: top.max / recent.length, context: null };
  }

  // All three equally common: nothing to learn from.
  return { move: randomMove(rand), predicted: null, strategy: 'random', confidence: 0, context: null };
}

module.exports = { MOVES, COUNTER, judge, randomMove, chooseMove };
