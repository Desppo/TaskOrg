const assert = require('node:assert/strict');
const { test } = require('node:test');
const { database, loadTypeScript } = require('./helpers.cjs');
const { migrateDatabase, GENERAL_AREA_ID, DATABASE_VERSION } = loadTypeScript('src/data/database.ts');
const { createBackup, inspectBackup, restoreBackup } = loadTypeScript('src/data/data-management.ts');
const { queueWrite } = loadTypeScript('src/data/pending-writes.ts');
const { projectRepository, taskRepository, recurrenceRepository } = loadTypeScript('src/data/repositories.ts');
const { toDateKey, shiftDate } = loadTypeScript('src/utils/date.ts');

async function setup(t) {
  const db = database();
  t.after(() => db.sqlite.close());
  await migrateDatabase(db);
  return db;
}

async function seed(db) {
  const timestamp = '2026-09-17T12:00:00.000Z';
  await db.runAsync('INSERT INTO projects (id, area_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 'project', GENERAL_AREA_ID, 'My project', timestamp, timestamp);
  await db.runAsync('INSERT INTO project_columns (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 'column', 'project', 'Todo', timestamp, timestamp);
  await db.runAsync('INSERT INTO project_milestones (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 'milestone', 'project', 'First release', timestamp, timestamp);
  await db.runAsync('INSERT INTO tasks (id, area_id, project_id, column_id, milestone_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 'task', GENERAL_AREA_ID, 'project', 'column', 'milestone', 'Test on iPhone', timestamp, timestamp);
  await recurrenceRepository.saveRule(db, 'task', {
    frequency: 'WEEKLY', intervalValue: 1, daysOfWeek: [1, 5], endDate: null, endType: 'duration', endValue: '5',
  }, '2026-09-17');
}

test('a fresh database migrates and can be reopened without losing records', async (t) => {
  const db = await setup(t);
  await seed(db);
  await migrateDatabase(db);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, DATABASE_VERSION);
  assert.equal((await taskRepository.getById(db, 'task')).milestoneId, 'milestone');
});

test('Android/iOS JSON round trip preserves all tables, milestones and recurrence duration', async (t) => {
  const source = await setup(t);
  const destination = await setup(t);
  await seed(source);
  const timestamp = '2026-09-27T12:30:00.000Z';
  const notes = 'Anotación con ñ, acentos y emoji 📌\nSegunda línea\n"Comillas" y \\ rutas';
  await source.runAsync('UPDATE projects SET description = ?, pinned = 1, archived_at = ?, icon = ?, color = ?, position = 3', notes, timestamp, 'rocket', '#ABCDEF');
  await source.runAsync('UPDATE tasks SET notes = ?, status = ?, completed_on = ?, due_date = ?, priority = 3, position = 5', notes, 'ARCHIVED', '2026-09-25', '2026-09-24');
  await source.runAsync('UPDATE project_milestones SET target_date = ?, completed = 1', '2026-09-30');
  await source.runAsync('INSERT INTO inbox_items (id, content, created_at, updated_at) VALUES (?, ?, ?, ?)', 'inbox', notes, timestamp, timestamp);
  await source.runAsync('INSERT INTO daily_logs (date, done_text, pending_text, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', '2026-09-27', 'Hecho', 'Pendiente', notes, timestamp, timestamp);
  await source.runAsync('INSERT INTO events (id, area_id, title, description, start_at, end_at, all_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 'event', GENERAL_AREA_ID, 'Evento', notes, timestamp, timestamp, 1, timestamp, timestamp);
  await source.runAsync('INSERT INTO task_occurrences (id, task_id, occurrence_date, completed_on, skipped, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'occurrence', 'task', '2026-09-25', '2026-09-25', 0, timestamp, timestamp);
  await source.runAsync('INSERT INTO task_occurrences (id, task_id, occurrence_date, completed_on, skipped, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 'skipped', 'task', '2026-09-28', null, 1, timestamp, timestamp);
  const preferences = { language: 'es', theme: 'dark' };
  const backup = await createBackup(source, preferences);
  assert.deepEqual(await restoreBackup(destination, backup), preferences);
  assert.deepEqual(JSON.parse(await createBackup(destination)).tables, JSON.parse(backup).tables);
  for (const rows of Object.values(JSON.parse(backup).tables)) assert.ok(rows.length > 0);
  assert.equal(inspectBackup(backup).reviews, 1);
  const rule = await recurrenceRepository.getRule(destination, 'task');
  assert.equal(rule.endType, 'duration');
  assert.equal(rule.endValue, '5');
});

test('legacy backups get compatible recurrence defaults and optional milestone fields', async (t) => {
  const db = await setup(t);
  await seed(db);
  const backup = JSON.parse(await createBackup(db));
  delete backup.schemaVersion;
  delete backup.preferences;
  delete backup.tables.project_milestones;
  delete backup.tables.tasks[0].milestone_id;
  const row = backup.tables.task_recurrence_rules[0];
  delete row.end_type;
  delete row.end_value;
  row.end_date = null;
  await restoreBackup(db, JSON.stringify(backup));
  assert.equal((await recurrenceRepository.getRule(db, 'task')).endType, 'none');
  assert.equal((await taskRepository.getById(db, 'task')).milestoneId, null);
  row.end_date = '2027-01-01';
  await restoreBackup(db, JSON.stringify(backup));
  assert.equal((await recurrenceRepository.getRule(db, 'task')).endValue, '2027-01-01');
});

test('future backup data and malformed files are rejected without replacing existing data', async (t) => {
  const db = await setup(t);
  await seed(db);
  const before = JSON.parse(await createBackup(db));
  const newer = structuredClone(before);
  newer.schemaVersion = DATABASE_VERSION + 1;
  const extraTable = structuredClone(before);
  extraTable.tables.attachments = [{ id: 'important-file' }];
  const extraColumn = structuredClone(before);
  extraColumn.tables.tasks[0].attachment = 'important-file';
  const duplicate = structuredClone(before);
  duplicate.tables.tasks.push(duplicate.tables.tasks[0]);
  for (const content of ['not json', '{}', ...[newer, extraTable, extraColumn, duplicate].map(value => JSON.stringify(value))]) {
    await assert.rejects(restoreBackup(db, content));
    assert.deepEqual(JSON.parse(await createBackup(db)).tables, before.tables);
  }
});

test('projects with the same name keep their own color and icon', async (t) => {
  const db = await setup(t);
  await projectRepository.create(db, 'Proyecto', ['Pendiente'], { color: '#123456', icon: 'rocket' });
  await projectRepository.create(db, 'Proyecto', ['Pendiente'], { color: '#ABCDEF', icon: 'heart' });
  const projects = await db.getAllAsync('SELECT color, icon FROM projects ORDER BY color');
  assert.deepEqual(projects.map(row => ({ ...row })), [
    { color: '#123456', icon: 'rocket' },
    { color: '#ABCDEF', icon: 'heart' },
  ]);
  assert.equal((await db.getAllAsync('SELECT * FROM project_columns')).length, 2);
});

test('export waits for the last note edit even after leaving its screen', async (t) => {
  const db = await setup(t);
  await seed(db);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  void queueWrite(db, 'project-notes:project', async () => {
    await gate;
    await db.runAsync('UPDATE projects SET description = ?', 'First edit');
  });
  void queueWrite(db, 'project-notes:project', () => db.runAsync('UPDATE projects SET description = ?', 'Latest edit 📌'));
  const backup = createBackup(db);
  release();
  assert.equal(JSON.parse(await backup).tables.projects[0].description, 'Latest edit 📌');
});

test('a failed note write is retried before export, and persistent failure blocks export', async (t) => {
  const db = await setup(t);
  await seed(db);
  let attempts = 0;
  await assert.rejects(queueWrite(db, 'notes', async () => {
    if (++attempts === 1) throw new Error('Busy');
    await db.runAsync('UPDATE projects SET description = ?', 'Recovered');
  }));
  assert.equal(JSON.parse(await createBackup(db)).tables.projects[0].description, 'Recovered');
  await assert.rejects(queueWrite(db, 'notes', async () => { throw new Error('Disk full'); }));
  await assert.rejects(createBackup(db), /Disk full/);
});

test('an invalid relationship rolls back the entire restore', async (t) => {
  const db = await setup(t);
  await seed(db);
  const before = JSON.parse(await createBackup(db));
  const invalid = structuredClone(before);
  invalid.tables.tasks[0].project_id = 'missing-project';
  await assert.rejects(restoreBackup(db, JSON.stringify(invalid)));
  assert.deepEqual(JSON.parse(await createBackup(db)).tables, before.tables);
});

test('migration failure can be retried without duplicate columns or data loss', async (t) => {
  const db = database();
  t.after(() => db.sqlite.close());
  const run = db.runAsync;
  db.runAsync = async (sql, ...args) => {
    if (sql.includes('ADD COLUMN end_value')) throw new Error('Simulated interruption');
    return run(sql, ...args);
  };
  await assert.rejects(migrateDatabase(db), /Simulated interruption/);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 3);
  db.runAsync = run;
  await migrateDatabase(db);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, DATABASE_VERSION);
  assert.equal((await db.getAllAsync('SELECT * FROM areas')).length, 1);
});

test('editing a task preserves a milestone, and moving projects can clear it', async (t) => {
  const db = await setup(t);
  await seed(db);
  const task = await taskRepository.getById(db, 'task');
  await taskRepository.update(db, task.id, { ...task, title: 'Edited' }, 'OPEN', null);
  assert.equal((await taskRepository.getById(db, 'task')).milestoneId, 'milestone');
  await taskRepository.update(db, task.id, { ...task, projectId: null, columnId: null, milestoneId: null }, 'OPEN', null);
  assert.equal((await taskRepository.getById(db, 'task')).milestoneId, null);
});

test('changing a recurrence removes stale future dates and preserves completed history', async (t) => {
  const db = await setup(t);
  await seed(db);
  const start = shiftDate(toDateKey(new Date()), 1);
  const draft = { frequency: 'DAILY', intervalValue: 1, daysOfWeek: [], endType: 'none', endValue: null, endDate: null };
  await recurrenceRepository.saveRule(db, 'task', draft, start);
  await recurrenceRepository.generateForRule(db, await recurrenceRepository.getRule(db, 'task'), start);
  await db.runAsync('UPDATE task_occurrences SET completed_on = ? WHERE occurrence_date = ?', start, start);
  await recurrenceRepository.saveRule(db, 'task', { ...draft, intervalValue: 2 }, start);
  await recurrenceRepository.generateForRule(db, await recurrenceRepository.getRule(db, 'task'), start);
  assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS count FROM task_occurrences WHERE occurrence_date = ?', shiftDate(start, 1))).count, 0);
  assert.equal((await db.getFirstAsync('SELECT completed_on FROM task_occurrences WHERE occurrence_date = ?', start)).completed_on, start);
});
