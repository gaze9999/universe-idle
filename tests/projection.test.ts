import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/game';
import { project } from '../src/ui/projection';

describe('player discovery', () => {
  it('shows only starting resources, work and the first habitat', () => {
    const view = project(createGame());
    expect(view.tabs).toEqual(['overview', 'species', 'workers', 'buildings', 'records', 'achievements']);
    expect(view.resources).toEqual(['wood', 'stone', 'food']); expect(view.jobs).toEqual(['wood', 'stone', 'food', 'build']);
    expect(view.tasks).toEqual(['habitat']); expect(view.research).toEqual([]);
  });
  it('reveals progression at the appropriate facilities', () => {
    const s = createGame();
    s.buildings.push('habitat'); expect(project(s).tasks).toEqual(['habitat', 'lumberyard']); expect(project(s, true).tasks).toEqual(['habitat', 'lumberyard']);
    s.buildings.push('lumberyard', 'warehouse', 'laboratory');
    let view = project(s); expect(view.tabs).toContain('science'); expect(view.tabs).not.toContain('legacy');
    expect(view.resources).toContain('knowledge'); expect(view.resources).not.toContain('planks'); expect(view.research).toEqual(['crafting']); expect(view.jobs).toContain('research');
    s.research.push('crafting'); s.buildings.push('workshop'); view = project(s);
    expect(view.resources).toContain('planks'); expect(view.jobs).toContain('craft'); expect(view.research).toEqual(['crafting', 'planning', 'arcana']);
    expect(view.tasks).toContain('camp'); expect(view.tasks).not.toContain('recruit'); expect(view.tasks).not.toContain('monument');
    s.research.push('planning'); s.buildings.push('monument'); expect(project(s).tabs).toContain('legacy');
  });
  it('keeps earned legacy accessible after Reset without revealing the next run research', () => {
    const s = createGame(); s.legacy.resets = 1;
    const view = project(s); expect(view.tabs).toContain('legacy'); expect(view.tabs).not.toContain('science'); expect(view.resources).toEqual(['wood', 'stone', 'food']);
  });
});
