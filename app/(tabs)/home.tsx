import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, AppInput, Card, IconButton, LoadingView, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { dashboardRepository, inboxRepository } from '@/data/repositories';
import type { DashboardSummary } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { toDateKey } from '@/utils/date';

const emptySummary: DashboardSummary = {
  inboxCount: 0,
  overdueCount: 0,
  todayCount: 0,
  unscheduledCount: 0,
  completedTodayCount: 0,
  activeProjectCount: 0,
  archivedCount: 0,
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { locale, t } = useLanguage();
  const { refresh, version } = useDataVersion();
  const [summary, setSummary] = useState(emptySummary);
  const [capture, setCapture] = useState('');
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => toDateKey(new Date()), []);

  useEffect(() => {
    let active = true;
    dashboardRepository.getSummary(db, today)
      .then((nextSummary) => { if (active) setSummary(nextSummary); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, today, version]);

  async function addCapture() {
    if (!capture.trim()) return;
    await inboxRepository.create(db, capture);
    setCapture('');
    refresh();
  }

  const nextAction = summary.inboxCount > 0
    ? { title: t('homeInboxAction'), hint: t('homeInboxHint'), count: summary.inboxCount, route: '/inbox' }
    : summary.overdueCount > 0
      ? { title: t('homeOverdueAction'), hint: t('homeOverdueHint'), count: summary.overdueCount, route: '/today' }
      : summary.todayCount > 0
        ? { title: t('homeTodayAction'), hint: t('homeTodayHint'), count: summary.todayCount, route: '/today' }
        : summary.unscheduledCount > 0
          ? { title: t('homeUnscheduledAction'), hint: t('homeUnscheduledHint'), count: summary.unscheduledCount, route: '/today' }
        : summary.completedTodayCount > 0
          ? { title: t('homeReviewAction'), hint: t('homeReviewHint'), count: summary.completedTodayCount, route: '/review' }
          : summary.activeProjectCount > 0
            ? { title: t('homeProjectsAction'), hint: t('homeProjectsHint'), count: summary.activeProjectCount, route: '/projects' }
            : { title: t('homeClearAction'), hint: t('homeClearHint'), count: 0, route: '/inbox' };

  const dateLabel = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen>
      <ScreenHeader
        action={<IconButton icon="settings-outline" label={t('settingsTitle')} onPress={() => router.push('/settings')} />}
        eyebrow={t('homeEyebrow')}
        subtitle={t('homeSubtitle')}
        title={t('homeTitle')}
      />
      <View style={[styles.datePill, { backgroundColor: theme.surfaceRaised }]}>
        <Ionicons color={theme.textMuted} name="sunny-outline" size={14} />
        <Text style={[styles.date, { color: theme.textSecondary }]}>{dateLabel}</Text>
      </View>

      <SectionHeader title={t('nextStep')} />
      {loading ? <LoadingView /> : (
        <Pressable onPress={() => router.push(nextAction.route)}>
          <LinearGradient colors={[theme.accentStrong, theme.accent, '#9C6BFF']} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.nextCard}>
            <View style={styles.glowLarge} />
            <View style={styles.glowSmall} />
            <View style={styles.nextCopy}>
              <View style={styles.nextLabelRow}>
                <Ionicons color="#EDE9FF" name="navigate-circle" size={17} />
                <Text style={styles.nextLabel}>{t('nextStep')}</Text>
              </View>
              <Text style={styles.nextTitle}>{nextAction.title}</Text>
              <Text style={styles.nextHint}>{nextAction.hint}</Text>
            </View>
            <View style={styles.nextMetric}>
              {nextAction.count > 0 ? <Text style={styles.nextCount}>{nextAction.count}</Text> : <Ionicons color="#FFFFFF" name="arrow-forward" size={24} />}
            </View>
          </LinearGradient>
        </Pressable>
      )}

      <Pressable accessibilityRole="button" onPress={() => router.push('/review')}>
        {({ pressed }) => (
          <Card style={[styles.linkCard, styles.reviewLinkCard, { opacity: pressed ? 0.78 : 1 }]} tone="success">
            <View style={[styles.linkIcon, { backgroundColor: theme.successSurface }]}><Ionicons color={theme.success} name="journal" size={21} /></View>
            <View style={styles.flex}>
              <Text style={[styles.linkTitle, { color: theme.text }]}>{t('reviewDaily')}</Text>
              <Text style={[styles.linkHint, { color: theme.textMuted }]}>{t('reviewDailyHint')}</Text>
            </View>
            <View style={[styles.linkArrow, { backgroundColor: theme.surfaceRaised }]}>
              <Ionicons color={theme.success} name="arrow-forward" size={18} />
            </View>
          </Card>
        )}
      </Pressable>

      <Card tone="accent">
        <View style={styles.captureTitleRow}>
          <View style={[styles.smallIcon, { backgroundColor: theme.accentSurfaceStrong }]}><Ionicons color={theme.accentSoft} name="flash" size={17} /></View>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{t('quickCaptureHome')}</Text>
        </View>
        <Text style={[styles.cardHint, { color: theme.textMuted }]}>{t('quickCaptureHomeHint')}</Text>
        <View style={styles.captureRow}>
          <AppInput
            onChangeText={setCapture}
            onSubmitEditing={() => void addCapture()}
            placeholder={t('capturePlaceholder')}
            returnKeyType="done"
            style={styles.flex}
            value={capture}
          />
          <ActionButton disabled={!capture.trim()} icon="arrow-up" label={t('add')} onPress={() => void addCapture()} />
        </View>
      </Card>

      <SectionHeader title={t('overview')} />
      <View style={styles.grid}>
        <NavigationTile count={summary.todayCount + summary.overdueCount + summary.unscheduledCount} icon="checkmark-circle" label={t('tabToday')} onPress={() => router.push('/today')} tone="accent" />
        <NavigationTile count={summary.inboxCount} icon="file-tray-full" label={t('tabInbox')} onPress={() => router.push('/inbox')} tone="warning" />
        <NavigationTile icon="calendar" label={t('tabCalendar')} onPress={() => router.push('/calendar')} tone="info" />
        <NavigationTile count={summary.activeProjectCount} icon="grid" label={t('tabProjects')} onPress={() => router.push('/projects')} tone="success" />
      </View>

      <Pressable onPress={() => router.push('/archive')}>
        <Card style={styles.linkCard}>
          <View style={[styles.linkIcon, { backgroundColor: theme.surfaceRaised }]}><Ionicons color={theme.textMuted} name="archive" size={21} /></View>
          <View style={styles.flex}>
            <Text style={[styles.linkTitle, { color: theme.text }]}>{t('archiveTitle')}</Text>
            <Text style={[styles.linkHint, { color: theme.textMuted }]}>{t('archiveSubtitle')}</Text>
          </View>
          <Text style={[styles.archiveCount, { backgroundColor: theme.surfaceRaised, color: theme.textMuted }]}>{summary.archivedCount}</Text>
        </Card>
      </Pressable>

    </Screen>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function NavigationTile({ count, icon, label, onPress, tone }: { count?: number; icon: IconName; label: string; onPress: () => void; tone: 'accent' | 'warning' | 'info' | 'success' }) {
  const theme = useAppTheme();
  const colors = tone === 'accent'
    ? { background: theme.accentSurface, foreground: theme.accentSoft }
    : tone === 'warning'
      ? { background: theme.warningSurface, foreground: theme.warning }
      : tone === 'success'
        ? { background: theme.successSurface, foreground: theme.success }
        : { background: theme.surfaceRaised, foreground: theme.info };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.76 : 1 }]}>
      <View style={[styles.tileIcon, { backgroundColor: colors.background }]}><Ionicons color={colors.foreground} name={icon} size={21} /></View>
      <View style={styles.tileFooter}>
        <Text style={[styles.tileLabel, { color: theme.text }]}>{label}</Text>
        {typeof count === 'number' ? <Text style={[styles.tileCount, { color: colors.foreground }]}>{count}</Text> : <Ionicons color={theme.textMuted} name="arrow-forward" size={17} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  datePill: { alignSelf: 'flex-start', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7 },
  date: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  nextCard: { borderRadius: 28, flexDirection: 'row', alignItems: 'center', minHeight: 190, overflow: 'hidden', padding: 22 },
  glowLarge: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.09)', right: -50, top: -68 },
  glowSmall: { position: 'absolute', width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.08)', right: 34, bottom: -35 },
  nextCopy: { flex: 1, paddingRight: 12 },
  nextLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  nextLabel: { color: '#EDE9FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  nextTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  nextHint: { color: '#E9E7FF', fontSize: 13, lineHeight: 19, marginTop: 8, maxWidth: 245 },
  nextMetric: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 21, height: 56, justifyContent: 'center', width: 56 },
  nextCount: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  captureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallIcon: { alignItems: 'center', borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  cardTitle: { fontSize: 17, fontWeight: '900' },
  cardHint: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  captureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { borderRadius: 22, borderWidth: 1, minHeight: 128, padding: 16, justifyContent: 'space-between', width: '48%' },
  tileIcon: { alignItems: 'center', borderRadius: 15, height: 44, justifyContent: 'center', width: 44 },
  tileFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileCount: { fontSize: 18, fontWeight: '900' },
  tileLabel: { flex: 1, fontSize: 14, fontWeight: '800' },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewLinkCard: { borderColor: 'transparent' },
  linkIcon: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  linkArrow: { alignItems: 'center', borderRadius: 13, height: 40, justifyContent: 'center', width: 40 },
  linkTitle: { fontSize: 16, fontWeight: '800' },
  linkHint: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  archiveCount: { borderRadius: 12, fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
});
