import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { GENERAL_AREA_ID } from './database';
import type {
  ArchivedTask,
  CalendarItem,
  DashboardSummary,
  DailyLog,
  InboxItem,
  ProjectDestination,
  ProjectDetail,
  ProjectSummary,
  TaskDraft,
  TaskItem,
} from './types';

interface InboxRow {
  id: string;
  content: string;
  created_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: number;
  status: TaskItem['status'];
  completed_on: string | null;
  project_id: string | null;
  column_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DailyLogRow {
  date: string;
  done_text: string;
  pending_text: string;
  notes: string;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface ProjectColumnRow {
  id: string;
  name: string;
  position: number;
}

function now(): string {
  return new Date().toISOString();
}

function mapTask(row: TaskRow): TaskItem {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    priority: Math.min(3, Math.max(0, row.priority)) as TaskItem['priority'],
    status: row.status,
    completedOn: row.completed_on,
    projectId: row.project_id,
    columnId: row.column_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TASK_SELECT = `
  SELECT id, title, notes, due_date, priority, status, completed_on,
         project_id, column_id, created_at, updated_at
  FROM tasks
`;

export const inboxRepository = {
  async list(db: SQLiteDatabase): Promise<InboxItem[]> {
    const rows = await db.getAllAsync<InboxRow>(
      `SELECT id, content, created_at FROM inbox_items
       WHERE deleted_at IS NULL ORDER BY created_at DESC`,
    );
    return rows.map((row) => ({ id: row.id, content: row.content, createdAt: row.created_at }));
  },

  async create(db: SQLiteDatabase, content: string): Promise<void> {
    const timestamp = now();
    await db.runAsync(
      'INSERT INTO inbox_items (id, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
      Crypto.randomUUID(),
      content.trim(),
      timestamp,
      timestamp,
    );
  },

  async getById(db: SQLiteDatabase, id: string): Promise<InboxItem | null> {
    const row = await db.getFirstAsync<InboxRow>(
      `SELECT id, content, created_at
       FROM inbox_items
       WHERE id = ? AND deleted_at IS NULL`,
      id,
    );
    return row ? { id: row.id, content: row.content, createdAt: row.created_at } : null;
  },

  async remove(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync('DELETE FROM inbox_items WHERE id = ?', id);
  },

  async moveToToday(db: SQLiteDatabase, item: InboxItem, date: string): Promise<void> {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      const timestamp = now();
      await transaction.runAsync(
        `INSERT INTO tasks
          (id, area_id, title, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'OPEN', ?, ?)`,
        Crypto.randomUUID(),
        GENERAL_AREA_ID,
        item.content,
        date,
        timestamp,
        timestamp,
      );
      await transaction.runAsync('DELETE FROM inbox_items WHERE id = ?', item.id);
    });
  },

  async convertToTask(
    db: SQLiteDatabase,
    itemId: string,
    draft: TaskDraft,
    status: TaskItem['status'] = 'OPEN',
    completedOn: string | null = null,
  ): Promise<string> {
    const taskId = Crypto.randomUUID();
    await db.withExclusiveTransactionAsync(async (transaction) => {
      const timestamp = now();
      await transaction.runAsync(
        `INSERT INTO tasks
          (id, area_id, project_id, column_id, title, notes, due_date, priority, status, completed_on, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        taskId,
        GENERAL_AREA_ID,
        draft.projectId,
        draft.columnId,
        draft.title.trim(),
        draft.notes,
        draft.dueDate,
        draft.priority,
        status,
        completedOn,
        timestamp,
        timestamp,
      );
      await transaction.runAsync('DELETE FROM inbox_items WHERE id = ?', itemId);
    });
    return taskId;
  },
};

export const taskRepository = {
  async getById(db: SQLiteDatabase, id: string): Promise<TaskItem | null> {
    const row = await db.getFirstAsync<TaskRow>(
      `${TASK_SELECT}
       WHERE id = ? AND deleted_at IS NULL`,
      id,
    );
    return row ? mapTask(row) : null;
  },

  async listToday(db: SQLiteDatabase, date: string): Promise<TaskItem[]> {
    const rows = await db.getAllAsync<TaskRow>(
      `${TASK_SELECT}
       WHERE deleted_at IS NULL AND status = 'OPEN' AND due_date <= ?
       ORDER BY CASE WHEN due_date < ? THEN 0 ELSE 1 END, priority DESC, created_at ASC`,
      date,
      date,
    );
    return rows.map(mapTask);
  },

  async listCompleted(db: SQLiteDatabase, date: string): Promise<TaskItem[]> {
    const rows = await db.getAllAsync<TaskRow>(
      `${TASK_SELECT}
       WHERE deleted_at IS NULL AND status = 'DONE' AND completed_on = ?
       ORDER BY updated_at DESC`,
      date,
    );
    return rows.map(mapTask);
  },

  async listUnscheduled(db: SQLiteDatabase): Promise<TaskItem[]> {
    const rows = await db.getAllAsync<TaskRow>(
      `${TASK_SELECT}
       WHERE deleted_at IS NULL AND status = 'OPEN'
         AND due_date IS NULL
       ORDER BY priority DESC, created_at ASC`,
    );
    return rows.map(mapTask);
  },

  async createForToday(db: SQLiteDatabase, title: string, date: string): Promise<void> {
    const timestamp = now();
    await db.runAsync(
      `INSERT INTO tasks
        (id, area_id, title, due_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'OPEN', ?, ?)`,
      Crypto.randomUUID(),
      GENERAL_AREA_ID,
      title.trim(),
      date,
      timestamp,
      timestamp,
    );
  },

  async setCompleted(db: SQLiteDatabase, id: string, completed: boolean, date: string): Promise<void> {
    await db.runAsync(
      `UPDATE tasks
       SET status = ?, completed_on = ?,
           column_id = CASE
             WHEN project_id IS NULL THEN column_id
             WHEN ? = 1 THEN COALESCE(
               (SELECT id FROM project_columns
                WHERE project_id = tasks.project_id AND deleted_at IS NULL
                ORDER BY position DESC, created_at DESC LIMIT 1),
               column_id
             )
             ELSE COALESCE(
               (SELECT id FROM project_columns
                WHERE project_id = tasks.project_id AND deleted_at IS NULL
                ORDER BY position, created_at LIMIT 1),
               column_id
             )
           END,
           updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      completed ? 'DONE' : 'OPEN',
      completed ? date : null,
      completed ? 1 : 0,
      now(),
      id,
    );
  },

  async update(
    db: SQLiteDatabase,
    id: string,
    draft: TaskDraft,
    status: TaskItem['status'],
    completedOn: string | null,
  ): Promise<void> {
    await db.runAsync(
      `UPDATE tasks
       SET title = ?, notes = ?, due_date = ?, priority = ?, project_id = ?, column_id = ?,
           status = ?, completed_on = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      draft.title.trim(),
      draft.notes,
      draft.dueDate,
      draft.priority,
      draft.projectId,
      draft.columnId,
      status,
      completedOn,
      now(),
      id,
    );
  },

  async archive(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync(
      `UPDATE tasks SET status = 'ARCHIVED', completed_on = NULL, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      now(),
      id,
    );
  },

  async listArchived(db: SQLiteDatabase): Promise<ArchivedTask[]> {
    const rows = await db.getAllAsync<TaskRow & { project_name: string | null }>(
      `SELECT t.id, t.title, t.notes, t.due_date, t.priority, t.status, t.completed_on,
              t.project_id, t.column_id, t.created_at, t.updated_at, p.name AS project_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.deleted_at IS NULL AND t.status = 'ARCHIVED'
       ORDER BY t.updated_at DESC`,
    );
    return rows.map((row) => ({ ...mapTask(row), projectName: row.project_name }));
  },

  async restore(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync(
      `UPDATE tasks
       SET status = 'OPEN', completed_on = NULL,
           column_id = CASE
             WHEN project_id IS NULL THEN NULL
             ELSE COALESCE(
               (SELECT c.id FROM project_columns c
                WHERE c.project_id = tasks.project_id AND c.deleted_at IS NULL
                ORDER BY c.position, c.created_at LIMIT 1),
               column_id
             )
           END,
           updated_at = ?
       WHERE id = ? AND deleted_at IS NULL AND status = 'ARCHIVED'`,
      now(),
      id,
    );
  },

  async removePermanently(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync("DELETE FROM tasks WHERE id = ? AND status = 'ARCHIVED'", id);
  },

  async remove(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
  },
};

export const dailyLogRepository = {
  async get(db: SQLiteDatabase, date: string): Promise<DailyLog> {
    const row = await db.getFirstAsync<DailyLogRow>(
      'SELECT date, done_text, pending_text, notes FROM daily_logs WHERE date = ?',
      date,
    );
    return row
      ? { date: row.date, doneText: row.done_text, pendingText: row.pending_text, notes: row.notes }
      : { date, doneText: '', pendingText: '', notes: '' };
  },

  async save(db: SQLiteDatabase, log: DailyLog): Promise<void> {
    const timestamp = now();
    await db.runAsync(
      `INSERT INTO daily_logs (date, done_text, pending_text, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         done_text = excluded.done_text,
         pending_text = excluded.pending_text,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
      log.date,
      log.doneText,
      log.pendingText,
      log.notes,
      timestamp,
      timestamp,
    );
  },
};

export const projectRepository = {
  async list(db: SQLiteDatabase): Promise<ProjectSummary[]> {
    return db.getAllAsync<ProjectSummary>(
      `SELECT p.id, p.name, p.description, p.color, p.created_at AS createdAt,
              COUNT(DISTINCT CASE WHEN t.status = 'OPEN' AND t.deleted_at IS NULL THEN t.id END) AS openTasks,
              COUNT(DISTINCT CASE WHEN c.deleted_at IS NULL THEN c.id END) AS columnCount
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       LEFT JOIN project_columns c ON c.project_id = p.id
       WHERE p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY p.position, p.created_at DESC`,
    );
  },

  async listDestinations(db: SQLiteDatabase): Promise<ProjectDestination[]> {
    const [projects, columns] = await Promise.all([
      db.getAllAsync<Pick<ProjectRow, 'id' | 'name'>>(
        `SELECT id, name FROM projects
         WHERE deleted_at IS NULL ORDER BY position, created_at DESC`,
      ),
      db.getAllAsync<ProjectColumnRow & { project_id: string }>(
        `SELECT id, project_id, name, position FROM project_columns
         WHERE deleted_at IS NULL ORDER BY position, created_at`,
      ),
    ]);
    return projects.map((project) => ({
      ...project,
      columns: columns
        .filter((column) => column.project_id === project.id)
        .map(({ id, name, position }) => ({ id, name, position })),
    }));
  },

  async create(db: SQLiteDatabase, name: string, columnNames: readonly string[]): Promise<void> {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      const timestamp = now();
      const projectId = Crypto.randomUUID();
      await transaction.runAsync(
        `INSERT INTO projects
          (id, area_id, name, color, created_at, updated_at)
         VALUES (?, ?, ?, '#6366F1', ?, ?)`,
        projectId,
        GENERAL_AREA_ID,
        name.trim(),
        timestamp,
        timestamp,
      );
      for (const [position, columnName] of columnNames.entries()) {
        await transaction.runAsync(
          `INSERT INTO project_columns
            (id, project_id, name, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          Crypto.randomUUID(),
          projectId,
          columnName,
          position,
          timestamp,
          timestamp,
        );
      }
    });
  },

  async getById(db: SQLiteDatabase, id: string): Promise<ProjectDetail | null> {
    const project = await db.getFirstAsync<ProjectRow>(
      `SELECT id, name, description, color
       FROM projects
       WHERE id = ? AND deleted_at IS NULL`,
      id,
    );
    if (!project) return null;

    const [columns, taskRows] = await Promise.all([
      db.getAllAsync<ProjectColumnRow>(
        `SELECT id, name, position
         FROM project_columns
         WHERE project_id = ? AND deleted_at IS NULL
         ORDER BY position, created_at`,
        id,
      ),
      db.getAllAsync<TaskRow>(
        `${TASK_SELECT}
         WHERE project_id = ? AND deleted_at IS NULL AND status != 'ARCHIVED'
         ORDER BY position, created_at`,
        id,
      ),
    ]);
    const tasks = taskRows.map(mapTask);

    return {
      ...project,
      columns: columns.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.columnId === column.id),
      })),
    };
  },

  async createTask(db: SQLiteDatabase, projectId: string, columnId: string, title: string): Promise<void> {
    const timestamp = now();
    const positionRow = await db.getFirstAsync<{ position: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS position FROM tasks WHERE column_id = ?',
      columnId,
    );
    await db.runAsync(
      `INSERT INTO tasks
        (id, area_id, project_id, column_id, title, status, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)`,
      Crypto.randomUUID(),
      GENERAL_AREA_ID,
      projectId,
      columnId,
      title.trim(),
      positionRow?.position ?? 0,
      timestamp,
      timestamp,
    );
  },

  async moveTask(db: SQLiteDatabase, taskId: string, columnId: string, completedOn: string | null): Promise<void> {
    await db.runAsync(
      `UPDATE tasks
       SET column_id = ?, status = ?, completed_on = ?, updated_at = ?
       WHERE id = ?`,
      columnId,
      completedOn ? 'DONE' : 'OPEN',
      completedOn,
      now(),
      taskId,
    );
  },
};

export const calendarRepository = {
  async listRange(db: SQLiteDatabase, startDate: string, endDate: string): Promise<CalendarItem[]> {
    const tasks = await db.getAllAsync<CalendarItem>(
      `SELECT id, 'task' AS kind, title, due_date AS date,
              CASE WHEN status = 'DONE' THEN 1 ELSE 0 END AS completed,
              '#6366F1' AS color
       FROM tasks
       WHERE deleted_at IS NULL AND status != 'ARCHIVED' AND due_date BETWEEN ? AND ?`,
      startDate,
      endDate,
    );
    const events = await db.getAllAsync<CalendarItem>(
      `SELECT id, 'event' AS kind, title, substr(start_at, 1, 10) AS date,
              0 AS completed, color
       FROM events
       WHERE deleted_at IS NULL AND substr(start_at, 1, 10) BETWEEN ? AND ?`,
      startDate,
      endDate,
    );
    return [...tasks, ...events].sort((left, right) => left.date.localeCompare(right.date));
  },

  async listMonth(db: SQLiteDatabase, month: string): Promise<CalendarItem[]> {
    const tasks = await db.getAllAsync<CalendarItem>(
      `SELECT id, 'task' AS kind, title, due_date AS date,
              CASE WHEN status = 'DONE' THEN 1 ELSE 0 END AS completed,
              '#6366F1' AS color
       FROM tasks
       WHERE deleted_at IS NULL AND status != 'ARCHIVED' AND due_date LIKE ?`,
      `${month}%`,
    );
    const events = await db.getAllAsync<CalendarItem>(
      `SELECT id, 'event' AS kind, title, substr(start_at, 1, 10) AS date,
              0 AS completed, color
       FROM events
       WHERE deleted_at IS NULL AND start_at LIKE ?`,
      `${month}%`,
    );
    return [...tasks, ...events].sort((left, right) => left.date.localeCompare(right.date));
  },
};

export const dashboardRepository = {
  async getSummary(db: SQLiteDatabase, date: string): Promise<DashboardSummary> {
    const row = await db.getFirstAsync<DashboardSummary>(
      `SELECT
        (SELECT COUNT(*) FROM inbox_items WHERE deleted_at IS NULL) AS inboxCount,
        (SELECT COUNT(*) FROM tasks
         WHERE deleted_at IS NULL AND status = 'OPEN' AND due_date < ?) AS overdueCount,
        (SELECT COUNT(*) FROM tasks
         WHERE deleted_at IS NULL AND status = 'OPEN' AND due_date = ?) AS todayCount,
        (SELECT COUNT(*) FROM tasks
         WHERE deleted_at IS NULL AND status = 'OPEN' AND due_date IS NULL) AS unscheduledCount,
        (SELECT COUNT(*) FROM tasks
         WHERE deleted_at IS NULL AND status = 'DONE' AND completed_on = ?) AS completedTodayCount,
        (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS activeProjectCount,
        (SELECT COUNT(*) FROM tasks
         WHERE deleted_at IS NULL AND status = 'ARCHIVED') AS archivedCount`,
      date,
      date,
      date,
    );
    return row ?? {
      inboxCount: 0,
      overdueCount: 0,
      todayCount: 0,
      unscheduledCount: 0,
      completedTodayCount: 0,
      activeProjectCount: 0,
      archivedCount: 0,
    };
  },
};
