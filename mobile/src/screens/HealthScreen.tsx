import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logger, LogEntry } from '../utils/logger';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { API_BASE_URL } from '../api/client';

const LEVEL_COLORS: Record<string, string> = {
  debug: '#888',
  info: '#2196F3',
  warn: '#FF9800',
  error: '#F44336',
};

interface HealthStatus {
  api: 'checking' | 'ok' | 'error';
  latency: number | null;
  checkedAt: string;
}

export function HealthScreen() {
  const insets = useSafeAreaInsets();
  const [health, setHealth] = useState<HealthStatus>({ api: 'checking', latency: null, checkedAt: '' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const checkHealth = useCallback(async () => {
    setHealth(h => ({ ...h, api: 'checking' }));
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
      const latency = Date.now() - start;
      setHealth({ api: res.ok ? 'ok' : 'error', latency, checkedAt: new Date().toLocaleTimeString() });
    } catch {
      setHealth({ api: 'error', latency: null, checkedAt: new Date().toLocaleTimeString() });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    setLogs(logger.getEntries());
    const unsub = logger.subscribe(() => setLogs(logger.getEntries()));
    return unsub;
  }, [checkHealth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkHealth();
    setRefreshing(false);
  }, [checkHealth]);

  const filteredLogs = logFilter === 'all'
    ? logs
    : logs.filter(l => l.level === logFilter);

  const apiColor = health.api === 'ok' ? '#4CAF50' : health.api === 'error' ? '#F44336' : '#FF9800';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Health & Observability</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* API Health Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>API Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: apiColor }]} />
            <Text style={[styles.statusText, { color: apiColor }]}>
              {health.api === 'checking' ? 'Checking...' : health.api === 'ok' ? 'Online' : 'Offline'}
            </Text>
            {health.latency !== null && (
              <Text style={styles.latencyText}>{health.latency}ms</Text>
            )}
          </View>
          <Text style={styles.metaText}>Endpoint: {API_BASE_URL}</Text>
          {health.checkedAt ? <Text style={styles.metaText}>Checked: {health.checkedAt}</Text> : null}
        </View>

        {/* App Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App Info</Text>
          <Text style={styles.metaText}>Platform: {Platform.OS}</Text>
          <Text style={styles.metaText}>Version: 1.0.0 (build 1)</Text>
          <Text style={styles.metaText}>Environment: {__DEV__ ? 'Development' : 'Production'}</Text>
        </View>

        {/* Live Logs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Logs ({filteredLogs.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {['all', 'debug', 'info', 'warn', 'error'].map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, logFilter === f && styles.filterChipActive]}
                onPress={() => setLogFilter(f)}
              >
                <Text style={[styles.filterChipText, logFilter === f && styles.filterChipTextActive]}>
                  {f.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView style={styles.logScroll} nestedScrollEnabled>
            {filteredLogs.slice().reverse().map((entry, i) => (
              <View key={i} style={styles.logEntry}>
                <Text style={[styles.logLevel, { color: LEVEL_COLORS[entry.level] ?? '#888' }]}>
                  [{entry.level.toUpperCase()}]
                </Text>
                <Text style={styles.logTag}>[{entry.tag}]</Text>
                <Text style={styles.logMsg}>{entry.message}</Text>
                <Text style={styles.logTime}>{new Date(entry.ts).toLocaleTimeString()}</Text>
              </View>
            ))}
            {filteredLogs.length === 0 && (
              <Text style={styles.emptyLogs}>No logs yet</Text>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg ?? '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.primary ?? '#6B3F8C',
  },
  title: { fontSize: 18, fontFamily: fonts.semiBold ?? fonts.regular, color: '#fff' },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  refreshText: { color: '#fff', fontSize: 14 },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontFamily: fonts.semiBold ?? fonts.regular, color: '#222', marginBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 15, fontFamily: fonts.semiBold ?? fonts.regular, marginRight: 12 },
  latencyText: { fontSize: 13, color: '#666' },
  metaText: { fontSize: 13, color: '#555', marginTop: 4 },
  filterRow: { flexDirection: 'row', marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16,
    backgroundColor: '#eee', marginRight: 8,
  },
  filterChipActive: { backgroundColor: colors.primary ?? '#6B3F8C' },
  filterChipText: { fontSize: 11, color: '#555' },
  filterChipTextActive: { color: '#fff' },
  logScroll: { maxHeight: 300 },
  logEntry: {
    flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 4,
  },
  logLevel: { fontSize: 11, fontFamily: fonts.semiBold ?? fonts.regular },
  logTag: { fontSize: 11, color: '#888' },
  logMsg: { fontSize: 11, color: '#333', flex: 1 },
  logTime: { fontSize: 10, color: '#aaa' },
  emptyLogs: { color: '#aaa', textAlign: 'center', paddingVertical: 20 },
}));
