import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_BASE_URL = 'http://10.0.0.107:8080/api/users';

const UpdateUsernameScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [debounceTimeout, setDebounceTimeout] = useState(null);

  // Function to check username availability
  const checkUsernameAvailability = async (text) => {
    setUsername(text);
    
    if (!text.trim() || text.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    // Basic username validation
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(text)) {
      setUsernameAvailable(false);
      return;
    }
    
    // Clear any existing timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    // Set a new timeout to delay the API call
    const timeoutId = setTimeout(async () => {
      try {
        setCheckingAvailability(true);
        
        // Make API call to check username availability
        try {
          const response = await axios.get(`${API_BASE_URL}/check-username?username=${text}`, {
            timeout: 5000
          });
          
          // Assuming the API returns { available: true/false }
          setUsernameAvailable(response.data.available);
        } catch (error) {
          console.error('Error checking username availability:', error);
          console.log('Username availability endpoint may not exist. Using fallback...');
          
          // Fallback: If the endpoint doesn't exist, we'll do a direct check against users with that username
          try {
            // This is assuming there's a different endpoint to check for users by username
            const response = await axios.get(`${API_BASE_URL}/username/${text}/id`, {
              timeout: 5000
            });
            
            // If we get a successful response, then username is taken
            setUsernameAvailable(false);
          } catch (err) {
            // If we get a 404, username may be available
            if (err.response && err.response.status === 404) {
              setUsernameAvailable(true);
            } else {
              // For any other error, we assume username might be taken to be safe
              setUsernameAvailable(false);
            }
          }
        }
      } catch (error) {
        console.error('Error in username availability check:', error);
        // Default to unavailable in case of error
        setUsernameAvailable(false);
      } finally {
        setCheckingAvailability(false);
      }
    }, 500);
    
    setDebounceTimeout(timeoutId);
  };

  // Function to handle username update
  const handleUpdateUsername = async () => {
    if (!username.trim() || !usernameAvailable) {
      Alert.alert('Error', 'Please enter a valid and available username');
      return;
    }

    try {
      setLoading(true);
      
      // Get user ID from SecureStore
      const userId = await SecureStore.getItemAsync('userId');
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Make API call to update username
      const response = await axios.put(
        `${API_BASE_URL}/${userId}/username`,
        { username },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000
        }
      );
      
      // Save the updated username to SecureStore
      await SecureStore.setItemAsync('username', username);
      
      Alert.alert(
        'Success',
        'Your username has been updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error updating username:', error);
      
      let errorMessage = 'Failed to update username.';
      if (error.response) {
        // Server responded with an error status
        if (error.response.status === 400) {
          errorMessage = 'This username is already taken. Please try another one.';
        } else {
          errorMessage = `Error: ${error.response.data.message || 'Something went wrong'}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Clean up the timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  // Load the current username when the component mounts
  useEffect(() => {
    const loadCurrentUsername = async () => {
      try {
        const storedUsername = await SecureStore.getItemAsync('username');
        if (storedUsername) {
          setUsername(storedUsername);
          // Don't check availability immediately, wait for user to make changes
        }
      } catch (error) {
        console.error('Error loading username from SecureStore:', error);
      }
    };
    
    loadCurrentUsername();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Update Username</Text>
        <View style={styles.spacer} />
      </View>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      
      <View style={styles.formContainer}>
        <Text style={styles.label}>New Username</Text>
        <TextInput
          style={[
            styles.input, 
            usernameAvailable === true ? styles.inputAvailable : null,
            usernameAvailable === false ? styles.inputUnavailable : null
          ]}
          placeholder="Enter your new username"
          placeholderTextColor="#777777"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={checkUsernameAvailability}
          maxLength={20}
        />
        
        {username.trim().length > 0 && (
          <View style={styles.availabilityContainer}>
            {(checkingAvailability && username.trim().length >= 3) && (
              <Text style={styles.checkingText}>Checking availability...</Text>
            )}
            {!checkingAvailability && usernameAvailable === true && (
              <Text style={styles.availableText}>This username is available</Text>
            )}
            {!checkingAvailability && usernameAvailable === false && (
              <Text style={styles.unavailableText}>
                This username is unavailable or invalid
              </Text>
            )}
          </View>
        )}
        
        <Text style={styles.helpText}>
          Username can only contain letters, numbers, and underscores.
        </Text>
        
        <TouchableOpacity 
          style={[
            styles.button, 
            (!username.trim() || !usernameAvailable || checkingAvailability) ? styles.buttonDisabled : null
          ]}
          onPress={handleUpdateUsername}
          disabled={!username.trim() || !usernameAvailable || checkingAvailability || loading}
        >
          <Text style={styles.buttonText}>Update Username</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  inputAvailable: {
    borderColor: '#4CD964', // Green color for available
  },
  inputUnavailable: {
    borderColor: '#FF3B30', // Red color for unavailable
  },
  availabilityContainer: {
    marginBottom: 16,
    marginTop: 4,
  },
  checkingText: {
    color: '#777777',
    fontSize: 14,
  },
  availableText: {
    color: '#4CD964',
    fontSize: 14,
  },
  unavailableText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  helpText: {
    color: '#777777',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#444444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UpdateUsernameScreen; 