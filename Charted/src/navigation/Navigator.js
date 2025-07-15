import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';

const Navigator = () => {
  const { user, isLoading, isAuthenticated } = useAuth();

  console.log('🔄 Navigator: Checking auth state...', {
    isLoading,
    isAuthenticated,
    hasUser: !!user
  });

  if (isLoading) {
    console.log('⏳ Navigator: Showing loading state');
    // This is the loading state. You can customize this later with a splash screen.
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (isAuthenticated) {
    console.log('✅ Navigator: User authenticated, showing app');
    return <AppNavigator />;
  } else {
    console.log('🔐 Navigator: User not authenticated, showing auth flow');
    return <AuthNavigator />;
  }
};

export default Navigator;