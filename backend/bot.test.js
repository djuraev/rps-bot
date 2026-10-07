'use strict';
// Run with:  npm test      (no framework needed, just Node's assert)
const assert = require('assert');
const { judge, chooseMove } = require('./bot');

const firstChoice = () => 0; // deterministic "random": always picks the first option

// --- who wins? (result is from the player's point of view) ---
assert.strictEqual(judge('rock', 'scissors'), 'win');
assert.strictEqual(judge('paper', 'rock'), 'win');
assert.strictEqual(judge('scissors', 'paper'), 'win');
assert.strictEqual(judge('rock', 'paper'), 'lose');
assert.strictEqual(judge('paper', 'scissors'), 'lose');
assert.strictEqual(judge('scissors', 'rock'), 'lose');
assert.strictEqual(judge('rock', 'rock'), 'draw');

// --- not enough data: the bot only guesses ---
let r = chooseMove(['rock', 'rock'], firstChoice);
assert.strictEqual(r.strategy, 'random');
assert.strictEqual(r.predicted, null);

// --- a player who always plays rock: the bot learns it and plays paper ---
r = chooseMove(Array(10).fill('rock'), firstChoice);
assert.strictEqual(r.predicted, 'rock');
assert.strictEqual(r.move, 'paper');

// --- a player with a favorite: mostly scissors ---
r = chooseMove(['scissors', 'rock', 'scissors', 'scissors', 'paper', 'scissors'], firstChoice);
assert.strictEqual(r.predicted, 'scissors');
assert.strictEqual(r.move, 'rock');

// --- a player who alternates rock, paper, rock, paper...: PATTERN wins ---
// last move was 'paper', and after 'paper' this player always plays 'rock'
const alt = ['rock', 'paper', 'rock', 'paper', 'rock', 'paper', 'rock', 'paper', 'rock', 'paper'];
r = chooseMove(alt, firstChoice);
assert.strictEqual(r.strategy, 'pattern');
assert.strictEqual(r.predicted, 'rock');
assert.strictEqual(r.move, 'paper');
assert.strictEqual(r.context, 'paper');

// --- perfectly even history: nothing to learn, so it guesses ---
r = chooseMove(['rock', 'paper', 'scissors'], firstChoice);
assert.strictEqual(r.strategy, 'random');

// --- the bot never returns an invalid move ---
for (let i = 0; i < 500; i++) {
  const h = Array.from({ length: Math.floor(Math.random() * 40) }, () => ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)]);
  const x = chooseMove(h);
  assert.ok(['rock', 'paper', 'scissors'].includes(x.move));
}

console.log('bot.test.js: all tests passed');
