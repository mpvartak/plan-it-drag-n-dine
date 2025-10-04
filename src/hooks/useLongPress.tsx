import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  delay?: number;
  moveThreshold?: number;
}

export const useLongPress = ({
  onLongPress,
  onClick,
  delay = 500,
  moveThreshold = 10,
}: UseLongPressOptions) => {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsLongPressing(false);
    startPosRef.current = null;
  }, []);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      
      // Store starting position
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startPosRef.current = { x: clientX, y: clientY };
      isLongPressTriggeredRef.current = false;

      setIsLongPressing(true);

      timerRef.current = setTimeout(() => {
        setIsLongPressing(false);
        isLongPressTriggeredRef.current = true;
        onLongPress(e);
        
        // Haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, delay);
    },
    [delay, onLongPress]
  );

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!startPosRef.current || !timerRef.current) return;

      // Check if moved too much - cancel long press
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const deltaX = Math.abs(clientX - startPosRef.current.x);
      const deltaY = Math.abs(clientY - startPosRef.current.y);

      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        clear();
      }
    },
    [clear, moveThreshold]
  );

  const end = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // If long press was triggered, don't fire onClick
      if (isLongPressTriggeredRef.current) {
        clear();
        return;
      }

      // If timer is still running, it's a regular click/tap
      if (timerRef.current) {
        clear();
        if (onClick) {
          onClick(e);
        }
      }
    },
    [clear, onClick]
  );

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseMove: move,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchMove: move,
    isLongPressing,
  };
};
