import React, { useCallback, useEffect, useState } from 'react';
import { onForegroundMessage } from '../services/notificationService';
import type { NotificationToastData } from '../components/NotificationToast';
import NotificationToast from '../components/NotificationToast';

interface NotificationProviderProps {
  children: React.ReactNode;
  /** Called when user taps "View order" on the toast; use to navigate to QR/order screen */
  onViewOrder?: (orderId: string) => void;
}

export function NotificationProvider({ children, onViewOrder }: NotificationProviderProps) {
  const [toast, setToast] = useState<NotificationToastData | null>(null);

  const showToast = useCallback((data: NotificationToastData) => {
    setToast(data);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const handleViewOrder = useCallback(
    (orderId: string) => {
      onViewOrder?.(orderId);
      setToast(null);
    },
    [onViewOrder]
  );

  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      console.log('🔔 Toast received:', payload);
      const notification = payload.notification || {};
      const data = payload.data || {};

      showToast({
        title: notification.title || 'Notification',
        body: notification.body || '',
        orderReady: data.type === 'ORDER_READY' ? {
          type: 'ORDER_READY',
          orderId: data.orderId,
          pickupWindowStart: data.pickupWindowStart,
          pickupWindowEnd: data.pickupWindowEnd
        } as any : undefined
      });
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [showToast]);

  return (
    <>
      {children}
      {toast && (
        <NotificationToast
          data={toast}
          onDismiss={dismissToast}
          onViewOrder={onViewOrder ? handleViewOrder : dismissToast}
        />
      )}
    </>
  );
}
