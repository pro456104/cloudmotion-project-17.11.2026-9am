import React from 'react';
import type { VideoScene } from '../types';
import {
  SampleCustomPulseScene,
  type CustomSceneComponentProps,
} from './SampleCustomPulseScene';

export interface CustomSceneDefinition {
  name: string;
  description: string;
  Component: React.FC<CustomSceneComponentProps>;
}

/**
 * Registry of custom React Remotion scenes.
 * OpenCode can create new .tsx files in src/video/customScenes/ and register them here,
 * then reference them in any project scene with:
 *   kind: 'custom-tsx', customSceneName: 'YourSceneKey'
 */
export const CUSTOM_SCENE_REGISTRY: Record<string, CustomSceneDefinition> = {
  'pulse-architecture': {
    name: 'pulse-architecture',
    description:
      'Animated spring pulse architecture scene demonstrating custom TSX Remotion composition.',
    Component: SampleCustomPulseScene,
  },
};

export function listCustomScenes(): Array<{ name: string; description: string }> {
  return Object.values(CUSTOM_SCENE_REGISTRY).map((item) => ({
    name: item.name,
    description: item.description,
  }));
}

export function renderCustomSceneComponent(scene: VideoScene): React.ReactNode | null {
  const key = scene.customSceneName || '';
  const entry = CUSTOM_SCENE_REGISTRY[key];
  if (!entry) return null;
  const Comp = entry.Component;
  return <Comp scene={scene} customProps={scene.customProps} />;
}
