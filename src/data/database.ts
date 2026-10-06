import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'taskorg.db';
export const GENERAL_AREA_ID = '00000000-0000-4000-8000-000000000001';

export const DATABASE_VERSION = 4;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion === 0) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE areas (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#6366F1',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        CREATE TABLE projects (
          id TEXT PRIMARY KEY NOT NULL,
          area_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT NOT NULL DEFAULT '#6366F1',
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
        );

        CREATE TABLE project_columns (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE tasks (
          id TEXT PRIMARY KEY NOT NULL,
          area_id TEXT NOT NULL,
          project_id TEXT,
          column_id TEXT,
          title TEXT NOT NULL,
          notes TEXT,
          due_date TEXT,
          priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
          status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'ARCHIVED')),
          completed_on TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
          FOREIGN KEY (column_id) REFERENCES project_columns(id) ON DELETE SET NULL
        );

        CREATE TABLE task_recurrence_rules (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL UNIQUE,
          frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM')),
          interval_value INTEGER NOT NULL DEFAULT 1,
          days_of_week TEXT NOT NULL DEFAULT '[]',
          start_date TEXT NOT NULL,
          end_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE task_occurrences (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          occurrence_date TEXT NOT NULL,
          completed_on TEXT,
          skipped INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (task_id, occurrence_date),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE events (
          id TEXT PRIMARY KEY NOT NULL,
          area_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          start_at TEXT NOT NULL,
          end_at TEXT NOT NULL,
          all_day INTEGER NOT NULL DEFAULT 0,
          color TEXT NOT NULL DEFAULT '#8B5CF6',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
        );

        CREATE TABLE inbox_items (
          id TEXT PRIMARY KEY NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        CREATE TABLE daily_logs (
          date TEXT PRIMARY KEY NOT NULL,
          done_text TEXT NOT NULL DEFAULT '',
          pending_text TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX idx_tasks_project ON tasks(project_id, column_id);
        CREATE INDEX idx_tasks_status ON tasks(status, deleted_at);
        CREATE INDEX idx_events_start ON events(start_at);
        CREATE INDEX idx_inbox_created ON inbox_items(created_at DESC);
      `);

      const now = new Date().toISOString();
      await transaction.runAsync(
        'INSERT INTO areas (id, name, color, is_default, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
        GENERAL_AREA_ID,
        'General',
        '#6366F1',
        now,
        now,
      );
      await transaction.execAsync('PRAGMA user_version = 1');
    });
    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      // Earlier builds kept discarded rows hidden with deleted_at. The UI
      // promises deletion from the device, so purge those legacy rows.
      await transaction.runAsync('DELETE FROM tasks WHERE deleted_at IS NOT NULL');
      await transaction.runAsync('DELETE FROM inbox_items WHERE deleted_at IS NOT NULL');
      await transaction.execAsync('PRAGMA user_version = 2');
    });
    currentVersion = 2;
  }

  if (currentVersion === 2) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      // Add project customization + archiving columns
      await transaction.runAsync('ALTER TABLE projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
      await transaction.runAsync('ALTER TABLE projects ADD COLUMN archived_at TEXT');
      await transaction.runAsync("ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT 'folder'");
      // Create milestones table
      await transaction.execAsync(`
        CREATE TABLE project_milestones (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          target_date TEXT,
          completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_milestones_project ON project_milestones(project_id);
      `);
      // Add milestone association to tasks
      await transaction.runAsync(
        'ALTER TABLE tasks ADD COLUMN milestone_id TEXT REFERENCES project_milestones(id) ON DELETE SET NULL',
      );
      await transaction.execAsync('PRAGMA user_version = 3');
    });
    currentVersion = 3;
  }

  if (currentVersion === 3) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      // Add recurrence rule duration fields
      await transaction.runAsync("ALTER TABLE task_recurrence_rules ADD COLUMN end_type TEXT NOT NULL DEFAULT 'date'");
      await transaction.runAsync("ALTER TABLE task_recurrence_rules ADD COLUMN end_value TEXT");
      await transaction.runAsync("UPDATE task_recurrence_rules SET end_type = CASE WHEN end_date IS NULL THEN 'none' ELSE 'date' END, end_value = end_date");
      await transaction.execAsync('PRAGMA user_version = 4');
    });
    currentVersion = 4;
  }

  if (currentVersion !== DATABASE_VERSION) {
    throw new Error(`Unsupported database version: ${currentVersion}`);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
