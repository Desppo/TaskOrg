import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { GENERAL_AREA_ID } from './database';
import type {
  ArchivedTask,
  CalendarItem,
  DashboardSummary,
  DailyLog,
  InboxItem,
  Milestone,
  OccurrenceWithTask,
  ProjectDestination,
  ProjectDetail,
  ProjectSummary,
  RecurrenceDraft,
  RecurrenceFrequency,
  RecurrenceRule,
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
  icon: string;
  pinned: number;
  archived_at: string | null;
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
         AND id NOT IN (SELECT task_id FROM task_recurrence_rules)
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
         AND id NOT IN (SELECT task_id FROM task_recurrence_rules)
       ORDER BY updated_at DESC`,
      date,
    );
    return rows.map(mapTask);
  },

  async listUpcoming(db: SQLiteDatabase, afterDate: string): Promise<TaskItem[]> {
    const rows = await db.getAllAsync<TaskRow>(
      `${TASK_SELECT}
       WHERE deleted_at IS NULL AND status = 'OPEN'
         AND due_date > ?
         AND id NOT IN (SELECT task_id FROM task_recurrence_rules)
       ORDER BY due_date ASC, priority DESC, created_at ASC`,
      afterDate,
    );
    return rows.map(mapTask);
  },

  async listUnscheduled(db: SQLiteDatabase): Promise<TaskItem[]> {
    const rows = await db.getAllAsync<TaskRow>(
      `${TASK_SELECT}
       WHERE deleted_at IS NULL AND status = 'OPEN'
         AND due_date IS NULL
         AND id NOT IN (SELECT task_id FROM task_recurrence_rules)
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

  async getLastDate(db: SQLiteDatabase): Promise<string | null> {
    const row = await db.getFirstAsync<{ date: string }>(
      `SELECT date FROM daily_logs
       WHERE done_text != '' OR pending_text != '' OR notes != ''
       ORDER BY date DESC
       LIMIT 1`,
    );
    return row?.date ?? null;
  },
};

export const projectRepository = {
  async list(db: SQLiteDatabase, archived = false): Promise<ProjectSummary[]> {
    return db.getAllAsync<ProjectSummary>(
      `SELECT p.id, p.name, p.description, p.color, p.icon, p.pinned,
              p.archived_at AS archivedAt, p.created_at AS createdAt,
              COUNT(DISTINCT CASE WHEN t.status = 'OPEN' AND t.deleted_at IS NULL THEN t.id END) AS openTasks,
              COUNT(DISTINCT CASE WHEN t.deleted_at IS NULL AND t.status != 'ARCHIVED' THEN t.id END) AS totalTasks,
              COUNT(DISTINCT CASE WHEN c.deleted_at IS NULL THEN c.id END) AS columnCount
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       LEFT JOIN project_columns c ON c.project_id = p.id
       WHERE p.deleted_at IS NULL AND ${archived ? 'p.archived_at IS NOT NULL' : 'p.archived_at IS NULL'}
       GROUP BY p.id
       ORDER BY p.pinned DESC, p.position, p.created_at DESC`,
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

  async togglePin(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync(
      'UPDATE projects SET pinned = CASE WHEN pinned = 0 THEN 1 ELSE 0 END, updated_at = ? WHERE id = ?',
      now(), id,
    );
  },

  async archive(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync(
      'UPDATE projects SET archived_at = ?, pinned = 0, updated_at = ? WHERE id = ?',
      now(), now(), id,
    );
  },

  async unarchive(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync(
      'UPDATE projects SET archived_at = NULL, updated_at = ? WHERE id = ?',
      now(), id,
    );
  },

  async updateMetadata(
    db: SQLiteDatabase,
    id: string,
    meta: { color?: string; icon?: string; description?: string | null },
  ): Promise<void> {
    const timestamp = now();
    if (meta.color !== undefined) {
      await db.runAsync('UPDATE projects SET color = ?, updated_at = ? WHERE id = ?', meta.color, timestamp, id);
    }
    if (meta.icon !== undefined) {
      await db.runAsync('UPDATE projects SET icon = ?, updated_at = ? WHERE id = ?', meta.icon, timestamp, id);
    }
    if (meta.description !== undefined) {
      await db.runAsync('UPDATE projects SET description = ?, updated_at = ? WHERE id = ?', meta.description ?? null, timestamp, id);
    }
  },

  async getById(db: SQLiteDatabase, id: string): Promise<ProjectDetail | null> {
    const project = await db.getFirstAsync<ProjectRow>(
      `SELECT id, name, description, color, icon
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
      allTasks: tasks,
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

// ─── Milestone helpers ────────────────────────────────────────────────────────

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  target_date: string | null;
  completed: number;
  created_at: string;
}

function mapMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    targetDate: row.target_date,
    completed: row.completed === 1,
    createdAt: row.created_at,
  };
}

export const milestoneRepository = {
  async list(db: SQLiteDatabase, projectId: string): Promise<Milestone[]> {
    const rows = await db.getAllAsync<MilestoneRow>(
      'SELECT id, project_id, title, target_date, completed, created_at FROM project_milestones WHERE project_id = ? ORDER BY created_at',
      projectId,
    );
    return rows.map(mapMilestone);
  },

  async create(db: SQLiteDatabase, projectId: string, title: string, targetDate: string | null = null): Promise<void> {
    const timestamp = now();
    await db.runAsync(
      'INSERT INTO project_milestones (id, project_id, title, target_date, completed, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
      Crypto.randomUUID(),
      projectId,
      title.trim(),
      targetDate,
      timestamp,
      timestamp,
    );
  },

  async toggle(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync(
      'UPDATE project_milestones SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END, updated_at = ? WHERE id = ?',
      now(),
      id,
    );
  },

  async remove(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync('DELETE FROM project_milestones WHERE id = ?', id);
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
        (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND archived_at IS NULL) AS activeProjectCount,
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

// ─── Recurrence helpers ───────────────────────────────────────────────────────

function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function keyToDate(value: string): Date {
  const parts = value.split('-').map(Number);
  return new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

function weekStart(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const offset = (result.getDay() + 6) % 7; // Monday-based
  result.setDate(result.getDate() - offset);
  return result;
}

function generateOccurrenceDates(
  rule: RecurrenceRule,
  from: string,
  upTo: string,
): string[] {
  const effectiveStart = rule.startDate > from ? rule.startDate : from;
  const effectiveEnd = rule.endDate && rule.endDate < upTo ? rule.endDate : upTo;
  if (effectiveStart > effectiveEnd) return [];

  const fromD = keyToDate(effectiveStart);
  const endD = keyToDate(effectiveEnd);
  const interval = Math.max(1, rule.intervalValue);
  const result: string[] = [];

  if (rule.frequency === 'DAILY') {
    const startD = keyToDate(rule.startDate);
    const msPerDay = 86_400_000;
    const totalDays = Math.round((fromD.getTime() - startD.getTime()) / msPerDay);
    const remainder = ((totalDays % interval) + interval) % interval;
    const skip = remainder === 0 ? 0 : interval - remainder;
    const cur = new Date(fromD);
    cur.setDate(cur.getDate() + skip);
    while (cur <= endD) {
      result.push(dateToKey(cur));
      cur.setDate(cur.getDate() + interval);
    }
  } else if (rule.frequency === 'WEEKLY') {
    const startD = keyToDate(rule.startDate);
    const anchorWeek = weekStart(startD);
    const days = rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [startD.getDay()];
    const cur = new Date(fromD);
    while (cur <= endD) {
      const dow = cur.getDay();
      if (days.includes(dow)) {
        const curWeek = weekStart(cur);
        const diff = Math.round((curWeek.getTime() - anchorWeek.getTime()) / (7 * 86_400_000));
        if (diff >= 0 && diff % interval === 0) result.push(dateToKey(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    // MONTHLY
    const startD = keyToDate(rule.startDate);
    const dom = startD.getDate();
    let yr = startD.getFullYear();
    let mo = startD.getMonth();
    // Fast-forward to first month that produces a date >= fromD
    while (true) {
      const days = new Date(yr, mo + 1, 0).getDate();
      const candidate = new Date(yr, mo, Math.min(dom, days));
      if (candidate >= fromD) break;
      mo += interval;
      yr += Math.floor(mo / 12);
      mo = ((mo % 12) + 12) % 12;
    }
    while (true) {
      const days = new Date(yr, mo + 1, 0).getDate();
      const candidate = new Date(yr, mo, Math.min(dom, days));
      if (candidate > endD) break;
      const key = dateToKey(candidate);
      if (key >= effectiveStart) result.push(key);
      mo += interval;
      yr += Math.floor(mo / 12);
      mo = ((mo % 12) + 12) % 12;
    }
  }

  return result;
}

interface RecurrenceRuleRow {
  id: string;
  task_id: string;
  frequency: string;
  interval_value: number;
  days_of_week: string;
  start_date: string;
  end_date: string | null;
}

function mapRule(row: RecurrenceRuleRow): RecurrenceRule {
  return {
    id: row.id,
    taskId: row.task_id,
    frequency: row.frequency as RecurrenceFrequency,
    intervalValue: row.interval_value,
    daysOfWeek: JSON.parse(row.days_of_week) as number[],
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

const HORIZON_DAYS = 90;

export const recurrenceRepository = {
  async getRule(db: SQLiteDatabase, taskId: string): Promise<RecurrenceRule | null> {
    const row = await db.getFirstAsync<RecurrenceRuleRow>(
      'SELECT * FROM task_recurrence_rules WHERE task_id = ?',
      taskId,
    );
    return row ? mapRule(row) : null;
  },

  async saveRule(
    db: SQLiteDatabase,
    taskId: string,
    draft: RecurrenceDraft,
    startDate: string,
  ): Promise<void> {
    const timestamp = now();
    await db.runAsync(
      `INSERT INTO task_recurrence_rules
        (id, task_id, frequency, interval_value, days_of_week, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(task_id) DO UPDATE SET
         frequency      = excluded.frequency,
         interval_value = excluded.interval_value,
         days_of_week   = excluded.days_of_week,
         start_date     = excluded.start_date,
         end_date       = excluded.end_date,
         updated_at     = excluded.updated_at`,
      Crypto.randomUUID(),
      taskId,
      draft.frequency,
      draft.intervalValue,
      JSON.stringify(draft.daysOfWeek),
      startDate,
      draft.endDate,
      timestamp,
      timestamp,
    );
  },

  async deleteRule(db: SQLiteDatabase, taskId: string): Promise<void> {
    // task_occurrences cascade-deletes via FK
    await db.runAsync('DELETE FROM task_recurrence_rules WHERE task_id = ?', taskId);
  },

  /** Generate occurrences for a single rule from `from` to `from + HORIZON_DAYS`. */
  async generateForRule(db: SQLiteDatabase, rule: RecurrenceRule, from: string): Promise<void> {
    const upToD = keyToDate(from);
    upToD.setDate(upToD.getDate() + HORIZON_DAYS);
    const upTo = dateToKey(upToD);
    const dates = generateOccurrenceDates(rule, from, upTo);
    const timestamp = now();
    for (const d of dates) {
      await db.runAsync(
        `INSERT OR IGNORE INTO task_occurrences
          (id, task_id, occurrence_date, skipped, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
        Crypto.randomUUID(),
        rule.taskId,
        d,
        timestamp,
        timestamp,
      );
    }
  },

  /** Generate occurrences for ALL active rules, called on Tasks screen mount. */
  async generateAll(db: SQLiteDatabase, today: string): Promise<void> {
    const rows = await db.getAllAsync<RecurrenceRuleRow>(
      `SELECT r.* FROM task_recurrence_rules r
       JOIN tasks t ON t.id = r.task_id
       WHERE t.deleted_at IS NULL AND t.status = 'OPEN'`,
    );
    for (const row of rows) {
      const rule = mapRule(row);
      if (rule.endDate && rule.endDate < today) continue;
      await recurrenceRepository.generateForRule(db, rule, today);
    }
  },

  /**
   * Latest pending occurrence per task with occurrence_date <= today.
   * (Handles overdue recurring tasks — shows only the most recent pending one.)
   */
  async listTodayOccurrences(
    db: SQLiteDatabase,
    date: string,
  ): Promise<OccurrenceWithTask[]> {
    return db.getAllAsync<OccurrenceWithTask>(
      `SELECT o.id AS occurrenceId, o.task_id AS taskId, MAX(o.occurrence_date) AS occurrenceDate,
              t.title, t.notes, t.priority, r.frequency
       FROM task_occurrences o
       JOIN tasks t ON t.id = o.task_id AND t.deleted_at IS NULL AND t.status = 'OPEN'
       JOIN task_recurrence_rules r ON r.task_id = o.task_id
       WHERE o.occurrence_date <= ?
         AND o.completed_on IS NULL
         AND o.skipped = 0
       GROUP BY o.task_id
       ORDER BY t.priority DESC, occurrenceDate ASC`,
      date,
    );
  },

  /**
   * Next pending occurrence per task with occurrence_date > today.
   * Only the earliest future occurrence per recurring task.
   */
  async listNextOccurrences(
    db: SQLiteDatabase,
    date: string,
  ): Promise<OccurrenceWithTask[]> {
    return db.getAllAsync<OccurrenceWithTask>(
      `SELECT o.id AS occurrenceId, o.task_id AS taskId, MIN(o.occurrence_date) AS occurrenceDate,
              t.title, t.notes, t.priority, r.frequency
       FROM task_occurrences o
       JOIN tasks t ON t.id = o.task_id AND t.deleted_at IS NULL AND t.status = 'OPEN'
       JOIN task_recurrence_rules r ON r.task_id = o.task_id
       WHERE o.occurrence_date > ?
         AND o.completed_on IS NULL
         AND o.skipped = 0
       GROUP BY o.task_id
       ORDER BY occurrenceDate ASC, t.priority DESC`,
      date,
    );
  },

  async completeOccurrence(
    db: SQLiteDatabase,
    occurrenceId: string,
    date: string,
  ): Promise<void> {
    await db.runAsync(
      'UPDATE task_occurrences SET completed_on = ?, updated_at = ? WHERE id = ?',
      date,
      now(),
      occurrenceId,
    );
  },

  async uncompleteOccurrence(db: SQLiteDatabase, occurrenceId: string): Promise<void> {
    await db.runAsync(
      'UPDATE task_occurrences SET completed_on = NULL, updated_at = ? WHERE id = ?',
      now(),
      occurrenceId,
    );
  },
};
