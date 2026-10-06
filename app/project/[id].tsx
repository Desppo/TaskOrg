import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionButton,
  AppInput,
  BackButton,
  Card,
  LoadingView,
  Screen,
} from "@/components/ui";
import { ProgressBar } from "@/components/projects/progress-bar";
import { milestoneRepository, projectRepository, taskRepository } from "@/data/repositories";
import { flushPendingWrites, queueWrite } from "@/data/pending-writes";
import type { Milestone, ProjectDetail, TaskItem } from "@/data/types";
import { useDataVersion } from "@/providers/data-version-provider";
import { useLanguage } from "@/providers/language-provider";
import { useAppTheme } from "@/theme/theme";
import { toDateKey } from "@/utils/date";
import type { SQLiteDatabase } from "expo-sqlite";

const PROJECT_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444",
  "#F97316", "#D97706", "#22C55E", "#14B8A6",
  "#06B6D4", "#3B82F6", "#64748B", "#E879F9",
] as const;

const PROJECT_ICONS = [
  "folder", "rocket", "code-slash", "heart",
  "star", "briefcase", "school", "fitness",
  "home", "planet", "leaf", "musical-notes",
  "camera", "car", "build", "cube",
  "diamond", "flash", "flag", "gift",
] as const;

type ProjectTab = "kanban" | "list" | "milestones" | "notes";

function TabBar({ active, onSelect, color }: { active: ProjectTab; onSelect: (t: ProjectTab) => void; color: string }) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  const tabs: { id: ProjectTab; icon: string; label: string }[] = [
    { id: "kanban", icon: "grid-outline", label: t("projectKanban") },
    { id: "list", icon: "list-outline", label: t("projectListView") },
    { id: "milestones", icon: "flag-outline", label: t("projectMilestones") },
    { id: "notes", icon: "document-text-outline", label: t("projectNotes") },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={[styles.tabChip, { backgroundColor: isActive ? `${color}22` : "transparent", borderColor: isActive ? color : theme.border, borderWidth: 1 }]}
          >
            <Ionicons color={isActive ? color : theme.textMuted} name={tab.icon as any} size={14} />
            <Text style={[styles.tabLabel, { color: isActive ? color : theme.textMuted, fontWeight: isActive ? "800" : "600" }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MoveButton({ accessibilityLabel, disabled, icon, onPress }: { accessibilityLabel: string; disabled: boolean; icon: "arrow-back" | "arrow-forward"; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.moveButton, { backgroundColor: theme.surfaceRaised, opacity: disabled ? 0.25 : pressed ? 0.6 : 1 }]}
    >
      <Ionicons color={theme.text} name={icon} size={17} />
    </Pressable>
  );
}

function CustomizeModal({ visible, color, icon, onClose, onSave }: { visible: boolean; color: string; icon: string; onClose: () => void; onSave: (color: string, icon: string) => void }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [selColor, setSelColor] = useState(color);
  const [selIcon, setSelIcon] = useState(icon);
  useEffect(() => { if (visible) { setSelColor(color); setSelIcon(icon); } }, [visible, color, icon]);
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={[styles.modalScrim, { backgroundColor: theme.scrim }]}>
        <Pressable accessibilityViewIsModal style={[styles.modalSheet, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: Math.max(12, insets.bottom), maxHeight: '90%' }]}>
          <ScrollView contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: theme.text }]}>{t("customizeProject")}</Text>
          <Text style={[styles.sheetSection, { color: theme.textMuted }]}>{t("projectColor")}</Text>
          <View style={styles.colorRow}>
            {PROJECT_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setSelColor(c)} style={[styles.colorDot, { backgroundColor: c }, selColor === c && styles.colorDotSelected]}>
                {selColor === c && <Ionicons color="#fff" name="checkmark" size={14} />}
              </Pressable>
            ))}
          </View>
          <Text style={[styles.sheetSection, { color: theme.textMuted }]}>{t("projectIcon")}</Text>
          <View style={styles.iconRow}>
            {PROJECT_ICONS.map((ic) => (
              <Pressable key={ic} onPress={() => setSelIcon(ic)} style={[styles.iconDot, { backgroundColor: selIcon === ic ? `${selColor}22` : theme.surfaceRaised, borderColor: selIcon === ic ? selColor : "transparent", borderWidth: 1.5 }]}>
                <Ionicons color={selIcon === ic ? selColor : theme.textMuted} name={ic as any} size={20} />
              </Pressable>
            ))}
          </View>
          <ActionButton label={t("save")} onPress={() => { onSave(selColor, selIcon); onClose(); }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useLanguage();
  const { refresh, version } = useDataVersion();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProjectTab>("kanban");
  const [taskTitle, setTaskTitle] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "date">("priority");
  const [showCustomize, setShowCustomize] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesError, setNotesError] = useState(false);
  const notesGeneration = useRef(0);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const today = useMemo(() => toDateKey(new Date()), []);

  useEffect(() => {
    let active = true;
    if (!projectId) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    const generation = notesGeneration.current;
    flushPendingWrites(db).then(() => Promise.all([projectRepository.getById(db, projectId), milestoneRepository.list(db, projectId)]))
      .then(([nextProject, nextMilestones]) => {
        if (active) {
          setProject(nextProject);
          setMilestones(nextMilestones);
          if (nextProject && generation === notesGeneration.current) setNotesText(nextProject.description ?? "");
        }
      })
      .catch(() => { if (active) Alert.alert(t('projectNotes'), t('errorGeneric')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, projectId, version]);

  function saveNotes(text: string) {
    if (!projectId) return;
    const generation = ++notesGeneration.current;
    setNotesText(text);
    setNotesDirty(true);
    setNotesError(false);
    void queueWrite(db, `project-notes:${projectId}`, () => projectRepository.updateMetadata(db, projectId, { description: text }))
      .then(() => { if (generation === notesGeneration.current) setNotesDirty(false); })
      .catch(() => { if (generation === notesGeneration.current) setNotesError(true); });
  }

  async function addTask() {
    const firstColumn = project?.columns[0];
    if (!project || !firstColumn || !taskTitle.trim()) return;
    await projectRepository.createTask(db, project.id, firstColumn.id, taskTitle);
    setTaskTitle(""); refresh();
  }

  async function moveTask(task: TaskItem, columnIndex: number, direction: -1 | 1) {
    if (!project) return;
    const nextIndex = columnIndex + direction;
    const nextColumn = project.columns[nextIndex];
    if (!nextColumn) return;
    const completedOn = nextIndex === project.columns.length - 1 ? today : null;
    await projectRepository.moveTask(db, task.id, nextColumn.id, completedOn);
    refresh();
  }

  async function addMilestone() {
    if (!project || !milestoneTitle.trim()) return;
    await milestoneRepository.create(db, project.id, milestoneTitle);
    setMilestoneTitle(""); refresh();
  }

  async function handleSaveCustomize(color: string, icon: string) {
    if (!project) return;
    await projectRepository.updateMetadata(db, project.id, { color, icon });
    refresh();
  }

  const sortedTasks = useMemo(() => {
    if (!project) return [];
    const tasks = [...project.allTasks];
    if (sortBy === "priority") return tasks.sort((a, b) => b.priority - a.priority);
    return tasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [project, sortBy]);

  if (loading) return <Screen><LoadingView /></Screen>;
  if (!project) {
    return (
      <Screen>
        <BackButton label={t("back")} onPress={() => router.back()} />
        <Card><Text style={[styles.emptyText, { color: theme.textMuted }]}>{t("projectNotFound")}</Text></Card>
      </Screen>
    );
  }

  const doneTasks = project.allTasks.filter((tk) => tk.status === "DONE").length;

  return (
    <Screen>
      <BackButton label={t("back")} onPress={() => router.back()} />

      <View style={styles.projectHeader}>
        <View style={[styles.projectIconWrap, { backgroundColor: `${project.color}20` }]}>
          <Ionicons color={project.color} name={project.icon as any} size={26} />
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.projectTitle, { color: theme.text }]}>{project.name}</Text>
          {project.allTasks.length > 0 && (
            <ProgressBar color={project.color} completed={doneTasks} total={project.allTasks.length} height={4} />
          )}
        </View>
        <Pressable onPress={() => setShowCustomize(true)} style={[styles.settingsBtn, { backgroundColor: theme.surfaceRaised }]}>
          <Ionicons color={theme.textMuted} name="color-palette-outline" size={19} />
        </Pressable>
      </View>

      <TabBar active={tab} color={project.color} onSelect={setTab} />

      {tab === "kanban" && (
        <>
          <Card style={styles.inputCard} tone="accent">
            <View style={styles.inputRow}>
              <AppInput onChangeText={setTaskTitle} onSubmitEditing={() => void addTask()} placeholder={t("projectTaskPlaceholder")} returnKeyType="done" style={styles.flex} value={taskTitle} />
              <ActionButton disabled={!taskTitle.trim() || project.columns.length === 0} icon="add" label={t("add")} onPress={() => void addTask()} />
            </View>
          </Card>
          {project.columns.map((column, columnIndex) => (
            <View key={column.id} style={styles.columnSection}>
              <View style={styles.columnHeader}>
                <View style={[styles.columnMarker, { backgroundColor: project.color }]} />
                <Text style={[styles.columnTitle, { color: theme.text }]}>{column.name}</Text>
                <Text style={[styles.count, { backgroundColor: theme.surfaceRaised, color: theme.textMuted }]}>{column.tasks.length}</Text>
              </View>
              {column.tasks.length === 0 ? (
                <Text style={[styles.emptyColumn, { borderColor: theme.border, color: theme.textMuted }]}>{t("projectEmptyColumn")}</Text>
              ) : (
                <View style={styles.taskList}>
                  {column.tasks.map((task) => (
                    <Card key={task.id} style={styles.taskCard}>
                      <Pressable onPress={() => router.push(`/task/${task.id}`)} style={styles.flex}>
                        <Text style={[styles.taskTitle, task.status === "DONE" && styles.taskDone, { color: task.status === "DONE" ? theme.textMuted : theme.text }]}>{task.title}</Text>
                      </Pressable>
                      <View style={styles.moveRow}>
                        <MoveButton accessibilityLabel={t("movePrevious")} disabled={columnIndex === 0} icon="arrow-back" onPress={() => void moveTask(task, columnIndex, -1)} />
                        <MoveButton accessibilityLabel={t("moveNext")} disabled={columnIndex === project.columns.length - 1} icon="arrow-forward" onPress={() => void moveTask(task, columnIndex, 1)} />
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {tab === "list" && (
        <>
          <View style={styles.sortRow}>
            {(["priority", "date"] as const).map((s) => (
              <Pressable key={s} onPress={() => setSortBy(s)} style={[styles.sortChip, { backgroundColor: sortBy === s ? `${project.color}22` : theme.surfaceRaised, borderColor: sortBy === s ? project.color : "transparent", borderWidth: 1 }]}>
                <Text style={[styles.sortChipText, { color: sortBy === s ? project.color : theme.textMuted }]}>{s === "priority" ? t("sortByPriority") : t("sortByDate")}</Text>
              </Pressable>
            ))}
          </View>
          {sortedTasks.length === 0 ? (
            <Card><Text style={[styles.emptyText, { color: theme.textMuted }]}>{t("noTasks")}</Text></Card>
          ) : (
            <View style={styles.taskList}>
              {sortedTasks.map((task) => {
                const col = project.columns.find((c) => c.id === task.columnId);
                return (
                  <Card key={task.id} style={styles.listTaskCard}>
                    <Pressable onPress={() => router.push(`/task/${task.id}`)} style={styles.flex}>
                      <View style={styles.listTaskRow}>
                        <View style={[styles.columnDot, { backgroundColor: project.color }]} />
                        <View style={styles.flex}>
                          <Text numberOfLines={1} style={[styles.taskTitle, task.status === "DONE" && styles.taskDone, { color: task.status === "DONE" ? theme.textMuted : theme.text }]}>{task.title}</Text>
                          {col && <Text style={[styles.colLabel, { color: theme.textMuted }]}>{col.name}</Text>}
                        </View>
                        {task.priority > 0 && (
                          <View style={[styles.priorityBadge, { backgroundColor: task.priority === 3 ? theme.dangerSurface : task.priority === 2 ? theme.warningSurface : theme.accentSurface }]}>
                            <Ionicons color={task.priority === 3 ? theme.danger : task.priority === 2 ? theme.warning : theme.info} name="flag" size={11} />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          )}
        </>
      )}

      {tab === "milestones" && (
        <>
          <Card style={styles.inputCard} tone="accent">
            <View style={styles.inputRow}>
              <AppInput onChangeText={setMilestoneTitle} onSubmitEditing={() => void addMilestone()} placeholder={t("milestonePlaceholder")} returnKeyType="done" style={styles.flex} value={milestoneTitle} />
              <ActionButton disabled={!milestoneTitle.trim()} icon="add" label={t("add")} onPress={() => void addMilestone()} />
            </View>
          </Card>
          {milestones.length === 0 ? (
            <Card><Text style={[styles.emptyText, { color: theme.textMuted }]}>{t("milestonesEmpty")}</Text></Card>
          ) : (
            <View style={styles.taskList}>
              {milestones.map((ms) => (
                <Card key={ms.id} style={styles.milestoneCard}>
                  <Pressable
                    onPress={() => void milestoneRepository.toggle(db, ms.id).then(refresh)}
                    style={[styles.milestoneCheck, { backgroundColor: ms.completed ? project.color : "transparent", borderColor: ms.completed ? project.color : theme.borderStrong }]}
                  >
                    {ms.completed && <Ionicons color="#fff" name="checkmark" size={14} />}
                  </Pressable>
                  <Pressable onPress={() => setActiveMilestone(ms)} style={styles.flex}>
                    <Text style={[styles.milestoneTitle, { color: ms.completed ? theme.textMuted : theme.text }, ms.completed && styles.taskDone]}>{ms.title}</Text>
                    {ms.targetDate && <Text style={[styles.milestoneDate, { color: theme.textMuted }]}>{ms.targetDate}</Text>}
                    <Text style={{ fontSize: 12, marginTop: 2, color: theme.textMuted, fontWeight: '600' }}>
                      {t("milestoneTasksCount").replace("{count}", String(project.allTasks.filter(t => t.milestoneId === ms.id).length))}
                    </Text>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => void milestoneRepository.remove(db, ms.id).then(refresh)} style={styles.removeMilestone}>
                    <Ionicons color={theme.danger} name="trash-outline" size={16} />
                  </Pressable>
                </Card>
              ))}
            </View>
          )}
        </>
      )}

      {tab === "notes" && (
        <Card style={styles.notesCard}>
          <TextInput
            multiline
            accessibilityLabel={t('projectNotes')}
            onChangeText={saveNotes}
            placeholder={t("projectNotesPlaceholder")}
            placeholderTextColor={theme.textMuted}
            style={[styles.notesInput, { color: theme.text }]}
            value={notesText}
          />
          <Text accessibilityLiveRegion="polite" style={[styles.savedLabel, { color: notesError ? theme.danger : theme.textMuted }]}>
            {notesError ? t('notesSaveError') : notesDirty ? t('reviewSaving') : t('reviewSaved')}
          </Text>
          {notesError && <ActionButton label={t('save')} onPress={() => saveNotes(notesText)} />}
        </Card>
      )}

      <CustomizeModal visible={showCustomize} color={project.color} icon={project.icon} onClose={() => setShowCustomize(false)} onSave={(c, ic) => void handleSaveCustomize(c, ic)} />

      {activeMilestone && (
        <MilestoneTasksModal
          visible={!!activeMilestone}
          milestone={activeMilestone}
          project={project}
          onClose={() => setActiveMilestone(null)}
          db={db}
          refresh={refresh}
        />
      )}
    </Screen>
  );
}

function MilestoneTasksModal({ visible, milestone, project, onClose, db, refresh }: { visible: boolean; milestone: Milestone; project: ProjectDetail; onClose: () => void; db: SQLiteDatabase; refresh: () => void }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={[styles.modalScrim, { backgroundColor: theme.scrim }]}>
        <Pressable accessibilityViewIsModal style={[styles.modalSheet, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: Math.max(12, insets.bottom), maxHeight: '80%' }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: theme.text }]}>{milestone.title}</Text>
          <Text style={[styles.sheetSection, { color: theme.textMuted }]}>{t("assignTasks")}</Text>

          <ScrollView style={{ flexShrink: 1, marginTop: 8 }}>
            {project.allTasks.length === 0 ? (
              <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 20 }}>{t("milestoneTasksEmpty")}</Text>
            ) : (
              project.allTasks.map(task => {
                const isAssigned = task.milestoneId === milestone.id;
                return (
                  <Pressable
                    key={task.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={task.title}
                    accessibilityState={{ checked: isAssigned }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}
                    onPress={async () => {
                      await taskRepository.setMilestone(db, task.id, isAssigned ? null : milestone.id);
                      refresh();
                    }}
                  >
                    <View style={[styles.milestoneCheck, { backgroundColor: isAssigned ? project.color : 'transparent', borderColor: isAssigned ? project.color : theme.borderStrong, width: 24, height: 24, borderRadius: 8, borderWidth: isAssigned ? 0 : 2 }]}>
                      {isAssigned && <Ionicons color="#fff" name="checkmark" size={14} />}
                    </View>
                    <Text style={{ flex: 1, color: theme.text, fontSize: 15 }}>{task.title}</Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          <ActionButton label={t("save")} onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  projectHeader: { flexDirection: "row", alignItems: "center", gap: 13 },
  projectIconWrap: { alignItems: "center", borderRadius: 18, height: 54, justifyContent: "center", width: 54 },
  projectTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5, marginBottom: 6 },
  settingsBtn: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  tabBar: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  tabChip: { flexDirection: "row", alignItems: "center", borderRadius: 14, gap: 5, paddingHorizontal: 13, paddingVertical: 8 },
  tabLabel: { fontSize: 13 },
  inputCard: { gap: 0 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  columnSection: { gap: 10 },
  columnHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  columnMarker: { borderRadius: 3, height: 19, width: 4 },
  columnTitle: { fontSize: 17, fontWeight: "800" },
  count: { borderRadius: 10, fontSize: 11, fontWeight: "800", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3 },
  emptyColumn: { borderRadius: 16, borderStyle: "dashed", borderWidth: 1, fontSize: 13, padding: 16, textAlign: "center" },
  taskList: { gap: 8 },
  taskCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  listTaskCard: { paddingVertical: 12 },
  listTaskRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  columnDot: { borderRadius: 3, height: 20, width: 3 },
  colLabel: { fontSize: 11, marginTop: 3 },
  priorityBadge: { alignItems: "center", borderRadius: 8, height: 26, justifyContent: "center", width: 26 },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: "700" },
  taskDone: { textDecorationLine: "line-through" },
  moveRow: { flexDirection: "row", gap: 6 },
  moveButton: { alignItems: "center", borderRadius: 10, height: 36, justifyContent: "center", width: 38 },
  sortRow: { flexDirection: "row", gap: 8 },
  sortChip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  sortChipText: { fontSize: 12, fontWeight: "700" },
  milestoneCard: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14 },
  milestoneCheck: { alignItems: "center", borderRadius: 10, borderWidth: 2, height: 28, justifyContent: "center", width: 28 },
  milestoneTitle: { fontSize: 15, fontWeight: "700" },
  milestoneDate: { fontSize: 12, marginTop: 3 },
  removeMilestone: { padding: 6 },
  notesCard: { minHeight: 200 },
  notesInput: { fontSize: 15, lineHeight: 23, minHeight: 180, textAlignVertical: "top" },
  savedLabel: { fontSize: 12, marginTop: 8, textAlign: "right" },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  modalScrim: { flex: 1, justifyContent: "flex-end" },
  modalSheet: { borderRadius: 28, borderWidth: 1, margin: 12, padding: 24, gap: 16 },
  sheetHandle: { alignSelf: "center", backgroundColor: "#888", borderRadius: 3, height: 4, width: 40, marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  sheetSection: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 4 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  colorDotSelected: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconDot: { alignItems: "center", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
});
