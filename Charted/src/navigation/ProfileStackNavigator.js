import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ProfileScreen from '../screens/main/ProfileScreen';
import FollowScreen from '../screens/main/FollowScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import UpdateDisplayNameScreen from '../screens/settings/account/UpdateDisplayNameScreen';
import UpdateUsernameScreen from '../screens/settings/account/UpdateUsernameScreen';
import UpdateBioScreen from '../screens/settings/profile/UpdateBioScreen';
import BalanceScreen from '../screens/settings/BalanceScreen';
import TermsOfServiceScreen from '../screens/settings/support/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/settings/support/PrivacyPolicyScreen';

const Stack = createStackNavigator();

const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Follow" component={FollowScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="UpdateDisplayName" component={UpdateDisplayNameScreen} />
      <Stack.Screen name="UpdateUsername" component={UpdateUsernameScreen} />
      <Stack.Screen name="UpdateBio" component={UpdateBioScreen} />
      <Stack.Screen name="Balance" component={BalanceScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
};

export default ProfileStackNavigator; 