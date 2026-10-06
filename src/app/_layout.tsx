
import React from 'react';
import { Redirect, Stack } from 'expo-router';

import {
  AuthProvider,
  useAuth,
} from '../auth/AuthProvider';

function AppNavigator() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/" />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />

      <AppNavigator />
    </AuthProvider>
  );
}

