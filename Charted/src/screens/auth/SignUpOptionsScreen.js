import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import axios from 'axios';

const transparentIcon = require('../../../assets/transparent_icon.png');

const SignUpOptionsScreen = ({ navigation }) => {
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Check if Apple Sign In is available on this device
  useEffect(() => {
    const checkAppleSignIn = async () => {
      const available = await AppleAuthentication.isAvailableAsync();
      setIsAppleAvailable(available);
    };
    
    checkAppleSignIn();
  }, []);

  // Configure Google Sign In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '1023824427311-naqeer2r2h1c0eml3ahk4c1t3l1dhaco.apps.googleusercontent.com',
      iosClientId: '1023824427311-3a93e3i7o3hjivqgcjcfrelrej3pmmvc.apps.googleusercontent.com',
    });
  }, []);

  // Handle Apple Sign In
  const handleAppleSignIn = async () => {
    const safetyTimeout = setTimeout(() => {
      if (isAppleLoading) {
        setIsAppleLoading(false);
        Alert.alert(
          'Connection Timeout',
          'The request is taking too long. Please check your internet connection and try again.'
        );
      }
    }, 30000);

    try {
      setIsAppleLoading(true);
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      const firstName = credential.fullName?.givenName || '';
      const lastName = credential.fullName?.familyName || '';
      const name = [firstName, lastName].filter(n => n.trim()).join(' ');
      
      const apiUrl = 'http://10.0.0.107:8080';
      
      let responseData;
      try {
        const requestConfig = {
          method: 'POST',
          url: `${apiUrl}/api/auth/apple/signin`,
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Client-Version': '1.0.0',
          },
          data: {
            identityToken: credential.identityToken,
            name,
            email: credential.email
          }
        };
        
        try {
          await axios.get(`${apiUrl}/api/health`, { timeout: 5000 });
        } catch (pingError) {
          // Continue anyway
        }
        
        const response = await axios(requestConfig);
        responseData = response.data;
      } catch (apiError) {
        throw new Error(`Backend API error: ${apiError.message}`);
      }
      
      clearTimeout(safetyTimeout);
      
      if (responseData && responseData.token && responseData.user) {
        try {
          const { token, user } = responseData;

          await SecureStore.setItemAsync('jwtToken', token);
          if (user.userId) await SecureStore.setItemAsync('userId', user.userId.toString());
          if (user.username) await SecureStore.setItemAsync('username', user.username);
          if (user.name) await SecureStore.setItemAsync('name', user.name);
          if (user.emailAddress) await SecureStore.setItemAsync('emailAddress', user.emailAddress);
          await SecureStore.setItemAsync('authProvider', 'apple');

          const hasAppleMusicConnection = user.appleMusicUserToken && user.appleMusicUserToken.trim() !== '';

          if (hasAppleMusicConnection) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          } else {
            const userIdForNav = user.userId.toString();
            navigation.navigate('ConnectMusicService', { userId: userIdForNav });
          }
        } catch (storageError) {
          throw new Error(`Storage error: ${storageError.message}`);
        }
      } else {
        if (responseData && responseData.token === 'Apple authentication failed') {
          Alert.alert('Authentication Failed', 'Could not sign up with Apple. Please try again.');
        } else {
          throw new Error('Invalid response from server - missing token or user data');
        }
      }
    } catch (error) {
      clearTimeout(safetyTimeout);
      
      if (error.code === AppleAuthentication.AppleAuthenticationErrorCode.USER_CANCEL) {
        // User cancelled, do nothing
      } else {
        console.log('Apple Sign-Up Error:', JSON.stringify(error, null, 2));
        Alert.alert(
          'Sign-Up Error',
          'Could not create account with Apple. Please try again.'
        );
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      if (!userInfo.data || !userInfo.data.idToken) {
        console.log('Google Sign-Up Warning: idToken is missing. The user may have cancelled.', userInfo);
        setIsGoogleLoading(false);
        return;
      }
      
      const apiUrl = 'http://10.0.0.107:8080';
      
      const requestConfig = {
        method: 'POST',
        url: `${apiUrl}/api/auth/google/signin`,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        data: {
          idToken: userInfo.data.idToken
        }
      };
      
      const response = await axios(requestConfig);
      const responseData = response.data;
      
      if (responseData && responseData.token && responseData.user) {
        try {
          const { token, user } = responseData;

          await SecureStore.setItemAsync('jwtToken', token);
          if (user.userId) await SecureStore.setItemAsync('userId', user.userId.toString());
          if (user.username) await SecureStore.setItemAsync('username', user.username);
          if (user.name) await SecureStore.setItemAsync('name', user.name);
          if (user.emailAddress) await SecureStore.setItemAsync('emailAddress', user.emailAddress);
          await SecureStore.setItemAsync('authProvider', 'google');

          const hasAppleMusicConnection = user.appleMusicUserToken && user.appleMusicUserToken.trim() !== '';

          if (hasAppleMusicConnection) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          } else {
            const userIdForNav = user.userId.toString();
            navigation.navigate('ConnectMusicService', { userId: userIdForNav });
          }
        } catch (storageError) {
          throw new Error(`Storage error: ${storageError.message}`);
        }
      } else {
        if (responseData && responseData.token === 'Google authentication failed') {
          Alert.alert('Authentication Failed', 'Could not sign up with Google. Please try again.');
        } else {
          throw new Error('Invalid response from server - missing token or user data');
        }
      }
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow - not an error
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Sign-Up In Progress', 'Please wait for the current sign-up to complete.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Google Play Services', 'Google Play Services is not available or outdated.');
      } else {
        console.log('Google Sign-Up Error:', JSON.stringify(error, null, 2));
        Alert.alert(
          'Sign-Up Error',
          'Could not create account with Google. Please try again.'
        );
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
      
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Image 
              source={transparentIcon} 
              style={styles.iconImage} 
            />
          </View>
          <Text style={styles.heroTitle}>Join Charted</Text>
          <Text style={styles.heroSubtitle}>
            Create your account to start sharing and discovering amazing playlists
          </Text>
        </View>
        
        <View style={styles.authContainer}>
          <Text style={styles.authTitle}>Choose your sign-up method</Text>
          
          {isAppleAvailable && (
            <TouchableOpacity 
              style={[styles.authButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={isAppleLoading}
            >
              {isAppleLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={styles.buttonIcon} />
              ) : (
                <Ionicons name="logo-apple" size={22} color="#FFFFFF" style={styles.buttonIcon} />
              )}
              <Text style={styles.buttonText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.authButton, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.buttonIcon} />
            ) : (
              <Ionicons name="logo-google" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            )}
                          <Text style={styles.buttonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.signInContainer}>
          <Text style={styles.signInText}>Already have an account?</Text>
          <TouchableOpacity 
            style={styles.signInButton}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>
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
  content: {
    flex: 1,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  iconContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconImage: {
    width: 100,
    height: 100,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#AAAAAA',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  authContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#DB4437',
    borderColor: '#DB4437',
  },
  buttonIcon: {
    marginRight: 12,
    width: 22,
    height: 22,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signInContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInText: {
    fontSize: 16,
    color: '#AAAAAA',
    marginBottom: 12,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#333333',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  termsContainer: {
    paddingHorizontal: 40,
    paddingTop: 16,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#007AFF',
  },
});

export default SignUpOptionsScreen; 