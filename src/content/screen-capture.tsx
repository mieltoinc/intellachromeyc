/**
 * Screen Capture Component - Region Selection
 * Adapted for Chrome Extension use
 */

import React, { Component, CSSProperties } from 'react';
import ReactDOM from 'react-dom/client';

interface Props {
  onCapture: (region: CaptureRegion) => void;
  onCancel: () => void;
}

interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface State {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  crossHairsTop: number;
  crossHairsLeft: number;
  isMouseDown: boolean;
  windowWidth: number;
  windowHeight: number;
  borderWidth: number | string | CSSProperties;
  cropPositionTop: number;
  cropPositionLeft: number;
  cropWidth: number;
  cropHeight: number;
}

class ScreenCapture extends Component<Props, State> {
  state = {
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    crossHairsTop: 0,
    crossHairsLeft: 0,
    isMouseDown: false,
    windowWidth: 0,
    windowHeight: 0,
    borderWidth: 0,
    cropPositionTop: 0,
    cropPositionLeft: 0,
    cropWidth: 0,
    cropHeight: 0,
  } as State;

  handleWindowResize = () => {
    const windowWidth =
      window.innerWidth ||
      document.documentElement.clientWidth ||
      document.body.clientWidth;
    const windowHeight =
      window.innerHeight ||
      document.documentElement.clientHeight ||
      document.body.clientHeight;

    this.setState({
      windowWidth,
      windowHeight,
    });
  };

  componentDidMount = () => {
    this.handleWindowResize();
    window.addEventListener('resize', this.handleWindowResize);
    window.addEventListener('keydown', this.handleKeyDown);
  };

  componentWillUnmount = () => {
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('keydown', this.handleKeyDown);
  };

  handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.props.onCancel();
    }
  };

  handleMouseMove = (e: React.MouseEvent) => {
    const {
      isMouseDown,
      windowWidth,
      windowHeight,
      startX,
      startY,
      borderWidth
    } = this.state;
    let cropPositionTop = startY;
    let cropPositionLeft = startX;
    const endX = e.clientX;
    const endY = e.clientY;
    const isStartTop = endY >= startY;
    const isStartBottom = endY <= startY;
    const isStartLeft = endX >= startX;
    const isStartRight = endX <= startX;
    const isStartTopLeft = isStartTop && isStartLeft;
    const isStartTopRight = isStartTop && isStartRight;
    const isStartBottomLeft = isStartBottom && isStartLeft;
    const isStartBottomRight = isStartBottom && isStartRight;
    let newBorderWidth = borderWidth;
    let cropWidth = 0;
    let cropHeight = 0;

    if (isMouseDown) {
      if (isStartTopLeft) {
        newBorderWidth = `${startY}px ${windowWidth - endX}px ${windowHeight - endY}px ${startX}px`;
        cropWidth = endX - startX;
        cropHeight = endY - startY;
      }

      if (isStartTopRight) {
        newBorderWidth = `${startY}px ${windowWidth - startX}px ${windowHeight - endY}px ${endX}px`;
        cropWidth = startX - endX;
        cropHeight = endY - startY;
        cropPositionLeft = endX;
      }

      if (isStartBottomLeft) {
        newBorderWidth = `${endY}px ${windowWidth - endX}px ${windowHeight - startY}px ${startX}px`;
        cropWidth = endX - startX;
        cropHeight = startY - endY;
        cropPositionTop = endY;
      }

      if (isStartBottomRight) {
        newBorderWidth = `${endY}px ${windowWidth - startX}px ${windowHeight - startY}px ${endX}px`;
        cropWidth = startX - endX;
        cropHeight = startY - endY;
        cropPositionLeft = endX;
        cropPositionTop = endY;
      }
    }

    // Account for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    cropWidth *= dpr;
    cropHeight *= dpr;
    cropPositionLeft *= dpr;
    cropPositionTop *= dpr;

    this.setState({
      crossHairsTop: e.clientY,
      crossHairsLeft: e.clientX,
      borderWidth: newBorderWidth,
      cropWidth,
      cropHeight,
      cropPositionTop,
      cropPositionLeft,
    });
  };

  handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;

    this.setState(prevState => ({
      startX,
      startY,
      cropPositionTop: startY,
      cropPositionLeft: startX,
      isMouseDown: true,
      borderWidth: `${prevState.windowWidth}px ${prevState.windowHeight}px`,
    }));
  };

  handleMouseUp = () => {
    const { cropPositionTop, cropPositionLeft, cropWidth, cropHeight } = this.state;

    // Only capture if there's a meaningful selection (> 10px)
    if (cropWidth > 10 && cropHeight > 10) {
      this.props.onCapture({
        x: cropPositionLeft,
        y: cropPositionTop,
        width: cropWidth,
        height: cropHeight,
      });
    } else {
      this.props.onCancel();
    }

    this.setState({
      isMouseDown: false,
      borderWidth: 0,
      crossHairsTop: 0,
      crossHairsLeft: 0,
    });
  };

  render() {
    const {
      crossHairsTop,
      crossHairsLeft,
      borderWidth,
      isMouseDown,
    } = this.state;

    return (
      <div
        onMouseMove={this.handleMouseMove}
        onMouseDown={this.handleMouseDown}
        onMouseUp={this.handleMouseUp}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: 'crosshair',
          zIndex: 999999,
        }}
      >
        {/* Instructions */}
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            color: '#111827',
            zIndex: 1000001,
            pointerEvents: 'none',
          }}
        >
          Click and drag to select a region • Press ESC to cancel
        </div>

        {/* Overlay with highlighting */}
        <div
          className={isMouseDown ? 'highlighting' : ''}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderStyle: 'solid',
            borderColor: 'rgba(0, 0, 0, 0.5)',
            borderWidth: borderWidth as any,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />

        {/* Crosshairs */}
        <div
          style={{
            position: 'fixed',
            left: crossHairsLeft + 'px',
            top: crossHairsTop + 'px',
            width: '20px',
            height: '20px',
            marginLeft: '-10px',
            marginTop: '-10px',
            border: '2px solid #3b82f6',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 1000002,
          }}
        />
      </div>
    );
  }
}

// Global state
let overlayRoot: ReactDOM.Root | null = null;
let overlayContainer: HTMLDivElement | null = null;

// Show the screen capture overlay
export function showScreenCaptureOverlay() {
  // Remove existing overlay if any
  hideScreenCaptureOverlay();

  // Create container
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'intella-screen-capture-overlay';
  overlayContainer.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999999;';
  document.body.appendChild(overlayContainer);

  // Render React component
  overlayRoot = ReactDOM.createRoot(overlayContainer);
  overlayRoot.render(
    <ScreenCapture
      onCapture={(region) => {
        // Send region to background script
        chrome.runtime.sendMessage({
          type: 'CAPTURE_SCREEN_REGION',
          payload: region,
        });
        hideScreenCaptureOverlay();
      }}
      onCancel={() => {
        // Notify that capture was cancelled
        chrome.runtime.sendMessage({
          type: 'CAPTURE_SCREEN_CANCELLED',
        });
        hideScreenCaptureOverlay();
      }}
    />
  );
}

// Hide the screen capture overlay
export function hideScreenCaptureOverlay() {
  if (overlayRoot) {
    overlayRoot.unmount();
    overlayRoot = null;
  }
  if (overlayContainer && overlayContainer.parentNode) {
    overlayContainer.parentNode.removeChild(overlayContainer);
    overlayContainer = null;
  }
}

// Listen for messages to show overlay
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SHOW_SCREEN_CAPTURE_OVERLAY') {
    showScreenCaptureOverlay();
    sendResponse({ success: true });
  }
  return true;
});
