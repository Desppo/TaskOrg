import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, AppInput, Card, EmptyState, LoadingView, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { inboxRepository } from '@/data/repositories';
import type { InboxItem } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';

export default function InboxScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useLanguage();
  const { refresh, version } = useDataVersion();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [capture, setCapture] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    inboxRepository.list(db).then((nextItems) => { if (active) setItems(nextItems); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, version]);

  async function addItem() {
    if (!capture.trim()) return;
    await inboxRepository.create(db, capture);
    setCapture('');
    refresh();
  }

  function confirmRemove(item: InboxItem) {
    Alert.alert(t('confirmDiscardTitle'), t('confirmDiscardInbox'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('discard'),
        style: 'destructive',
        onPress: () => { void inboxRepository.remove(db, item.id).then(refresh); },
      },
    ]);
  }

  return (
    <Screen>
      <ScreenHeader subtitle={t('inboxSubtitle')} title={t('inboxTitle')} />

      <Card style={styles.captureCard} tone="accent">
        <View style={styles.captureHeading}>
          <View style={[styles.captureIcon, { backgroundColor: theme.accentSurfaceStrong }]}>
            <Ionicons color={theme.accentSoft} name="bulb-outline" size={22} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.captureTitle, { color: theme.text }]}>{t('saveToInbox')}</Text>
            <Text style={[styles.captureHint, { color: theme.textMuted }]}>{t('inboxPendingHint')}</Text>
          </View>
        </View>
        <AppInput
          multiline
          onChangeText={setCapture}
          placeholder={t('capturePlaceholder')}
          style={styles.capture}
          value={capture}
        />
        <ActionButton disabled={!capture.trim()} icon="arrow-down-circle-outline" label={t('saveToInbox')} onPress={() => void addItem()} />
      </Card>

      <View style={styles.section}>
        <SectionHeader count={items.length} subtitle={t('inboxPendingHint')} title={t('inboxPending')} />
        {loading ? <LoadingView /> : items.length === 0 ? <EmptyState icon="mail-open-outline" text={t('inboxEmpty')} /> : (
          <View style={styles.list}>
            {items.map((item, index) => (
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeading}>
                  <View style={[styles.itemNumber, { backgroundColor: theme.surfaceRaised }]}>
                    <Text style={[styles.itemNumberText, { color: theme.accentSoft }]}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <Text style={[styles.itemText, { color: theme.text }]}>{item.content}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.actions}>
                  <View style={styles.action}>
                    <ActionButton icon="options-outline" label={t('organize')} onPress={() => router.push(`/inbox/${item.id}`)} />
                  </View>
                  <View style={styles.action}>
                    <ActionButton icon="trash-outline" kind="danger" label={t('discard')} onPress={() => confirmRemove(item)} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  captureCard: { gap: 14 },
  captureHeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  captureIcon: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  captureTitle: { fontSize: 17, fontWeight: '800' },
  captureHint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  capture: { minHeight: 92, textAlignVertical: 'top' },
  section: { gap: 12 },
  list: { gap: 11 },
  itemCard: { gap: 14 },
  itemHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  itemNumber: { alignItems: 'center', borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  itemNumberText: { fontSize: 11, fontWeight: '900' },
  itemText: { flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 23 },
  divider: { height: 1 },
  actions: { flexDirection: 'row', gap: 9 },
  action: { flex: 1 },
});
