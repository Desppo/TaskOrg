export type Priority = 0 | 1 | 2 | 3;

export interface InboxItem {
  id: string;
  content: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: Priority;
  status: 'OPEN' | 'DONE' | 'ARCHIVED';
  completedOn: string | null;
  projectId: string | null;
  columnId: string | null;
  milestoneId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDraft {
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: Priority;
  projectId: string | null;
  columnId: string | null;
  milestoneId: string | null;
}

export interface ArchivedTask extends TaskItem {
  projectName: string | null;
}

export interface DashboardSummary {
  inboxCount: number;
  overdueCount: number;
  todayCount: number;
  unscheduledCount: number;
  completedTodayCount: number;
  activeProjectCount: number;
  archivedCount: number;
}

export interface DailyLog {
  date: string;
  doneText: string;
  pendingText: string;
  notes: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  pinned: number;       // 0 | 1
  archivedAt: string | null;
  openTasks: number;
  totalTasks: number;
  columnCount: number;
  createdAt: string;
}

export interface ProjectColumn {
  id: string;
  name: string;
  position: number;
  tasks: TaskItem[];
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  columns: ProjectColumn[];
  allTasks: TaskItem[];
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  targetDate: string | null;
  completed: boolean;
  createdAt: string;
}

export interface ProjectColumnDestination {
  id: string;
  name: string;
  position: number;
}

export interface ProjectDestination {
  id: string;
  name: string;
  columns: ProjectColumnDestination[];
}

export interface CalendarItem {
  id: string;
  kind: 'task' | 'event';
  title: string;
  date: string;
  completed: boolean;
  color: string;
}

// ─── Recurrence ──────────────────────────────────────────────────────────────

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurrenceRule {
  id: string;
  taskId: string;
  frequency: RecurrenceFrequency;
  intervalValue: number;
  daysOfWeek: number[]; // 0=Sun … 6=Sat, only meaningful for WEEKLY
  startDate: string;
  endDate: string | null;
  endType: 'none' | 'date' | 'duration';
  endValue: string | null; // e.g. '2026-08-11' for date, '5' for duration
}

/** Shape used to create or update a rule (no id/taskId needed from the UI) */
export interface RecurrenceDraft {
  frequency: RecurrenceFrequency;
  intervalValue: number;
  daysOfWeek: number[];
  endDate: string | null;
  endType: 'none' | 'date' | 'duration';
  endValue: string | null;
}

/** A single occurrence of a recurring task, joined with its parent task data */
export interface OccurrenceWithTask {
  occurrenceId: string;
  taskId: string;
  title: string;
  notes: string | null;
  priority: number;
  occurrenceDate: string;
  frequency: RecurrenceFrequency;
}

