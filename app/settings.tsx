import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { BackButton, Card, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { createBackup, getDataStats, resetAllData, restoreBackup, type DataStats } from '@/data/data-management';
import { useDataVersion } from '@/providers/data-version-provider';
import { type Language, useLanguage } from '@/providers/language-provider';
import { type ThemePreference, useAppTheme, useThemePreference } from '@/theme/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const emptyStats: DataStats = { tasks: 0, projects: 0, inbox: 0, reviews: 0, archived: 0 };

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { language, setLanguage, t } = useLanguage();
  const { preference, setPreference } = useThemePreference();
  const { refresh, version } = useDataVersion();
  const [stats, setStats] = useState<DataStats>(emptyStats);
  const [busy, setBusy] = useState<'export' | 'import' | 'reset' | null>(null);

  const loadStats = useCallback(() => {
    getDataStats(db).then(setStats).catch(() => undefined);
  }, [db]);

  useEffect(() => { loadStats(); }, [loadStats, version]);

  async function exportData() {
    setBusy('export');
    try {
      const content = await createBackup(db);
      const date = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `taskorg-backup-${date}.json`);
      file.create({ overwrite: true });
      file.write(content);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing unavailable');
      await Sharing.shareAsync(file.uri, { dialogTitle: t('exportBackup'), mimeType: 'application/json', UTI: 'public.json' });
    } catch {
      Alert.alert(t('exportBackup'), t('backupError'));
    } finally {
      setBusy(null);
    }
  }

  async function chooseBackup() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: 'application/json' });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error('Missing backup file');
      if (asset.size && asset.size > 25 * 1024 * 1024) throw new Error('Backup file is too large');
      const content = await new File(asset.uri).text();
      Alert.alert(t('importConfirmTitle'), t('importConfirmBody'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('import'), onPress: () => { void importData(content); } },
      ]);
    } catch {
      Alert.alert(t('importBackup'), t('backupError'));
    }
  }

  async function importData(content: string) {
    setBusy('import');
    try {
      await restoreBackup(db, content);
      refresh();
      loadStats();
      Alert.alert(t('importBackup'), t('importSuccess'));
    } catch {
      Alert.alert(t('importBackup'), t('backupError'));
    } finally {
      setBusy(null);
    }
  }

  function confirmReset() {
    Alert.alert(t('resetConfirmTitle'), t('resetConfirmBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('continue'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('resetFinalTitle'), t('resetFinalBody'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('resetData'), style: 'destructive', onPress: () => { void resetData(); } },
          ]);
        },
      },
    ]);
  }

  async function resetData() {
    setBusy('reset');
    try {
      await resetAllData(db);
      refresh();
      setStats(emptyStats);
      Alert.alert(t('resetData'), t('resetSuccess'));
    } catch {
      Alert.alert(t('resetData'), t('errorGeneric'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <BackButton label={t('back')} onPress={() => router.back()} />
      <ScreenHeader
        action={<View style={[styles.headerIcon, { backgroundColor: theme.accentSurface }]}><Ionicons color={theme.accentSoft} name="settings-outline" size={23} /></View>}
        subtitle={t('settingsSubtitle')}
        title={t('settingsTitle')}
      />

      <View style={styles.section}>
        <SectionHeader subtitle={t('appearanceHint')} title={t('appearance')} />
        <Card style={styles.preferenceCard}>
          <PreferenceLabel icon="language-outline" label={t('language')} />
          <View style={styles.choiceRow}>
            <PreferenceChoice active={language === 'es'} label={t('spanish')} onPress={() => setLanguage('es')} />
            <PreferenceChoice active={language === 'en'} label={t('english')} onPress={() => setLanguage('en')} />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <PreferenceLabel icon="contrast-outline" label={t('theme')} />
          <View style={styles.choiceRow}>
            {([
              ['system', t('themeSystem')],
              ['light', t('themeLight')],
              ['dark', t('themeDark')],
            ] as Array<[ThemePreference, string]>).map(([value, label]) => (
              <PreferenceChoice key={value} active={preference === value} label={label} onPress={() => setPreference(value)} />
            ))}
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader subtitle={t('dataPrivacyHint')} title={t('dataPrivacy')} />
        <Card style={styles.statsCard} tone="accent">
          <Text style={[styles.cardTitle, { color: theme.text }]}>{t('dataSummary')}</Text>
          <View style={styles.statsGrid}>
            <Stat value={stats.tasks} label={t('dataTasks')} />
            <Stat value={stats.projects} label={t('dataProjects')} />
            <Stat value={stats.inbox} label={t('dataInbox')} />
            <Stat value={stats.reviews} label={t('dataReviews')} />
          </View>
        </Card>

        <Card style={styles.actionsCard}>
          <DataAction
            busy={busy === 'export'}
            hint={t('exportBackupHint')}
            icon="cloud-upload-outline"
            label={t('exportBackup')}
            onPress={() => void exportData()}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DataAction
            busy={busy === 'import'}
            hint={t('importBackupHint')}
            icon="cloud-download-outline"
            label={t('importBackup')}
            onPress={() => void chooseBackup()}
          />
        </Card>

        <Card style={styles.privacyCard} tone="success">
          <Ionicons color={theme.success} name="shield-checkmark-outline" size={22} />
          <Text style={[styles.privacyText, { color: theme.textSecondary }]}>{t('dataPrivacyHint')}</Text>
        </Card>

        <Card style={styles.dangerCard} tone="danger">
          <DataAction
            busy={busy === 'reset'}
            danger
            hint={t('resetDataHint')}
            icon="warning-outline"
            label={t('resetData')}
            onPress={confirmReset}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('about')} />
        <Card style={styles.aboutCard}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>TaskOrg</Text>
          <Text style={[styles.version, { color: theme.textMuted }]}>{t('version')} {Constants.expoConfig?.version ?? '0.1.0'} · local-first</Text>
        </Card>
      </View>
    </Screen>
  );
}

function PreferenceLabel({ icon, label }: { icon: IconName; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.preferenceLabel}>
      <Ionicons color={theme.accentSoft} name={icon} size={18} />
      <Text style={[styles.preferenceLabelText, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

function PreferenceChoice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, { backgroundColor: active ? theme.accentSurfaceStrong : theme.surfaceRaised, borderColor: active ? theme.accent : theme.border, opacity: pressed ? 0.7 : 1 }]}
    >
      {active ? <Ionicons color={theme.accentSoft} name="checkmark-circle" size={16} /> : null}
      <Text style={[styles.choiceText, { color: active ? theme.accentSoft : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface }]}>
      <Text style={[styles.statValue, { color: theme.accentSoft }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function DataAction({ busy, danger = false, hint, icon, label, onPress }: { busy: boolean; danger?: boolean; hint: string; icon: IconName; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  const color = danger ? theme.danger : theme.accentSoft;
  return (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.dataAction, { opacity: pressed || busy ? 0.6 : 1 }]}>
      <View style={[styles.dataIcon, { backgroundColor: danger ? theme.dangerSurface : theme.accentSurface }]}> 
        {busy ? <ActivityIndicator color={color} size="small" /> : <Ionicons color={color} name={icon} size={21} />}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.dataLabel, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
        <Text style={[styles.dataHint, { color: theme.textMuted }]}>{hint}</Text>
      </View>
      <Ionicons color={theme.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerIcon: { alignItems: 'center', borderRadius: 17, height: 50, justifyContent: 'center', width: 50 },
  section: { gap: 12 },
  preferenceCard: { gap: 14 },
  preferenceLabel: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  preferenceLabelText: { fontSize: 15, fontWeight: '900' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 13 },
  choiceText: { fontSize: 12, fontWeight: '800' },
  divider: { height: 1 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  statsCard: { gap: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { borderRadius: 15, padding: 12, width: '48%' },
  statValue: { fontSize: 21, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  actionsCard: { paddingVertical: 5 },
  dataAction: { alignItems: 'center', flexDirection: 'row', gap: 11, minHeight: 78, paddingVertical: 11 },
  dataIcon: { alignItems: 'center', borderRadius: 15, height: 44, justifyContent: 'center', width: 44 },
  dataLabel: { fontSize: 14, fontWeight: '900' },
  dataHint: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  privacyCard: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18 },
  dangerCard: { paddingVertical: 5 },
  aboutCard: { alignItems: 'center' },
  version: { fontSize: 12, marginTop: 5 },
});
