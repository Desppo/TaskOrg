import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, AppInput, Card, EmptyState, IconButton, LoadingView, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    inboxRepository.list(db).then((nextItems) => { if (active) setItems(nextItems); })
      .catch(() => { if (active) Alert.alert(t('inboxTitle'), t('errorGeneric')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, version]);

  async function addItem() {
    if (!capture.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await inboxRepository.create(db, capture);
      setCapture('');
      refresh();
    } catch { Alert.alert(t('saveToInbox'), t('errorGeneric')); }
    finally { savingRef.current = false; setSaving(false); }
  }

  function confirmRemove(item: InboxItem) {
    Alert.alert(t('confirmDiscardTitle'), t('confirmDiscardInbox'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('discard'),
        style: 'destructive',
        onPress: () => { void inboxRepository.remove(db, item.id).then(refresh).catch(() => Alert.alert(t('discard'), t('errorGeneric'))); },
      },
    ]);
  }

  return (
    <Screen>
      <ScreenHeader action={<IconButton icon="settings-outline" label={t('settingsTitle')} onPress={() => router.push('/settings')} />} subtitle={t('inboxSubtitle')} title={t('inboxTitle')} />

      <Card style={styles.captureCard} tone="accent">
        <View style={styles.captureHeading}>
          <View style={[styles.captureIcon, { backgroundColor: theme.accentSurfaceStrong }]}>
            <Ionicons color={theme.accentSoft} name="bulb-outline" size={22} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.captureTitle, { color: theme.text }]}>{t('saveToInbox')}</Text>
            <Text style={[styles.captureHint, { color: theme.textMuted }]}>{t('quickCaptureHomeHint')}</Text>
          </View>
        </View>
        <AppInput
          editable={!saving}
          multiline
          onChangeText={setCapture}
          placeholder={t('capturePlaceholder')}
          style={styles.capture}
          value={capture}
        />
        <ActionButton disabled={saving || !capture.trim()} icon="add" label={saving ? t('reviewSaving') : t('saveToInbox')} onPress={() => void addItem()} />
      </Card>

      <View style={styles.section}>
        <SectionHeader count={items.length} subtitle={t('inboxPendingHint')} title={t('inboxPending')} />
        {loading ? <LoadingView /> : items.length === 0 ? <EmptyState icon="mail-open-outline" text={t('inboxEmpty')} /> : (
          <View style={styles.list}>
            {items.map((item) => (
              <Card key={item.id} style={styles.itemCard}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t('organize')}: ${item.content}`} onPress={() => router.push(`/inbox/${item.id}`)} style={styles.itemHeading}>
                  <View style={styles.flex}>
                    <Text numberOfLines={4} style={[styles.itemText, { color: theme.text }]}>{item.content}</Text>
                    <Text style={[styles.captureHint, { color: theme.accentSoft }]}>{t('organize')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" color={theme.textMuted} size={18} />
                </Pressable>
                <IconButton icon="trash-outline" label={`${t('discard')}: ${item.content}`} onPress={() => confirmRemove(item)} />
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
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemHeading: { flex: 1, minHeight: 48, alignItems: 'center', flexDirection: 'row', gap: 8 },
  itemText: { fontSize: 16, fontWeight: '600', lineHeight: 23 },
});
