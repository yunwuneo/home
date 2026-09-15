import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  advance,
  startActivity,
  localReply,
  publicState,
} from '../server/simulation.mjs';
import { ACTIVITIES, accessibleTarget, walkPath } from '../shared/world.mjs';

test('every activity can be reached without traversing furniture', () => {
  for (const [kind, a] of Object.entries(ACTIVITIES))
    for (const target of [a.echo, a.player]) {
      assert.ok(accessibleTarget(target), `${kind} target is walkable`);
      const path = walkPath([0, 2.75], target);
      assert.ok(path.length, `${kind} reachable from living room`);
      assert.ok(path.every(accessibleTarget), `${kind} path avoids all obstacles`);
    }
});
test('shared cooking produces food and a memory only on completion', () => {
  const s = initialState();
  startActivity(s, 'cook');
  assert.equal(s.memories.length, 1);
  assert.equal(s.meals, 1);
  for (let i = 0; i < 24; i++) advance(s, 1);
  assert.equal(s.activity, null);
  assert.equal(s.meals, 2);
  assert.equal(s.memories.length, 2);
  assert.equal(s.warmth, 3);
  startActivity(s, 'eat');
  for (let i = 0; i < 22; i++) advance(s, 1);
  assert.equal(s.meals, 1);
  assert.ok(s.hunger > 95);
});
test('pause freezes time, needs, activity and autonomy; long elapsed time is capped', () => {
  const s = initialState();
  startActivity(s, 'rest');
  s.speed = 0;
  const before = structuredClone(s);
  assert.equal(advance(s, 99999), false);
  assert.deepEqual(s, before);
  s.speed = 1;
  advance(s, 99999);
  assert.equal(s.activity.progress, 5);
});
test('Echo starts activities independently and does not move the player', () => {
  const s = initialState(),
    player = [...s.playerPosition];
  for (let i = 0; i < 43; i++) advance(s, 1);
  assert.ok(s.activity);
  assert.equal(s.activity.together, false);
  assert.deepEqual(s.playerPosition, player);
  assert.equal(s.memories.length, 1);
  assert.equal(s.warmth, 0);
});
test('food, active activities and relationship growth have constraints', () => {
  const s = initialState();
  s.meals = 0;
  assert.throws(() => startActivity(s, 'eat'));
  startActivity(s, 'tea');
  assert.throws(() => startActivity(s, 'cook'));
  for (let i = 0; i < 18; i++) advance(s, 1);
  const warmth = s.warmth;
  startActivity(s, 'tea');
  for (let i = 0; i < 18; i++) advance(s, 1);
  assert.ok(Math.abs(s.warmth - warmth - 0.35) < 1e-8);
  assert.equal('warmth' in publicState(s, false), false);
});
test('preferences are recalled and do not duplicate memories', () => {
  const s = initialState();
  localReply(s, '我喜欢抹茶。');
  localReply(s, '我喜欢抹茶。');
  assert.deepEqual(s.preferences, ['喜欢抹茶']);
  assert.equal(s.memories.length, 2);
  assert.match(localReply(s, '还记得我喜欢什么吗？'), /抹茶/);
});
