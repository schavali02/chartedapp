import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getToken, removeToken } from '../utils/tokenStorage';
import apiClient from '../utils/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from storage and validate token on app startup
  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        console.log('🔄 AuthContext: Loading user from storage...');
        setIsLoading(true);
        
        const storedToken = await getToken();
        if (storedToken) {
          console.log('🔑 AuthContext: Found stored token, validating...');
          setToken(storedToken);
          
          try {
            // Validate token by fetching user data
            const response = await apiClient.get('/api/users/me');
            if (response.data) {
              console.log('✅ AuthContext: Token valid, user authenticated');
              setUser(response.data);
            }
          } catch (error) {
            console.log('❌ AuthContext: Token validation failed, removing invalid token');
            // Token is invalid, remove it
            await removeToken();
            setToken(null);
            setUser(null);
          }
        } else {
          console.log('ℹ️ AuthContext: No stored token found');
        }
      } catch (error) {
        console.error('❌ AuthContext: Error loading user from storage', error);
      } finally {
        setIsLoading(false);
        console.log('✅ AuthContext: Initial auth check complete');
      }
    };

    loadUserFromStorage();
  }, []);

  // Function to update auth state after successful sign-in
  const updateAuthState = async (authData) => {
    try {
      console.log('🔄 AuthContext: Updating auth state with new data');
      
      if (authData.token && authData.user) {
        setToken(authData.token);
        setUser(authData.user);
        console.log('✅ AuthContext: Auth state updated successfully');
      } else {
        console.error('❌ AuthContext: Invalid auth data provided');
        throw new Error('Invalid auth data');
      }
    } catch (error) {
      console.error('❌ AuthContext: Error updating auth state', error);
      throw error;
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      console.log('🔄 AuthContext: Signing out user...');
      
      // Remove token from secure storage
      await removeToken();
      
      // Clear all stored user data
      const keysToRemove = ['userId', 'username', 'name', 'emailAddress', 'authProvider'];
      for (const key of keysToRemove) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (error) {
          // Key might not exist, continue
          console.log(`ℹ️ AuthContext: Key ${key} not found in storage`);
        }
      }
      
      // Clear state
      setToken(null);
      setUser(null);
      
      console.log('✅ AuthContext: User signed out successfully');
    } catch (error) {
      console.error('❌ AuthContext: Error during sign out', error);
      throw error;
    }
  };

  const value = {
    user,
    token,
    isLoading,
    updateAuthState,
    signOut,
    // Helper to check if user is authenticated
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 