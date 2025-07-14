import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import SearchScreen from '../screens/search/SearchScreen';
import CategoryResultsScreen from '../screens/search/CategoryResultsScreen';
import SearchPlaylistScreen from '../screens/search/SearchPlaylistScreen';
import SearchUserScreen from '../screens/search/SearchUserScreen';
import UserScreen from '../screens/main/UserScreen'; // Re-used here
import PlaylistDetail from '../screens/main/PlaylistDetail';
import CommentScreen from '../screens/comments/CommentScreen';

const Stack = createStackNavigator();

const SearchStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen name="CategoryResults" component={CategoryResultsScreen} />
      <Stack.Screen name="SearchPlaylist" component={SearchPlaylistScreen} />
      <Stack.Screen name="SearchUser" component={SearchUserScreen} />
      <Stack.Screen name="User" component={UserScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetail} />
      <Stack.Screen name="Comments" component={CommentScreen} />
    </Stack.Navigator>
  );
};

export default SearchStackNavigator; 