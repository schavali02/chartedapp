import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Base URL for API calls
const BASE_URL = 'http://10.0.0.107:8080';

const SearchUserScreen = ({ route, navigation }) => {
  // Get search query from route params if available
  const { query } = route.params || { query: '' };
  
  // State for users data
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const navigateToUserOrProfile = async (targetUsername) => {
    if (!targetUsername) return; // Prevent navigation if username is missing
    try {
      const currentUsername = await SecureStore.getItemAsync('username');
      
      if (targetUsername === currentUsername) {
        // Navigate to own profile tab
        navigation.navigate('ProfileStack');
      } else {
        // Navigate to other user's screen in the Home stack
        navigation.navigate('HomeStack', { 
          screen: 'User', 
          params: { username: targetUsername }
        });
      }
    } catch (error) {
      console.error('Error navigating to user profile:', error);
      // Fallback navigation
      navigation.navigate('HomeStack', { 
        screen: 'User', 
        params: { username: targetUsername }
      });
    }
  };

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('jwtToken');
    if (!token) throw new Error('Authentication token not found');
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };
  
  // Fetch users from API when component mounts or query changes
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, { headers });
        
        // Validate the response structure
        if (response.data && Array.isArray(response.data.users)) {
          setUsers(response.data.users);
        } else {
          setError('Invalid response format from server.');
          setUsers([]);
        }
      } catch (error) {
        console.error('Search users error:', error);
        setError('Failed to fetch users. Please try again.');
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUsers();
  }, [query]);
  
  // Render a user item
  const renderUserItem = (user) => (
    <TouchableOpacity 
      key={user.userId || user.id}
      style={styles.searchResultItem}
      onPress={() => navigateToUserOrProfile(user.username)}
    >
      <View style={styles.userInfoContainer}>
        <Text style={styles.usernameText}>@{user.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#777777" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.appNameText}>Users{query ? ': ' + query : ''}</Text>
        <View style={styles.spacer} />
      </View>

      {/* Users List */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.contentContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading users...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setIsLoading(true);
                  // Re-trigger the useEffect
                  const fetchUsers = async () => {
                    try {
                      const headers = await getAuthHeaders();
                      const response = await axios.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, { headers });
                      
                      if (response.data && Array.isArray(response.data.users)) {
                        setUsers(response.data.users);
                        setError(null);
                      } else {
                        setError('Invalid response format from server.');
                        setUsers([]);
                      }
                    } catch (error) {
                      console.error('Search users error:', error);
                      setError('Failed to fetch users. Please try again.');
                      setUsers([]);
                    } finally {
                      setIsLoading(false);
                    }
                  };
                  
                  fetchUsers();
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No users found{query ? ` for "${query}"` : ''}</Text>
            </View>
          ) : (
            users.map(renderUserItem)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
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
  appNameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
    height: 74, // Fixed height for all items
  },
  userInfoContainer: {
    flex: 1,
    paddingLeft: 16,
  },
  usernameText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Loading, Error, and Empty states
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    marginBottom: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#AAAAAA',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SearchUserScreen; 