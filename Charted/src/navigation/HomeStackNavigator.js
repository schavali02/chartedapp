import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/main/HomeScreen';
import UserScreen from '../screens/main/UserScreen';
import CommentScreen from '../screens/comments/CommentScreen';
import PlaylistDetail from '../screens/main/PlaylistDetail';
import FollowScreen from '../screens/main/FollowScreen';

const Stack = createStackNavigator();

const HomeStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      <Stack.Screen name="HomeFeed" component={HomeScreen} />
      <Stack.Screen name="User" component={UserScreen} />
      <Stack.Screen name="Comments" component={CommentScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetail} />
      <Stack.Screen name="Follow" component={FollowScreen} />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator; 