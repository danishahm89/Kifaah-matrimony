import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { logger } from '../utils/logger';

interface State { hasError: boolean; message: string; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    const message = err instanceof Error ? err.message : String(err);
    return { hasError: true, message };
  }

  componentDidCatch(err: unknown, info: React.ErrorInfo) {
    logger.error('ErrorBoundary', 'Uncaught render error', { err: String(err), stack: info.componentStack });
  }

  handleReset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{this.state.message}</Text>
        <TouchableOpacity style={styles.btn} onPress={this.handleReset}>
          <Text style={styles.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontFamily: fonts.semiBold, fontSize: 20, color: colors.ink, marginBottom: 8 },
  message: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: colors.red, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { fontFamily: fonts.semiBold, fontSize: 15, color: '#fff' },
});
