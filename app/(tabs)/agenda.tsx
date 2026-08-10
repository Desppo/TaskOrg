import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, AppInput, BackButton, Card, IconButton, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { dailyLogRepository, taskRepository } from '@/data/repositories';
import type { DailyLog, TaskItem } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { fromDateKey, shiftDate, toDateKey } from '@/utils/date';

type IconName = ComponentProps<typeof Ionicons>['name'];
type LogField = 'doneText' | 'pendingText' | 'notes';
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function AutomaticList({ items, empty, color, onPress }: { items: TaskItem[]; empty: string; color: string; onPress: (item: TaskItem) => void }) {
  const theme = useAppTheme();
  return (
    <View style={styles.automaticList}>
      {items.length === 0 ? (
        <View style={styles.emptyRow}>
          <Ionicons color={theme.textMuted} name="checkmark-circle-outline" size={17} />
          <Text style={[styles.emptyLine, { color: theme.textMuted }]}>{empty}</Text>
        </View>
      ) : items.map((item) => (
        <Pressable key={item.id} onPress={() => onPress(item)} style={styles.automaticRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.automaticText, { color: theme.text }]}>{item.title}</Text>
          <Ionicons color={theme.textMuted} name="chevron-forward" size={16} />
        </Pressable>
      ))}
    </View>
  );
}

function StepCard({ children, icon, number, title, hint, tone }: { children: ReactNode; icon: IconName; number: number; title: string; hint: string; tone: 'success' | 'warning' | 'accent' }) {
  const theme = useAppTheme();
  const color = tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : theme.accentSoft;
  const surface = tone === 'success' ? theme.successSurface : tone === 'warning' ? theme.warningSurface : theme.accentSurface;
  return (
    <Card style={styles.stepCard}>
      <View style={styles.stepHeading}>
        <View style={[styles.stepIcon, { backgroundColor: surface }]}>
          <Ionicons color={color} name={icon} size={20} />
          <View style={[styles.stepNumber, { backgroundColor: color }]}><Text style={styles.stepNumberText}>{number}</Text></View>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.stepTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.stepHint, { color: theme.textMuted }]}>{hint}</Text>
        </View>
      </View>
      {children}
    </Card>
  );
}

function FieldLabel({ text }: { text: string }) {
  const theme = useAppTheme();
  return <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{text}</Text>;
}

export default function AgendaScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { locale, t } = useLanguage();
  const { version } = useDataVersion();
  const [date, setDate] = useState(toDateKey(new Date()));
  const [log, setLog] = useState<DailyLog>({ date, doneText: '', pendingText: '', notes: '' });
  const [completed, setCompleted] = useState<TaskItem[]>([]);
  const [pending, setPending] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastReviewDate, setLastReviewDate] = useState<string | null>(null);
  const saveGeneration = useRef(0);

  // Load last review date once on mount
  useEffect(() => {
    dailyLogRepository.getLastDate(db).then(setLastReviewDate).catch(() => undefined);
  }, [db]);

  useEffect(() => {
    let active = true;
    saveGeneration.current += 1;
    setLoading(true);
    setSaveState('idle');
    Promise.all([
      dailyLogRepository.get(db, date),
      taskRepository.listCompleted(db, date),
      taskRepository.listToday(db, date),
    ]).then(([nextLog, nextCompleted, nextPending]) => {
      if (active) {
        setLog(nextLog);
        setCompleted(nextCompleted);
        setPending(nextPending);
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, db, version]);

  useEffect(() => {
    if (saveState !== 'dirty') return undefined;
    const snapshot = log;
    const timer = setTimeout(() => {
      const generation = ++saveGeneration.current;
      setSaveState('saving');
      dailyLogRepository.save(db, snapshot)
        .then(() => { if (generation === saveGeneration.current) setSaveState('saved'); })
        .catch(() => { if (generation === saveGeneration.current) setSaveState('error'); });
    }, 700);
    return () => clearTimeout(timer);
  }, [db, log, saveState]);

  function updateField(field: LogField, value: string) {
    // Invalidate any save already in flight so it cannot mark newer text as saved.
    saveGeneration.current += 1;
    setLog((current) => ({ ...current, [field]: value }));
    setSaveState('dirty');
  }

  async function saveNow() {
    const generation = ++saveGeneration.current;
    setSaveState('saving');
    try {
      await dailyLogRepository.save(db, log);
      if (generation === saveGeneration.current) setSaveState('saved');
    } catch {
      if (generation === saveGeneration.current) setSaveState('error');
    }
  }

  async function flushChanges() {
    if (saveState !== 'idle' && saveState !== 'saved') await dailyLogRepository.save(db, log);
  }

  async function changeDate(offset: -1 | 1) {
    await flushChanges();
    setDate((current) => shiftDate(current, offset));
  }

  async function jumpToLastReview() {
    if (!lastReviewDate) return;
    await flushChanges();
    setDate(lastReviewDate);
  }

  async function closeReview() {
    await flushChanges();
    router.back();
  }

  const dateLabel = fromDateKey(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const statusText = saveState === 'error' ? t('errorGeneric') : saveState === 'dirty' || saveState === 'saving' ? t('reviewSaving') : t('reviewSaved');
  const statusColor = saveState === 'error' ? theme.danger : saveState === 'dirty' || saveState === 'saving' ? theme.warning : theme.success;

  return (
    <Screen>
      <BackButton label={t('back')} onPress={() => void closeReview()} />
      <ScreenHeader eyebrow={t('agendaEyebrow')} subtitle={dateLabel} title={t('agendaTitle')} />

      <Card style={styles.introCard} tone="accent">
        <View style={[styles.introIcon, { backgroundColor: theme.accentSurfaceStrong }]}>
          <Ionicons color={theme.accentSoft} name="sparkles" size={23} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.introText, { color: theme.text }]}>{t('reviewIntro')}</Text>
          <View style={styles.stepsRow}>
            {[1, 2, 3].map((step) => <View key={step} style={[styles.miniStep, { backgroundColor: theme.accent }]}><Text style={styles.miniStepText}>{step}</Text></View>)}
            <Text style={[styles.stepsLabel, { color: theme.textMuted }]}>{t('reviewProgress')}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.dateNavigation}>
        <IconButton icon="chevron-back" label={t('previousDay')} onPress={() => void changeDate(-1)} />
        <Text style={[styles.shortDate, { color: theme.textSecondary }]}>{dateLabel}</Text>
        <IconButton icon="chevron-forward" label={t('nextDay')} onPress={() => void changeDate(1)} />
      </View>
      {lastReviewDate && lastReviewDate !== date ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void jumpToLastReview()}
          style={({ pressed }) => [
            styles.lastReviewBtn,
            { backgroundColor: theme.accentSurface, borderColor: theme.border, opacity: pressed ? 0.72 : 1 },
          ]}
        >
          <Ionicons color={theme.accentSoft} name="return-up-back-outline" size={15} />
          <Text style={[styles.lastReviewText, { color: theme.accentSoft }]}>{t('goToLastReview')}</Text>
          <Text style={[styles.lastReviewDate, { color: theme.textMuted }]}>{lastReviewDate}</Text>
        </Pressable>
      ) : null}

      {loading ? <LoadingView /> : (
        <>
          <StepCard hint={t('reviewStepOneHint')} icon="trophy-outline" number={1} title={t('reviewStepOne')} tone="success">
            <View style={[styles.automaticPanel, { backgroundColor: theme.successSurface }]}>
              <View style={styles.panelHeading}>
                <Text style={[styles.panelTitle, { color: theme.success }]}>{t('doneAutomatically')}</Text>
                <Text style={[styles.panelCount, { color: theme.success }]}>{completed.length}</Text>
              </View>
              <AutomaticList color={theme.success} empty={t('noCompletedTasks')} items={completed} onPress={(item) => router.push(`/task/${item.id}`)} />
            </View>
            <FieldLabel text={t('doneText')} />
            <AppInput multiline onChangeText={(value) => updateField('doneText', value)} placeholder={t('doneHint')} style={styles.journalInput} value={log.doneText} />
          </StepCard>

          <StepCard hint={t('reviewStepTwoHint')} icon="hourglass-outline" number={2} title={t('reviewStepTwo')} tone="warning">
            <View style={[styles.automaticPanel, { backgroundColor: theme.warningSurface }]}>
              <View style={styles.panelHeading}>
                <Text style={[styles.panelTitle, { color: theme.warning }]}>{t('pendingAutomatically')}</Text>
                <Text style={[styles.panelCount, { color: theme.warning }]}>{pending.length}</Text>
              </View>
              <AutomaticList color={theme.warning} empty={t('noPendingTasks')} items={pending} onPress={(item) => router.push(`/task/${item.id}`)} />
            </View>
            <FieldLabel text={t('pendingText')} />
            <AppInput multiline onChangeText={(value) => updateField('pendingText', value)} placeholder={t('pendingHint')} style={styles.journalInput} value={log.pendingText} />
          </StepCard>

          <StepCard hint={t('reviewStepThreeHint')} icon="document-text-outline" number={3} title={t('reviewStepThree')} tone="accent">
            <FieldLabel text={t('notes')} />
            <AppInput multiline onChangeText={(value) => updateField('notes', value)} placeholder={t('notesHint')} style={styles.journalInput} value={log.notes} />
          </StepCard>

          <View style={[styles.saveStatus, { backgroundColor: theme.surfaceRaised }]}>
            <Ionicons color={statusColor} name={saveState === 'error' ? 'alert-circle-outline' : saveState === 'dirty' || saveState === 'saving' ? 'sync-outline' : 'checkmark-circle-outline'} size={18} />
            <View style={styles.flex}>
              <Text style={[styles.saveStatusText, { color: statusColor }]}>{statusText}</Text>
              <Text style={[styles.saveHint, { color: theme.textMuted }]}>{t('reviewAutoSave')}</Text>
            </View>
          </View>
          <ActionButton icon="save-outline" label={t('save')} onPress={() => void saveNow()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  introCard: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  introIcon: { alignItems: 'center', borderRadius: 17, height: 50, justifyContent: 'center', width: 50 },
  introText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  stepsRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 10 },
  miniStep: { alignItems: 'center', borderRadius: 8, height: 20, justifyContent: 'center', width: 20 },
  miniStepText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  stepsLabel: { fontSize: 11, fontWeight: '700', marginLeft: 3 },
  dateNavigation: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  shortDate: { flex: 1, fontSize: 13, fontWeight: '800', textAlign: 'center', textTransform: 'capitalize' },
  lastReviewBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lastReviewText: { fontSize: 12, fontWeight: '800' },
  lastReviewDate: { fontSize: 11, fontWeight: '600' },
  stepCard: { gap: 15 },
  stepHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  stepIcon: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  stepNumber: { alignItems: 'center', borderColor: '#FFFFFF', borderRadius: 8, borderWidth: 2, bottom: -5, height: 20, justifyContent: 'center', position: 'absolute', right: -5, width: 20 },
  stepNumberText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  stepTitle: { fontSize: 17, fontWeight: '900', lineHeight: 22 },
  stepHint: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  automaticPanel: { borderRadius: 17, padding: 13 },
  panelHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  panelTitle: { flex: 1, fontSize: 12, fontWeight: '900' },
  panelCount: { fontSize: 12, fontWeight: '900' },
  fieldLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  journalInput: { minHeight: 98, textAlignVertical: 'top' },
  automaticList: { gap: 8, marginTop: 10 },
  automaticRow: { alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 30 },
  automaticText: { flex: 1, fontSize: 14, fontWeight: '600' },
  emptyRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  emptyLine: { flex: 1, fontSize: 12, lineHeight: 17 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  saveStatus: { alignItems: 'center', borderRadius: 17, flexDirection: 'row', gap: 10, padding: 14 },
  saveStatusText: { fontSize: 13, fontWeight: '900' },
  saveHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
});
