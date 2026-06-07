import React from 'react';
import { Inbox } from '@novu/react';
import { useAuth } from '../hooks/useAuth';

const NotificationInbox: React.FC = () => {
  const { user, profile } = useAuth();
  
  const applicationIdentifier = process.env.REACT_APP_NOVU_APPLICATION_IDENTIFIER;
  
  if (!applicationIdentifier) {
    console.error('REACT_APP_NOVU_APPLICATION_IDENTIFIER is not defined');
    return null;
  }

  const subscriberId = user?.uid || profile?.uid || "6a240538b1e12d69cb30afde";
  const backendUrl = process.env.NOVU_BACKEND_URL;
  const socketUrl = process.env.NOVU_SOCKET_URL;

  return (
    <Inbox
      applicationIdentifier={applicationIdentifier}
      subscriberId={subscriberId}
      {...(backendUrl ? { backendUrl } : {})}
      {...(socketUrl ? { socketUrl } : {})}
      appearance={{
        variables: {
          colorPrimary: '#0F9D58',
          colorPrimaryForeground: '#FFFFFF',
          colorSecondary: '#FAFAFA',
          colorSecondaryForeground: '#111827',
          colorCounter: '#EF4444',
          colorCounterForeground: '#FFFFFF',
          colorBackground: '#FFFFFF',
          colorRing: '#0F9D58',
          colorForeground: '#111827',
          colorNeutral: '#E5E7EB',
          colorShadow: 'rgba(0, 0, 0, 0.05)',
          fontSize: '14px',
        },
        elements: {
          bellIcon: {
            color: '#6B7280',
          },
        },
      }}
    />
  );
};

export default NotificationInbox;
