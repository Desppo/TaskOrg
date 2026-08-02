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
  openTasks: number;
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
  columns: ProjectColumn[];
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
