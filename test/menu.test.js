import assert from 'node:assert/strict';
import { test } from 'node:test';
import { action, COMMANDS, describe, desktopUrl, layout, mergeTopics, paginate, scriptName, topicsFromFiles } from '../lib/menu.js';

const cmd = (id) => COMMANDS.find((c) => c.id === id);

test('topics come from Grammar Logic file names and your own list, without repeats', () => {
  assert.deepEqual(topicsFromFiles(['meditation 2026-11-07 1500.txt', 'time travel 2026-11-01.md', 'notes.txt', 'finished']), ['meditation', 'time travel']);
  assert.deepEqual(mergeTopics(['Meditation', 'music'], ['meditation', 'pedagogy', ' ']), ['Meditation', 'music', 'pedagogy']);
  assert.equal(scriptName('Breasoning.shellrun.json'), 'Breasoning');
});

test('menus fill the edge, with Back bottom left and More bottom right', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((id) => ({ id, label: id }));
  const p0 = paginate(items, 0);
  assert.deepEqual([p0.items.length, p0.pages], [6, 2]);
  assert.equal(paginate(items, 1).items.length, 3);
  assert.equal(paginate(items, 2).page, 0); // wraps round
  const cells = layout(p0.items, { back: true, more: true });
  assert.equal(cells[4], null); // the middle stays free
  assert.equal(cells[6].back, true);
  assert.equal(cells[8].more, true);
  assert.deepEqual(cells.filter((c) => c && !c.back && !c.more).map((c) => c.id), ['a', 'b', 'c', 'e', 'd', 'f']);
  // the top level has room for all 8 places
  assert.equal(layout(COMMANDS).filter(Boolean).length, COMMANDS.length);
});

test('choices become sentences the character understands', () => {
  assert.deepEqual(action(cmd('gl'), 'meditation'), { type: 'lucianos.do', text: 'grammar logic on meditation' });
  assert.deepEqual(action(cmd('daily')), { type: 'lucianos.do', text: "run today's workflows" });
  assert.deepEqual(action(cmd('script'), 'hello'), { type: 'lucianos.do', text: 'run hello' });
  assert.deepEqual(action(cmd('workflow'), { id: 'w1', title: 'Walk' }), { type: 'lucianos.workflow', id: 'w1' });
  assert.equal(desktopUrl({ type: 'lucianos.do', text: 'brainstorm time travel' }), '/?do=brainstorm%20time%20travel');
  assert.equal(describe(cmd('gl')), 'Grammar Logic: choose a topic');
  assert.equal(describe(cmd('gl'), 'pedagogy'), 'Grammar Logic › pedagogy');
});

test('the sentences parse as the right character commands', async () => {
  const { parseCommand } = await import('../../lucianos-repo/public/shared/character/commands.js').catch(() => ({}));
  if (!parseCommand) return; // the platform isn't next to this repo
  assert.deepEqual(parseCommand(action(cmd('gl'), 'time travel').text), { intent: 'gl', topic: 'time travel' });
  assert.equal(parseCommand(action(cmd('brainstorm'), 'music').text).intent, 'brainstorm');
  assert.equal(parseCommand(action(cmd('daily')).text).intent, 'workflows');
  assert.equal(parseCommand(action(cmd('music')).text).intent, 'music');
  assert.equal(parseCommand(action(cmd('app'), 'iEdit').text).intent, 'open');
  assert.equal(parseCommand(action(cmd('script'), 'hello').text).intent, 'run');
});
