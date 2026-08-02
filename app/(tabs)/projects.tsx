import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, AppInput, Card, EmptyState, LoadingView, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { projectRepository } from '@/data/repositories';
import type { ProjectSummary } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';

export default function ProjectsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useLanguage();
  const { refresh, version } = useDataVersion();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    projectRepository.list(db).then((nextProjects) => { if (active) setProjects(nextProjects); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, version]);

  async function createProject() {
    if (!name.trim()) return;
    await projectRepository.create(db, name, [t('columnTodo'), t('columnDoing'), t('columnDone')]);
    setName('');
    refresh();
  }

  return (
    <Screen>
      <ScreenHeader subtitle={t('projectsSubtitle')} title={t('projectsTitle')} />

      <Card style={styles.createCard} tone="accent">
        <View style={styles.cardHeading}>
          <View style={[styles.createIcon, { backgroundColor: theme.accentSurfaceStrong }]}>
            <Ionicons color={theme.accentSoft} name="layers-outline" size={21} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{t('newProject')}</Text>
        </View>
        <View style={styles.inputRow}>
          <AppInput
            onChangeText={setName}
            onSubmitEditing={() => void createProject()}
            placeholder={t('projectPlaceholder')}
            style={styles.flex}
            value={name}
          />
          <ActionButton disabled={!name.trim()} icon="add" label={t('add')} onPress={() => void createProject()} />
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader count={projects.length} title={t('yourProjects')} />
        {loading ? <LoadingView /> : projects.length === 0 ? <EmptyState icon="folder-open-outline" text={t('projectsEmpty')} /> : (
          <View style={styles.list}>
            {projects.map((project) => (
              <Pressable key={project.id} onPress={() => router.push(`/project/${project.id}`)}>
                {({ pressed }) => (
                  <Card style={[styles.projectCard, { opacity: pressed ? 0.78 : 1 }]}>
                    <View style={[styles.projectIcon, { backgroundColor: `${project.color}20` }]}>
                      <Ionicons color={project.color} name="folder-open-outline" size={23} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.projectName, { color: theme.text }]}>{project.name}</Text>
                      <View style={styles.projectMetaRow}>
                        <Text style={[styles.openCount, { color: project.color }]}>{project.openTasks}</Text>
                        <Text style={[styles.projectMeta, { color: theme.textMuted }]}>{t('openTasks')}</Text>
                        <View style={[styles.metaDot, { backgroundColor: theme.borderStrong }]} />
                        <Text style={[styles.projectMeta, { color: theme.textMuted }]}>{project.columnCount} {t('columns')}</Text>
                      </View>
                    </View>
                    <View style={[styles.chevron, { backgroundColor: theme.surfaceRaised }]}>
                      <Ionicons color={theme.textMuted} name="chevron-forward" size={18} />
                    </View>
                  </Card>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  createCard: { gap: 14 },
  cardHeading: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  createIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  inputRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  section: { gap: 12 },
  list: { gap: 11 },
  projectCard: { alignItems: 'center', flexDirection: 'row', gap: 13, paddingVertical: 16 },
  projectIcon: { alignItems: 'center', borderRadius: 17, height: 50, justifyContent: 'center', width: 50 },
  projectName: { fontSize: 16, fontWeight: '800' },
  projectMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 5 },
  openCount: { fontSize: 12, fontWeight: '900' },
  projectMeta: { fontSize: 12 },
  metaDot: { borderRadius: 2, height: 3, marginHorizontal: 2, width: 3 },
  chevron: { alignItems: 'center', borderRadius: 13, height: 38, justifyContent: 'center', width: 38 },
});
