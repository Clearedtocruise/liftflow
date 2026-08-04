import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isProgramType,
  programSplitLabel,
  resolveProgramType,
} from './programSplit';

describe('programSplit', () => {
  it('labels known splits', () => {
    assert.equal(programSplitLabel('push_pull_legs'), 'Push Pull Legs');
    assert.equal(programSplitLabel('strength'), 'Strength');
    assert.equal(programSplitLabel(undefined), 'Not set');
  });

  it('validates program types', () => {
    assert.equal(isProgramType('push_pull_legs'), true);
    assert.equal(isProgramType('strength'), true);
    assert.equal(isProgramType('powerlifting'), false);
    assert.equal(isProgramType(null), false);
  });

  it('prefers active program metadata over coachActivation', () => {
    const user = {
      metadata: { coachActivation: { programType: 'strength' } },
    } as Parameters<typeof resolveProgramType>[0];

    assert.equal(resolveProgramType(user, { programType: 'push_pull_legs' }), 'push_pull_legs');
    assert.equal(resolveProgramType(user, {}), 'strength');
    assert.equal(resolveProgramType(null, null), 'push_pull_legs');
  });
});
