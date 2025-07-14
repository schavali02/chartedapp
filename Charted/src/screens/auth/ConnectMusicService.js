import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  Image, 
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  ScrollView,
  Platform
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppleMusicAuth } from '@superfan-app/apple-music-auth';

const { width, height } = Dimensions.get('window');

const ConnectMusicService = ({ navigation, route }) => {
  const [isConnectingAppleMusic, setIsConnectingAppleMusic] = useState(false);
  const { authState, requestAuthorization, getUserToken, isAuthenticating, error } = useAppleMusicAuth();

  // ADD THIS: useEffect to log authState and error changes
  React.useEffect(() => {
    console.log('[AppleMusicAuth] authState changed:', authState);
  }, [authState]);

  React.useEffect(() => {
    if (error) {
      console.log('[AppleMusicAuth] error changed:', JSON.stringify(error, null, 2));
    }
  }, [error]);

  const handleConnectAppleMusic = async () => {
    try {
      console.log('Starting Apple Music connection...');
      setIsConnectingAppleMusic(true);
  
      if (Platform.OS !== 'ios') {
        Alert.alert('Platform Error', 'Apple Music is only available on iOS devices.');
        return;
      }
      console.log('Platform check passed.');
  
      const status = await requestAuthorization();
      console.log('Authorization status:', status);
  
      if (status !== 'authorized') {
        Alert.alert('Authorization Failed', 'Apple Music access was not granted.');
        return;
      }
  
      console.log('Getting user token...');
      const userToken = await getUserToken();
      console.log('User token call finished.');
  
      if (!userToken) {
        console.error('[AppleMusicAuth] Failed to get user token. It was null or undefined.');
        Alert.alert('Authentication Error', 'Could not retrieve Apple Music user token.');
        return;
      }
      console.log('Successfully got user token.');
  
      const [jwtToken, userId] = await Promise.all([
        SecureStore.getItemAsync('jwtToken'),
        SecureStore.getItemAsync('userId')
      ]);
  
      if (!userId) {
        Alert.alert('Authentication Error', 'User not logged in.');
        return;
      }
  
      const baseUrl = 'http://10.0.0.107:8080';
      console.log('Sending user token to backend...');
      await axios.post(`${baseUrl}/api/apple-music/store-user-token`, 
        { userToken, userId },
        { headers: { Authorization: `Bearer ${jwtToken}` } }
      );
      console.log('Backend call successful.');
  
      await SecureStore.setItemAsync('appleMusicConnected', 'true');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Post', params: { fromAuthFlow: true } }],
      });
  
    } catch (e) {
      console.error('Error in handleConnectAppleMusic:', e);
      if (e.response) {
        console.error('Axios response error:', JSON.stringify(e.response.data, null, 2));
      }
      Alert.alert('Connection Error', e.message || 'An unknown error occurred while connecting to Apple Music.');
    } finally {
      setIsConnectingAppleMusic(false);
      console.log('Finished Apple Music connection attempt.');
    }
  };

  const connectAppleMusic = async () => {
    console.log("Attempting to connect to Apple Music...");
    try {
      setIsConnectingAppleMusic(true);

      if (Platform.OS !== 'ios') {
        throw new Error('Apple Music is only available on iOS devices');
      }
      console.log("Platform check passed. Proceeding with user ID fetch.");

      const [jwtToken, userId] = await Promise.all([
        SecureStore.getItemAsync('jwtToken'),
        SecureStore.getItemAsync('userId')
      ]);

      const navParams = route.params || {};
      const navUserId = navParams.userId;
      
      let effectiveUserId = userId || navUserId;
    
      if (!effectiveUserId && jwtToken) {
          try {
              console.log("No user ID in store, fetching from /api/users/me");
              const baseUrl = 'http://10.0.0.107:8080';
              const response = await axios.get(`${baseUrl}/api/users/me`, {
                  timeout: 5000,
                  headers: {
                      Authorization: `Bearer ${jwtToken}`,
                      'Content-Type': 'application/json'
                  }
              });
        
              if (response.data && (response.data.id || response.data.userId)) {
                  effectiveUserId = response.data.id || response.data.userId;
                  console.log("Fetched user ID from backend:", effectiveUserId);
                  await SecureStore.setItemAsync('userId', effectiveUserId.toString());
              }
          } catch (error) {
              console.error('Failed to fetch user info from backend:', error.message);
          }
      }

      if (!effectiveUserId) {
        throw new Error('No user ID found. Please log in again.');
      }
      console.log("User ID for Apple Music auth:", effectiveUserId);

      console.log("Requesting Apple Music authorization...");
      const status = await requestAuthorization();
      console.log("Authorization status received:", status);

      if (status !== 'authorized') {
        throw new Error('Apple Music access was denied.');
      }

      console.log("Getting Apple Music user token...");
      const userToken = await getUserToken();
      console.log("Successfully retrieved user token:", userToken ? "a token was received" : "token is null");

      if (!userToken) {
        console.error("[AppleMusicAuth] User token error in connectAppleMusic:", JSON.stringify(error, null, 2));
        throw new Error('Failed to retrieve Apple Music user token.');
      }

      console.log("Storing user token to backend...");
      const baseUrl = 'http://10.0.0.107:8080';
      const response = await axios.post(
        `${baseUrl}/api/apple-music/store-user-token`,
        {
          userId: effectiveUserId,
          userToken: userToken,
        },
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        console.log('✅ Apple Music User token stored successfully');
        await SecureStore.setItemAsync('appleMusicConnected', 'true');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Post', params: { fromAuthFlow: true } }],
        });
      } else {
        throw new Error(response.data.message || 'Failed to store user token on the server.');
      }
    } catch (err) {
      console.error('Apple Music connection error:', err);
      Alert.alert(
        'Connection Error',
        err.message || 'An unknown error occurred while connecting to Apple Music.'
      );
    } finally {
      setIsConnectingAppleMusic(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.formSection}>
          <Text style={styles.title}>Connect Apple Music</Text>
          
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Benefits of connecting:</Text>
            
            <View style={styles.benefitItem}>
              <Ionicons name="musical-notes" size={22} color="#FA243C" style={styles.benefitIcon} />
              <Text style={styles.benefitText}>Share your favorite playlists with the community</Text>
            </View>
            
            <View style={styles.benefitItem}>
              <Ionicons name="people" size={22} color="#FA243C" style={styles.benefitIcon} />
              <Text style={styles.benefitText}>Discover music curated by other users</Text>
            </View>
          </View>
          
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#777777" style={styles.privacyIcon} />
            <Text style={styles.privacyText}>
              We only access your public playlists. We never post on your behalf.
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.appleMusicButton}
          onPress={handleConnectAppleMusic}
          disabled={isConnectingAppleMusic || isAuthenticating}
        >
          {isConnectingAppleMusic || isAuthenticating ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={styles.buttonLoader} />
          ) : (
            <>
              <Image 
                source={require('../../../assets/images/Apple_Music_logo.png')} 
                style={styles.appleMusicLogo}
                resizeMode="contain"
              />
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.arrowIcon} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#AAAAAA',
    lineHeight: 20,
    marginBottom: 24,
  },
  benefitsContainer: {
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitIcon: {
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  privacyIcon: {
    marginRight: 10,
  },
  privacyText: {
    color: '#AAAAAA',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  appleMusicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FA2D48', // Apple Music red
    borderRadius: 8,
    paddingVertical: 14,
    height: 50,
  },

  buttonLoader: {
    marginRight: 8,
  },
  appleMusicLogo: {
    width: 100,
    height: 26,
    flex: 1,
    marginLeft: 20,
    tintColor: '#FFFFFF',
  },
  arrowIcon: {
    marginRight: 15,
  },
});

export default ConnectMusicService; 