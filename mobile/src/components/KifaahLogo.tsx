import React from 'react';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props { size?: number }

export function KifaahLogo({ size = 80 }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.accent} />
          </LinearGradient>
          <LinearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.shimmer2} />
          </LinearGradient>
        </Defs>
        {/* Outer circle */}
        <Circle cx="50" cy="50" r="48" fill="url(#g1)" />
        {/* Inner geometric ring - 8-pointed star pattern */}
        <G opacity="0.3">
          <Path d="M50 10 L56 38 L50 30 L44 38 Z" fill={colors.accent} />
          <Path d="M50 90 L44 62 L50 70 L56 62 Z" fill={colors.accent} />
          <Path d="M10 50 L38 56 L30 50 L38 44 Z" fill={colors.accent} />
          <Path d="M90 50 L62 44 L70 50 L62 56 Z" fill={colors.accent} />
          <Path d="M21 21 L40 43 L35 35 L43 40 Z" fill={colors.accent} />
          <Path d="M79 79 L60 57 L65 65 L57 60 Z" fill={colors.accent} />
          <Path d="M79 21 L57 40 L65 35 L60 43 Z" fill={colors.accent} />
          <Path d="M21 79 L43 60 L35 65 L40 57 Z" fill={colors.accent} />
        </G>
        {/* Two hands / rings connecting - representing couple */}
        <Path
          d="M30 52 C30 44 36 40 42 42 C44 38 48 36 52 38 C56 36 60 38 62 42 C68 40 74 44 74 52 C74 58 70 62 64 64 C60 68 56 70 50 70 C44 70 40 68 36 64 C30 62 26 58 30 52Z"
          fill="white"
          opacity="0.15"
        />
        {/* Crescent moon */}
        <Path
          d="M50 20 C38 20 28 30 28 42 C28 54 38 64 50 64 C44 60 40 52 40 42 C40 32 44 24 50 20Z"
          fill="url(#g2)"
          opacity="0.9"
        />
        {/* Star next to crescent */}
        <Path
          d="M62 28 L63.5 32.5 L68 32.5 L64.5 35 L66 39.5 L62 37 L58 39.5 L59.5 35 L56 32.5 L60.5 32.5 Z"
          fill="url(#g2)"
        />
        {/* Two rings (nikah rings) at bottom */}
        <Circle cx="43" cy="76" r="7" fill="none" stroke="url(#g2)" strokeWidth="2.5" />
        <Circle cx="57" cy="76" r="7" fill="none" stroke="url(#g2)" strokeWidth="2.5" />
        <Path d="M48 76 Q50 72 52 76" fill="none" stroke={colors.accent} strokeWidth="1.5" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
