// Icon set recreating the prototype's inline SVGs (Kifaah.dc.html) using react-native-svg.
// Path data / shape intent matches the HTML <svg> elements; not necessarily byte-identical paths.
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function BackChevronIcon({ size = 16, color = '#201e1d', strokeWidth = 2.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function BellIcon({ size = 15, color = '#201e1d', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
  );
}

export function GlobeIcon({ size = 13, color = '#201e1d', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M2 12h20" />
      <Path d="M12 2a15 15 0 010 20 15 15 0 010-20" />
    </Svg>
  );
}

export function LockIcon({ size = 18, color = '#605d5d', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Rect x="3" y="11" width="18" height="11" rx="2" />
      <Path d="M7 11V7a5 5 0 0110 0v4" />
    </Svg>
  );
}

export function ShieldIcon({ size = 16, color = '#ae1800', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function SendIcon({ size = 16, color = '#f3f2f2', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 2L11 13" />
      <Path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </Svg>
  );
}

export function CameraIcon({ size = 22, color = '#605d5d', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 8a2 2 0 012-2h1.2a2 2 0 001.7-.9l.6-.9A2 2 0 0111.2 3h1.6a2 2 0 011.7.9l.6.9a2 2 0 001.7.9H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
      <Circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function TabDiscoverIcon({ size = 18, color = '#7d7979', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Rect x="3" y="3" width="7" height="7" rx="1" />
      <Rect x="14" y="3" width="7" height="7" rx="1" />
      <Rect x="3" y="14" width="7" height="7" rx="1" />
      <Rect x="14" y="14" width="7" height="7" rx="1" />
    </Svg>
  );
}

export function TabMatchesIcon({ size = 18, color = '#7d7979', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Rect x="3" y="6" width="18" height="13" rx="1" />
      <Path d="M3 6l9 7 9-7" />
    </Svg>
  );
}

export function TabChatIcon({ size = 18, color = '#7d7979', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Path d="M21 11.5a8.38 8.38 0 01-4.5 7.5 8.38 8.38 0 01-3.8.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 018-8 8.5 8.5 0 018.5 8v.5z" />
    </Svg>
  );
}

export function TabAccountIcon({ size = 18, color = '#7d7979', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </Svg>
  );
}
