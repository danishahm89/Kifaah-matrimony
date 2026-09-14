import React from 'react';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';

// The prototype's repeating-linear-gradient(45deg, ...) diagonal stripe placeholder fill,
// reused wherever a photo has no real asset yet.
export function StripePattern() {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <Pattern id="stripe" width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Rect width={16} height={16} fill={colors.surface} />
          <Rect width={8} height={16} fill={colors.placeholderStripeA} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#stripe)" />
    </Svg>
  );
}
