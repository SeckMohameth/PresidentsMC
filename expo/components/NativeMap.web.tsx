import React, { forwardRef, useImperativeHandle } from 'react';
import { View, ViewProps } from 'react-native';

type NativeMapRef = {
  animateToRegion: () => void;
  fitToCoordinates: () => void;
};

export type MapPressEvent = {
  nativeEvent: {
    coordinate: {
      latitude: number;
      longitude: number;
    };
  };
};

const NativeMap = forwardRef<NativeMapRef, ViewProps>(({ children: _children, ...props }, ref) => {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => undefined,
    fitToCoordinates: () => undefined,
  }));

  return <View {...props} />;
});

NativeMap.displayName = 'NativeMap';

export function Marker() {
  return null;
}

export function Polyline() {
  return null;
}

export const PROVIDER_DEFAULT = undefined;
export const PROVIDER_GOOGLE = undefined;

export default NativeMap;
