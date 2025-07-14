import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Auth screens
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpOptionsScreen from '../screens/auth/SignUpOptionsScreen';
import ConnectMusicService from '../screens/auth/ConnectMusicService';

// Modal screens (presented over the entire app)
import PostScreen from '../screens/main/PostScreen';
import PostCategoryScreen from '../screens/main/PostCategoryScreen';
import PostDetailsScreen from '../screens/main/PostDetailsScreen';
import PlaylistDetail from '../screens/main/PlaylistDetail';
import EditCaptionScreen from '../screens/edit/EditCaptionScreen';
import ChangeCategoriesScreen from '../screens/edit/ChangeCategoriesScreen';

// Main Tab Navigator
import MainTabNavigator from './MainTabNavigator';

const Stack = createStackNavigator();

const Navigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#000000' },
      }}
    >
      {/* Auth Flow */}
      <Stack.Screen 
        name="SignIn" 
        component={SignInScreen}
      />
      <Stack.Screen 
        name="SignUpOptions" 
        component={SignUpOptionsScreen}
      />
      <Stack.Screen
        name="ConnectMusicService"
        component={ConnectMusicService}
      />
      
      {/* Main App */}
      <Stack.Screen 
        name="Main"
        component={MainTabNavigator}
      />
      
      {/* Modal Screens */}
      <Stack.Screen 
        name="Playlist" 
        component={PlaylistDetail}
      />
      <Stack.Screen 
        name="EditCaption" 
        component={EditCaptionScreen}
      />
      <Stack.Screen 
        name="ChangeCategories" 
        component={ChangeCategoriesScreen}
      />
      <Stack.Screen 
        name="Post" 
        component={PostScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen 
        name="PostCategory" 
        component={PostCategoryScreen}
      />
      <Stack.Screen 
        name="PostDetails" 
        component={PostDetailsScreen}
      />
    </Stack.Navigator>
  );
};

export default Navigator;