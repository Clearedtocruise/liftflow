import assert from 'node:assert/strict';
import test from 'node:test';

import { friendlyMealError, isStaleMealError, MEAL_NOT_FOUND } from './mealErrors';

test('the PostgREST no-row error is recognised as a stale meal', () => {
  // What the user actually saw in an alert when replacing a food item.
  const raw = 'Cannot coerce the result to a single JSON object';
  assert.equal(isStaleMealError({ error: raw }), true);
  assert.equal(isStaleMealError({ code: 'PGRST116' }), true);
  assert.equal(isStaleMealError({ code: MEAL_NOT_FOUND }), true);
});

test('a stale meal explains itself instead of quoting the database', () => {
  const message = friendlyMealError('Cannot coerce the result to a single JSON object');
  assert.match(message, /updated somewhere else/i);
  assert.doesNotMatch(message, /json|coerce/i);
});

test('network and server failures keep their own wording', () => {
  assert.match(friendlyMealError('Network request failed'), /connection/i);
  assert.match(friendlyMealError('API error 500'), /our end/i);
});

test('other database wording is never shown verbatim', () => {
  for (const raw of [
    'duplicate key value violates unique constraint "meals_pkey"',
    'column "foo" does not exist',
    'PGRST202 relation not found',
  ]) {
    const message = friendlyMealError(raw);
    assert.doesNotMatch(message, /constraint|column|relation|pgrst/i, raw);
  }
});

test('a message already written for humans passes through', () => {
  const raw = 'Add weight and body fat % so your coach can project your timeline.';
  assert.equal(friendlyMealError(raw), raw);
});

test('a healthy result is not treated as stale', () => {
  assert.equal(isStaleMealError({}), false);
  assert.equal(isStaleMealError({ error: 'Network request failed' }), false);
});
