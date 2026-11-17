import React, { createContext, useContext } from 'react';
import { DEFAULT_ANIMATION_EASING } from './easingPresets';
import type { AnimationEasingConfig } from './types';

const AnimationEasingContext = createContext<AnimationEasingConfig>(
  DEFAULT_ANIMATION_EASING
);

export const AnimationEasingProvider: React.FC<{
  value: AnimationEasingConfig;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <AnimationEasingContext.Provider value={value}>
    {children}
  </AnimationEasingContext.Provider>
);

export function useAnimationEasing(): AnimationEasingConfig {
  return useContext(AnimationEasingContext);
}
