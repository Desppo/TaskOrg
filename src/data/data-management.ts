import type { SQLiteDatabase } from 'expo-sqlite';
import { GENERAL_AREA_ID } from './database';

type BackupValue = string | number | null;
type BackupRow = Record<string, BackupValue>;

const TABLES = {
  areas: ['id', 'name', 'color', 'is_default', 'created_at', 'updated_at', 'deleted_at'],
  projects: ['id', 'area_id', 'name', 'description', 'color', 'position', 'pinned', 'archived_at', 'icon', 'created_at', 'updated_at', 'deleted_at'],
  project_columns: ['id', 'project_id', 'name', 'position', 'created_at', 'updated_at', 'deleted_at'],
  project_milestones: ['id', 'project_id', 'title', 'target_date', 'completed', 'created_at', 'updated_at'],
  tasks: ['id', 'area_id', 'project_id', 'column_id', 'milestone_id', 'title', 'notes', 'due_date', 'priority', 'status', 'completed_on', 'position', 'created_at', 'updated_at', 'deleted_at'],
  task_recurrence_rules: ['id', 'task_id', 'frequency', 'interval_value', 'days_of_week', 'start_date', 'end_date', 'created_at', 'updated_at'],
  task_occurrences: ['id', 'task_id', 'occurrence_date', 'completed_on', 'skipped', 'created_at', 'updated_at'],
  events: ['id', 'area_id', 'title', 'description', 'start_at', 'end_at', 'all_day', 'color', 'created_at', 'updated_at', 'deleted_at'],
  inbox_items: ['id', 'content', 'created_at', 'updated_at', 'deleted_at'],
  daily_logs: ['date', 'done_text', 'pending_text', 'notes', 'created_at', 'updated_at'],
} as const;

type TableName = keyof typeof TABLES;

export interface DataStats {
  tasks: number;
  projects: number;
  inbox: number;
  reviews: number;
  archived: number;
}

interface BackupFile {
  format: 'taskorg-backup';
  version: 1;
  exportedAt: string;
  tables: Record<TableName, BackupRow[]>;
}

const INSERT_ORDER = Object.keys(TABLES) as TableName[];
const DELETE_ORDER = [...INSERT_ORDER].reverse();

export async function getDataStats(db: SQLiteDatabase): Promise<DataStats> {
  const row = await db.getFirstAsync<DataStats>(`
    SELECT
      (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL) AS tasks,
      (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS projects,
      (SELECT COUNT(*) FROM inbox_items WHERE deleted_at IS NULL) AS inbox,
      (SELECT COUNT(*) FROM daily_logs) AS reviews,
      (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL AND status = 'ARCHIVED') AS archived
  `);
  return row ?? { tasks: 0, projects: 0, inbox: 0, reviews: 0, archived: 0 };
}

export async function createBackup(db: SQLiteDatabase): Promise<string> {
  const entries = await Promise.all(INSERT_ORDER.map(async (table) => {
    const rows = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
    return [table, rows] as const;
  }));
  const backup: BackupFile = {
    format: 'taskorg-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: Object.fromEntries(entries) as Record<TableName, BackupRow[]>,
  };
  return JSON.stringify(backup, null, 2);
}

function parseBackup(content: string): BackupFile {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup');
  const candidate = parsed as Partial<BackupFile>;
  if (candidate.format !== 'taskorg-backup' || candidate.version !== 1 || !candidate.tables || typeof candidate.tables !== 'object') {
    throw new Error('Unsupported backup');
  }

  const tables = {} as Record<TableName, BackupRow[]>;
  for (const table of INSERT_ORDER) {
    const rows = candidate.tables[table];
    if (!Array.isArray(rows)) {
      // New table not present in older backups — use empty array
      if (table === 'project_milestones') { tables[table] = []; continue; }
      throw new Error(`Missing table: ${table}`);
    }
    tables[table] = rows.map((input) => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Invalid row: ${table}`);
      const row = input as Record<string, unknown>;
      const normalized: BackupRow = {};
      for (const column of TABLES[table]) {
        const value = row[column];
        if (value === undefined) {
          // Legacy backup missing new optional columns — provide safe defaults
          const DEFAULTS: Record<string, BackupValue> = { pinned: 0, icon: 'folder', archived_at: null, milestone_id: null };
          normalized[column] = (column in DEFAULTS ? DEFAULTS[column] : null) ?? null;
          continue;
        }

        if (value !== null && typeof value !== 'string' && typeof value !== 'number') throw new Error(`Invalid value: ${table}.${column}`);
        normalized[column] = value;
      }
      return normalized;
    });
  }
  if (!tables.areas.some((area) => area.id === GENERAL_AREA_ID)) throw new Error('Backup is missing the default area');

  return {
    format: 'taskorg-backup',
    version: 1,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
    tables,
  };
}

export async function restoreBackup(db: SQLiteDatabase, content: string): Promise<void> {
  const backup = parseBackup(content);
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync('PRAGMA defer_foreign_keys = ON;');
    for (const table of DELETE_ORDER) await transaction.runAsync(`DELETE FROM ${table}`);
    for (const table of INSERT_ORDER) {
      const columns = TABLES[table];
      const placeholders = columns.map(() => '?').join(', ');
      const statement = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      for (const row of backup.tables[table]) {
        const values = columns.map((column) => {
          const value = row[column];
          if (value === undefined) throw new Error(`Missing value: ${table}.${column}`);
          return value;
        });
        await transaction.runAsync(statement, ...values);
      }
    }
    const violations = await transaction.getAllAsync('PRAGMA foreign_key_check');
    if (violations.length > 0) throw new Error('Backup contains invalid relationships');
  });
}

export async function resetAllData(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const table of DELETE_ORDER) await transaction.runAsync(`DELETE FROM ${table}`);
    const timestamp = new Date().toISOString();
    await transaction.runAsync(
      'INSERT INTO areas (id, name, color, is_default, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
      GENERAL_AREA_ID,
      'General',
      '#6366F1',
      timestamp,
      timestamp,
    );
  });
}
