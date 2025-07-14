import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation

// Import the new stack navigators
import HomeStackNavigator from './HomeStackNavigator';
import SearchStackNavigator from './SearchStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  const navigation = useNavigation(); // Get navigation object

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#121212',
          borderTopColor: '#333333',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeStack') {
            iconName = focused ? 'home' : 'home-outline';
            color = focused ? '#007AFF' : '#FFFFFF';
          } else if (route.name === 'SearchStack') {
            iconName = focused ? 'search' : 'search-outline';
            color = focused ? '#007AFF' : '#FFFFFF';
          } else if (route.name === 'PostTab') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
            color = '#FFFFFF';
          } else if (route.name === 'ProfileStack') {
            iconName = focused ? 'person' : 'person-outline';
            color = focused ? '#007AFF' : '#FFFFFF';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeStack" component={HomeStackNavigator} />
      <Tab.Screen name="SearchStack" component={SearchStackNavigator} />
      <Tab.Screen
        name="PostTab"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Post');
          },
        }}
      >
        {() => null}
      </Tab.Screen>
      <Tab.Screen name="ProfileStack" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator; 