import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  ActionButton,
  AppInput,
  Card,
  EmptyState,
  LoadingView,
  Screen,
  ScreenHeader,
  SectionHeader,
} from "@/components/ui";
import { ProgressBar } from "@/components/projects/progress-bar";
import { projectRepository } from "@/data/repositories";
import type { ProjectSummary } from "@/data/types";
import { useDataVersion } from "@/providers/data-version-provider";
import { useLanguage } from "@/providers/language-provider";
import { useAppTheme } from "@/theme/theme";

// ─── Color/Icon palettes ──────────────────────────────────────────────────────
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

type ProjectIcon = typeof PROJECT_ICONS[number];

// ─── Action menu ─────────────────────────────────────────────────────────────
function ActionMenu({
  project,
  visible,
  onClose,
  onPin,
  onArchive,
}: {
  project: ProjectSummary;
  visible: boolean;
  onClose: () => void;
  onPin: () => void;
  onArchive: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  if (!visible) return null;
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <Pressable style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity onPress={() => { onPin(); onClose(); }} style={styles.menuItem}>
            <Ionicons color={theme.accentSoft} name={project.pinned ? "pin" : "pin-outline"} size={18} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>
              {project.pinned ? t("unpinProject") : t("pinProject")}
            </Text>
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity onPress={() => { onArchive(); onClose(); }} style={styles.menuItem}>
            <Ionicons color={theme.warning} name="archive-outline" size={18} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>{t("archiveProject")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Create-project form ──────────────────────────────────────────────────────
function CreateForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const db = useSQLiteContext();
  const { t } = useLanguage();
  const theme = useAppTheme();
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(PROJECT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState<ProjectIcon>("folder");
  const [showPicker, setShowPicker] = useState(false);

  async function create() {
    if (!name.trim()) return;
    await projectRepository.create(db, name, [t("columnTodo"), t("columnDoing"), t("columnDone")]);
    // Update color & icon right after (create uses defaults)
    // We need the id — use list to find newest
    const all = await projectRepository.list(db, false);
    if (all.length > 0) {
      const newest = all.find((p) => p.name === name.trim()) ?? all[0];
      if (newest) {
        await projectRepository.updateMetadata(db, newest.id, { color: selectedColor, icon: selectedIcon });
      }
    }
    setName("");
    onCreated();
  }

  return (
    <Card style={styles.createCard} tone="accent">
      <View style={styles.cardHeading}>
        <View style={[styles.createIcon, { backgroundColor: `${selectedColor}25` }]}>
          <Ionicons color={selectedColor} name={selectedIcon as any} size={21} />
        </View>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{t("newProject")}</Text>
        <Pressable onPress={() => setShowPicker(!showPicker)} style={styles.paletteToggle}>
          <Ionicons color={theme.textMuted} name="color-palette-outline" size={20} />
        </Pressable>
      </View>
      {showPicker && (
        <View style={styles.paletteRow}>
          {PROJECT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setSelectedColor(c)}
              style={[styles.colorDot, { backgroundColor: c, borderWidth: selectedColor === c ? 2.5 : 0, borderColor: theme.text }]}
            />
          ))}
        </View>
      )}
      <View style={styles.inputRow}>
        <AppInput
          onChangeText={setName}
          onSubmitEditing={() => void create()}
          placeholder={t("projectPlaceholder")}
          style={styles.flex}
          value={name}
        />
        <ActionButton disabled={!name.trim()} icon="add" label={t("add")} onPress={() => void create()} />
      </View>
    </Card>
  );
}

// ─── Project card (list style) ────────────────────────────────────────────────
function ProjectCard({
  project,
  onPress,
  onMenuPress,
}: {
  project: ProjectSummary;
  onPress: () => void;
  onMenuPress: () => void;
}) {
  const theme = useAppTheme();
  const doneTasks = project.totalTasks - project.openTasks;
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card style={[styles.projectCard, { opacity: pressed ? 0.78 : 1 }]}>
          <View style={[styles.projectIconWrap, { backgroundColor: `${project.color}20` }]}>
            <Ionicons color={project.color} name={project.icon as any} size={23} />
          </View>
          <View style={styles.flex}>
            <View style={styles.projectTitleRow}>
              <Text numberOfLines={1} style={[styles.projectName, { color: theme.text }]}>
                {project.name}
              </Text>
              {project.pinned === 1 && (
                <Ionicons color={theme.accentSoft} name="pin" size={13} style={styles.pinIcon} />
              )}
            </View>
            <ProgressBar
              color={project.color}
              completed={doneTasks}
              total={project.totalTasks}
            />
          </View>
          <Pressable
            hitSlop={10}
            onPress={onMenuPress}
            style={({ pressed: mp }) => [styles.moreBtn, { opacity: mp ? 0.5 : 1 }]}
          >
            <Ionicons color={theme.textMuted} name="ellipsis-horizontal" size={18} />
          </Pressable>
        </Card>
      )}
    </Pressable>
  );
}

// ─── Project card (grid style) ────────────────────────────────────────────────
function ProjectGridCard({
  project,
  onPress,
  onMenuPress,
}: {
  project: ProjectSummary;
  onPress: () => void;
  onMenuPress: () => void;
}) {
  const theme = useAppTheme();
  const doneTasks = project.totalTasks - project.openTasks;
  return (
    <Pressable onPress={onPress} style={styles.gridCardWrap}>
      {({ pressed }) => (
        <Card style={[styles.gridCard, { opacity: pressed ? 0.78 : 1 }]}>
          <View style={styles.gridCardHeader}>
            <View style={[styles.gridIconWrap, { backgroundColor: `${project.color}20` }]}>
              <Ionicons color={project.color} name={project.icon as any} size={22} />
            </View>
            <Pressable hitSlop={8} onPress={onMenuPress}>
              <Ionicons color={theme.textMuted} name="ellipsis-horizontal" size={16} />
            </Pressable>
          </View>
          {project.pinned === 1 && (
            <Ionicons color={project.color} name="pin" size={11} style={styles.gridPin} />
          )}
          <Text numberOfLines={2} style={[styles.gridName, { color: theme.text }]}>
            {project.name}
          </Text>
          <ProgressBar color={project.color} completed={doneTasks} total={project.totalTasks} showLabel={false} />
          <Text style={[styles.gridMeta, { color: theme.textMuted }]}>
            {doneTasks}/{project.totalTasks}
          </Text>
        </Card>
      )}
    </Pressable>
  );
}

// ─── Archived project row ──────────────────────────────────────────────────────
function ArchivedRow({
  project,
  onUnarchive,
}: {
  project: ProjectSummary;
  onUnarchive: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  return (
    <Card style={styles.archivedCard}>
      <View style={[styles.projectIconWrap, { backgroundColor: `${project.color}20` }]}>
        <Ionicons color={project.color} name={project.icon as any} size={21} />
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.projectName, { color: theme.textSecondary }]}>
          {project.name}
        </Text>
        <Text style={[styles.archivedMeta, { color: theme.textMuted }]}>
          {project.openTasks} {t("openTasks")}
        </Text>
      </View>
      <Pressable
        onPress={onUnarchive}
        style={[styles.restoreBtn, { backgroundColor: theme.accentSurface }]}
      >
        <Text style={[styles.restoreLabel, { color: theme.accentSoft }]}>{t("unarchiveProject")}</Text>
      </Pressable>
    </Card>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProjectsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useLanguage();
  const { refresh, version } = useDataVersion();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [archived, setArchived] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [viewGrid, setViewGrid] = useState(false);
  const [menuProject, setMenuProject] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      projectRepository.list(db, false),
      projectRepository.list(db, true),
    ])
      .then(([active_p, archived_p]) => {
        if (active) {
          setProjects(active_p);
          setArchived(archived_p);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, version]);

  async function handlePin(project: ProjectSummary) {
    await projectRepository.togglePin(db, project.id);
    refresh();
  }

  async function handleArchive(project: ProjectSummary) {
    await projectRepository.archive(db, project.id);
    refresh();
  }

  async function handleUnarchive(project: ProjectSummary) {
    await projectRepository.unarchive(db, project.id);
    refresh();
  }

  const pinned = projects.filter((p) => p.pinned === 1);
  const unpinned = projects.filter((p) => p.pinned === 0);

  function renderProject(p: ProjectSummary) {
    const navigate = () => router.push(`/project/${p.id}`);
    const openMenu = () => setMenuProject(p);
    return viewGrid ? (
      <ProjectGridCard key={p.id} project={p} onPress={navigate} onMenuPress={openMenu} />
    ) : (
      <ProjectCard key={p.id} project={p} onPress={navigate} onMenuPress={openMenu} />
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <ScreenHeader subtitle={t("projectsSubtitle")} title={t("projectsTitle")} />
        </View>
        <Pressable
          onPress={() => setViewGrid((v) => !v)}
          style={[styles.viewToggle, { backgroundColor: theme.surfaceRaised }]}
        >
          <Ionicons
            color={theme.text}
            name={viewGrid ? "list-outline" : "grid-outline"}
            size={20}
          />
        </Pressable>
      </View>

      {/* Tab: Activos / Archivados */}
      <View style={[styles.tabRow, { backgroundColor: theme.surfaceRaised }]}>
        {[false, true].map((isArchived) => (
          <Pressable
            key={String(isArchived)}
            onPress={() => setShowArchived(isArchived)}
            style={[
              styles.tab,
              showArchived === isArchived && { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: showArchived === isArchived ? theme.text : theme.textMuted },
              ]}
            >
              {isArchived ? t("archivedProjects") : t("activeProjects")}
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: theme.surfaceElevated }]}>
              <Text style={[styles.tabBadgeText, { color: theme.textMuted }]}>
                {isArchived ? archived.length : projects.length}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Create form (only in Activos) */}
      {!showArchived && (
        <CreateForm onCreated={refresh} />
      )}

      {/* List */}
      {loading ? (
        <LoadingView />
      ) : showArchived ? (
        archived.length === 0 ? (
          <EmptyState icon="archive-outline" text={t("projectsEmpty")} />
        ) : (
          <View style={styles.list}>
            {archived.map((p) => (
              <ArchivedRow key={p.id} project={p} onUnarchive={() => void handleUnarchive(p)} />
            ))}
          </View>
        )
      ) : projects.length === 0 ? (
        <EmptyState icon="folder-open-outline" text={t("projectsEmpty")} />
      ) : (
        <View style={styles.section}>
          {/* Fijados */}
          {pinned.length > 0 && (
            <View style={styles.group}>
              <SectionHeader title={t("pinnedProjects")} />
              <View style={viewGrid ? styles.gridList : styles.list}>
                {pinned.map(renderProject)}
              </View>
            </View>
          )}
          {/* Resto */}
          {unpinned.length > 0 && (
            <View style={styles.group}>
              {pinned.length > 0 && <SectionHeader title={t("yourProjects")} />}
              <View style={viewGrid ? styles.gridList : styles.list}>
                {unpinned.map(renderProject)}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Action menu modal */}
      {menuProject && (
        <ActionMenu
          project={menuProject}
          visible={!!menuProject}
          onClose={() => setMenuProject(null)}
          onPin={() => void handlePin(menuProject)}
          onArchive={() => void handleArchive(menuProject)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  viewToggle: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", width: 44, marginTop: 4 },
  tabRow: { flexDirection: "row", borderRadius: 18, padding: 4, gap: 2 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 9, gap: 6 },
  tabText: { fontSize: 13, fontWeight: "700" },
  tabBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeText: { fontSize: 11, fontWeight: "800" },
  createCard: { gap: 14 },
  cardHeading: { alignItems: "center", flexDirection: "row", gap: 11 },
  createIcon: { alignItems: "center", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  cardTitle: { fontSize: 17, fontWeight: "800", flex: 1 },
  paletteToggle: { padding: 4 },
  paletteRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorDot: { borderRadius: 12, height: 24, width: 24 },
  inputRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  section: { gap: 20 },
  group: { gap: 12 },
  list: { gap: 11 },
  gridList: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  projectCard: { alignItems: "center", flexDirection: "row", gap: 13, paddingVertical: 16 },
  projectIconWrap: { alignItems: "center", borderRadius: 17, height: 50, justifyContent: "center", width: 50 },
  projectTitleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  projectName: { fontSize: 15, fontWeight: "800", flexShrink: 1 },
  pinIcon: { marginTop: 1 },
  moreBtn: { padding: 8 },
  gridCardWrap: { width: "47%" },
  gridCard: { gap: 10, paddingVertical: 18 },
  gridCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gridIconWrap: { alignItems: "center", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  gridPin: { marginTop: -4 },
  gridName: { fontSize: 14, fontWeight: "800", lineHeight: 19 },
  gridMeta: { fontSize: 11 },
  archivedCard: { alignItems: "center", flexDirection: "row", gap: 13, paddingVertical: 14 },
  archivedMeta: { fontSize: 12, marginTop: 3 },
  restoreBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  restoreLabel: { fontSize: 12, fontWeight: "800" },
  scrim: { flex: 1, justifyContent: "center", alignItems: "center" },
  menu: { borderRadius: 18, borderWidth: 1, minWidth: 210, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 15 },
  menuLabel: { fontSize: 15, fontWeight: "600" },
  menuDivider: { height: 1 },
});
