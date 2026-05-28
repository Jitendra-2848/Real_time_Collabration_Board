export interface TouchState {
  x: number;
  y: number;
  time: number;
  dist: number;
}

export const handleTouchStart = (touch: Touch, prevTouchState: TouchState | null): TouchState => {
  return {
    x: touch.clientX,
    y: touch.clientY,
    time: Date.now(),
    dist: prevTouchState?.dist || 0
  };
};

export const handleTouchPinch = (
  touch1: Touch,
  touch2: Touch,
  touchState: TouchState | null
): number => {
  const dist = Math.hypot(
    touch1.clientX - touch2.clientX,
    touch1.clientY - touch2.clientY
  );

  if (touchState?.dist) {
    const delta = dist - touchState.dist;
    if (Math.abs(delta) > 5) {
      return delta * 0.005;
    }
  }

  return 0;
};

export const isLongPress = (touchState: TouchState | null): boolean => {
  if (!touchState) return false;
  return Date.now() - touchState.time > 500;
};
