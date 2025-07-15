import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Auth screens
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpOptionsScreen from '../screens/auth/SignUpOptionsScreen';
import ConnectMusicService from '../screens/auth/ConnectMusicService';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  console.log('🎯 AuthNavigator: Rendering authentication stack');
  
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUpOptions" component={SignUpOptionsScreen} />
      <Stack.Screen name="ConnectMusicService" component={ConnectMusicService} />
    </Stack.Navigator>
  );
};

export default AuthNavigator; 