import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import Navigator from './src/navigation/Navigator';
import * as Linking from 'expo-linking';
import { AppleMusicAuthProvider } from '@superfan-app/apple-music-auth';
import { ActivityIndicator, View, Text } from 'react-native';
import axios from 'axios';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider } from './src/context/AuthContext';

const prefix = Linking.createURL('/');

const linking = {
  prefixes: ['https://www.chartedapp.org'],
  config: {
    screens: {
      Playlist: 'playlist/:postId',
    },
  },
};

export default function App() {
  const [developerToken, setDeveloperToken] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [tokenError, setTokenError] = useState(null);

  useEffect(() => {
    const fetchDeveloperToken = async () => {
      try {
        const baseUrl = 'http://10.0.0.107:8080';
        const response = await axios.get(`${baseUrl}/api/apple-music/developer-token`, {
          timeout: 10000,
        });
        
        if (response.status === 200 && response.data) {
          setDeveloperToken(response.data);
        } else {
          throw new Error('Failed to fetch developer token');
        }
      } catch (error) {
        console.error('Error fetching Apple Music developer token:', error);
        setTokenError(error.message);
        // Continue without developer token - Apple Music features will be limited
      } finally {
        setIsLoadingToken(false);
      }
    };

    fetchDeveloperToken();
  }, []);

  // Show loading screen while fetching developer token
  if (isLoadingToken) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={{ color: '#FFFFFF', marginTop: 16 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <StripeProvider
        publishableKey="pk_test_51RGuAWRw8T7S9cnNuHr4xqIsuPAdSHBubT5S4YYzA06wSgTWvGfFCHeNJma3EQRRZA5DpNWKrk096l31dcZg37Si00Sz4AesGq" // Replace with your actual publishable key
      >
        <AppleMusicAuthProvider developerToken={developerToken}>
          <NavigationContainer linking={linking}>
            <Navigator />
          </NavigationContainer>
        </AppleMusicAuthProvider>
      </StripeProvider>
    </AuthProvider>
  );
}
