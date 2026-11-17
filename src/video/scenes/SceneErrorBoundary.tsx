import React from 'react';
import { AbsoluteFill } from 'remotion';

interface SceneErrorBoundaryProps {
  sceneTitle: string;
  children: React.ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class SceneErrorBoundary extends React.Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  constructor(props: SceneErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Scene rendering error',
    };
  }

  componentDidUpdate(prevProps: SceneErrorBoundaryProps) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 64,
            backgroundColor: '#0B0E14',
            color: '#F8FAFC',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              padding: '18px 28px',
              borderRadius: 16,
              border: '1px solid rgba(255,84,46,0.45)',
              backgroundColor: 'rgba(255,84,46,0.08)',
              maxWidth: 760,
            }}
          >
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 20,
                fontWeight: 700,
                color: '#FF542E',
                marginBottom: 8,
              }}
            >
              SCENE RECOVERY · {this.props.sceneTitle}
            </div>
            <div style={{ fontSize: 22, color: '#CBD5E1' }}>
              {this.state.message}
            </div>
          </div>
        </AbsoluteFill>
      );
    }

    return this.props.children;
  }
}
