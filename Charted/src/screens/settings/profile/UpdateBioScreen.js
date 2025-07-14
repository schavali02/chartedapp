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

const UpdateBioScreen = ({ navigation }) => {
  const [bio, setBio] = useState('');
  const [originalBio, setOriginalBio] = useState('');
  const [loading, setLoading] = useState(false);
  const characterLimit = 150;

  // Load the current bio when the component mounts
  useEffect(() => {
    const loadCurrentBio = async () => {
      try {
        const storedBio = await SecureStore.getItemAsync('bio');
        if (storedBio) {
          setBio(storedBio);
          setOriginalBio(storedBio);
        }
      } catch (error) {
        console.error('Error loading bio from SecureStore:', error);
      }
    };
    
    loadCurrentBio();
  }, []);

  // Function to handle bio update
  const handleUpdateBio = async () => {
    // Trim the bio to remove extra whitespace
    const trimmedBio = bio.trim();
    
    // Check if character limit is exceeded
    if (trimmedBio.length > characterLimit) {
      Alert.alert('Error', `Bio cannot exceed ${characterLimit} characters`);
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
      
      // Make API call to update bio
      const response = await axios.put(
        `${API_BASE_URL}/${userId}/bio`,
        { bio: trimmedBio },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000
        }
      );
      
      // Save the updated bio to SecureStore
      await SecureStore.setItemAsync('bio', trimmedBio);
      
      Alert.alert(
        'Success',
        'Your bio has been updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error updating bio:', error);
      
      let errorMessage = 'Failed to update bio.';
      if (error.response) {
        // Server responded with an error status
        if (error.response.status === 400) {
          errorMessage = error.response.data.message || 'Invalid bio format.';
        } else if (error.response.status === 401) {
          errorMessage = 'You are not authorized to update this bio.';
        } else if (error.response.status === 404) {
          errorMessage = 'User not found.';
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
        <Text style={styles.headerTitle}>Update Bio</Text>
        <View style={styles.spacer} />
      </View>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      
      <View style={styles.formContainer}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Write a short bio about yourself"
          placeholderTextColor="#777777"
          multiline
          maxLength={characterLimit}
          value={bio}
          onChangeText={setBio}
        />
        
        <Text style={styles.charCount}>
          {bio.length}/{characterLimit} characters
        </Text>
        
        <TouchableOpacity 
          style={[
            styles.button, 
            (bio.trim() === originalBio || loading) ? styles.buttonDisabled : null
          ]}
          onPress={handleUpdateBio}
          disabled={bio.trim() === originalBio || loading}
        >
          <Text style={styles.buttonText}>Update Bio</Text>
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
  textArea: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#FFFFFF',
    height: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333333',
  },
  charCount: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#444444',
  },
});

export default UpdateBioScreen; 