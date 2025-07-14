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

const UpdateDisplayNameScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // Load the stored name when component mounts
  useEffect(() => {
    const loadDisplayName = async () => {
      try {
        const storedName = await SecureStore.getItemAsync('name');
        if (storedName) setName(storedName);
      } catch (error) {
        console.error('Error loading display name from SecureStore:', error);
      }
    };
    loadDisplayName();
  }, []);

  // Function to handle display name update
  const handleUpdateDisplayName = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
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
      
      // Make API call to update display name
      const response = await axios.put(
        `${API_BASE_URL}/${userId}/displayname`,
        { name },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000
        }
      );
      
      // Save the updated name to SecureStore
      await SecureStore.setItemAsync('name', name);
      
      Alert.alert(
        'Success',
        'Your display name has been updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error updating display name:', error);
      
      let errorMessage = 'Failed to update display name.';
      if (error.response) {
        // Server responded with an error status
        errorMessage = `Error: ${error.response.data.message || 'Something went wrong'}`;
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
        <Text style={styles.headerTitle}>Update Display Name</Text>
        <View style={styles.spacer} />
      </View>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      
      <View style={styles.formContainer}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor="#777777"
          autoCorrect={false}
          value={name}
          onChangeText={setName}
          maxLength={50}
          autoCapitalize="words"
        />
        
        <TouchableOpacity 
          style={[styles.button, (!name.trim()) ? styles.buttonDisabled : null]}
          onPress={handleUpdateDisplayName}
          disabled={!name.trim() || loading}
        >
          <Text style={styles.buttonText}>Update Display Name</Text>
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
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
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

export default UpdateDisplayNameScreen; 