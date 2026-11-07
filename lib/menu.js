// DanceStudio's menus: what you can choose, and the sentence each choice builds.
// The sentence is the same thing you could say to the LucianOS character, e.g.
// "grammar logic on meditation", and the desktop runs it the same way.

export const DEFAULT_TOPICS = ['meditation', 'pedagogy', 'computer science', 'medicine', 'music', 'sales', 'philosophy', 'immortality', 'time travel', 'business'];

// The commands at the top level. `ask` is what to choose next.
export const COMMANDS = [
  { id: 'gl', label: 'Grammar Logic', glyph: '🧠', ask: 'topic', sentence: (t) => `grammar logic on ${t}` },
  { id: 'brainstorm', label: 'Brainstorm', glyph: '💡', ask: 'topic', sentence: (t) => `brainstorm ${t}` },
  { id: 'daily', label: "Today's workflows", glyph: '✅', sentence: () => "run today's workflows" },
  { id: 'music', label: "Today's music", glyph: '🎵', sentence: () => "play today's music" },
  { id: 'workflow', label: 'Checklist item', glyph: '📋', ask: 'workflow' },
  { id: 'script', label: 'Run a script', glyph: '⚙️', ask: 'script', sentence: (name) => `run ${name}` },
  { id: 'app', label: 'Open an app', glyph: '🧩', ask: 'app', sentence: (name) => `open ${name}` }
];

// Topics from Grammar Logic file names like "meditation 2026-11-07 1500.txt".
export function topicsFromFiles(names) {
  const out = [];
  for (const n of names) {
    const m = /^(.+?)\s+\d{4}-\d{2}-\d{2}(?:\s+\d{4})?\.(txt|md)$/i.exec(n);
    if (m) out.push(m[1].trim());
  }
  return out;
}

// Your topics first, then recent ones, without repeats (ignoring case).
export function mergeTopics(...lists) {
  const seen = new Set();
  const out = [];
  for (const t of lists.flat()) {
    const k = t.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t.trim());
  }
  return out;
}

export const scriptName = (fileName) => fileName.replace(/\.shellrun\.json$/i, '');

// Splits options into pages of `per` (the edge has 8 places: back and more take two).
export function paginate(options, page, { per = 6 } = {}) {
  const pages = Math.max(1, Math.ceil(options.length / per));
  const p = ((page % pages) + pages) % pages;
  return { items: options.slice(p * per, p * per + per), page: p, pages };
}

// Places a menu on the 8 edge cells: options clockwise from the top left;
// "Back" bottom left and "More" bottom right when needed.
// Returns an array of 9 (cell → tile or null); cell 4 is the middle.
export function layout(items, { back = false, more = false } = {}) {
  const BACK = 6;
  const MORE = 8;
  const order = [0, 1, 2, 5, 3, 7, 6, 8].filter((c) => !(back && c === BACK) && !(more && c === MORE));
  const cells = Array(9).fill(null);
  items.slice(0, order.length).forEach((it, i) => (cells[order[i]] = it));
  if (back) cells[BACK] = { id: '__back', label: 'Back', glyph: '◀', back: true };
  if (more) cells[MORE] = { id: '__more', label: 'More', glyph: '▶', more: true };
  return cells;
}

// What will happen, in words, for the middle of the screen.
export function describe(command, arg) {
  if (!command) return 'Choose a command';
  if (command.id === 'workflow') return arg ? `Run the checklist item “${arg.title}”` : 'Choose a checklist item';
  if (!command.ask) return command.label;
  if (arg === undefined || arg === null) return `${command.label}: choose ${command.ask === 'topic' ? 'a topic' : command.ask === 'script' ? 'a script' : 'an app'}`;
  return `${command.label} › ${typeof arg === 'string' ? arg : arg.title ?? arg.name}`;
}

// The message to send to the desktop for a finished choice.
export function action(command, arg) {
  if (command.id === 'workflow') return { type: 'lucianos.workflow', id: arg.id };
  return { type: 'lucianos.do', text: command.sentence(arg) };
}

// The same thing as a LucianOS desktop address, for when DanceStudio is open on its own.
export function desktopUrl(msg) {
  return msg.type === 'lucianos.workflow' ? `/?workflow=${encodeURIComponent(msg.id)}` : `/?do=${encodeURIComponent(msg.text)}`;
}
