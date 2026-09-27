import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { resolvePhotoUrl } from '../api/client';

type Gender = 'bride' | 'groom';

interface Props {
  gender: Gender;
  size?: number;
  photoUrl?: string | null;
  locked?: boolean;
}

// Round profile picture. Shows the real photo once the backend sends one (it only does so after
// the photo request is approved), otherwise a modest illustration: a brother with a kufi cap and
// beard, or a sister in hijab.
export function GenderAvatar({ gender, size = 60, photoUrl, locked }: Props) {
  const uri = resolvePhotoUrl(photoUrl ?? null);
  const ring = { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size / 30) };

  if (uri) {
    return <Image source={{ uri }} style={[styles.ring, ring]} accessibilityLabel="Profile photo" />;
  }

  const sister = gender === 'bride';
  const bg = sister ? colors.lowBg : colors.greenBg;
  const cloth = sister ? '#b0617a' : '#2d5a27';
  const clothDark = sister ? '#8e4a61' : '#1f4220';
  const skin = '#e9c4a0';

  return (
    <View style={[styles.ring, ring, { backgroundColor: bg }]}>
      <Svg width={size * 0.92} height={size * 0.92} viewBox="0 0 100 100">
        {sister ? (
          <>
            {/* shoulders / abaya */}
            <Path d="M14 100 C16 76 32 66 50 66 C68 66 84 76 86 100 Z" fill={clothDark} />
            {/* hijab outer */}
            <Path d="M50 16 C30 16 22 32 22 48 C22 62 30 72 50 76 C70 72 78 62 78 48 C78 32 70 16 50 16 Z" fill={cloth} />
            {/* face */}
            <Ellipse cx="50" cy="47" rx="15" ry="18" fill={skin} />
            {/* hijab front band */}
            <Path d="M33 40 C36 28 64 28 67 40 C62 34 38 34 33 40 Z" fill={clothDark} />
            {/* eyes & smile */}
            <Circle cx="44" cy="47" r="1.8" fill="#3b2a20" />
            <Circle cx="56" cy="47" r="1.8" fill="#3b2a20" />
            <Path d="M45 55 Q50 59 55 55" stroke="#8a4b3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* shoulders / kurta */}
            <Path d="M14 100 C16 76 32 68 50 68 C68 68 84 76 86 100 Z" fill={cloth} />
            <Path d="M50 68 L46 82 L50 86 L54 82 Z" fill="#f5f0e8" />
            {/* neck */}
            <Path d="M43 58 L57 58 L56 70 L44 70 Z" fill={skin} />
            {/* face */}
            <Ellipse cx="50" cy="45" rx="15" ry="17" fill={skin} />
            {/* beard */}
            <Path d="M35 46 C35 62 42 70 50 70 C58 70 65 62 65 46 C62 54 57 57 50 57 C43 57 38 54 35 46 Z" fill="#3b2a20" />
            {/* kufi cap */}
            <Path d="M34 36 C34 22 66 22 66 36 Z" fill="#f5f0e8" />
            <Path d="M34 36 L66 36" stroke="#d8cfc0" strokeWidth="2" />
            {/* eyes & smile */}
            <Circle cx="44" cy="44" r="1.8" fill="#3b2a20" />
            <Circle cx="56" cy="44" r="1.8" fill="#3b2a20" />
            <Path d="M46 52 Q50 55 54 52" stroke="#f5f0e8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </>
        )}
      </Svg>
      {locked ? (
        <View style={[styles.lock, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 }]}>
          <Svg width={size * 0.2} height={size * 0.2} viewBox="0 0 24 24">
            <Path d="M7 11V8a5 5 0 0 1 10 0v3" stroke={colors.muted} strokeWidth="2.5" fill="none" />
            <Path d="M5 11h14v10H5z" fill={colors.muted} />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderColor: '#c49a2a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  lock: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(45,90,39,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
