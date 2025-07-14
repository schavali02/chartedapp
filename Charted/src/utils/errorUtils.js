// Create a reusable function for handling API errors consistently
import { Alert } from 'react-native';

export const handleApiError = (error, navigation = null) => {
  console.error("API Error:", error);

  if (error.response) {
    // The request was made and the server responded with a status code
    const { status, data } = error.response;

    if (status === 401) {
      // Unauthorized: Token is invalid or expired.
      // Redirect to login screen.
      Alert.alert("Session Expired", "Your session has expired. Please log in again.");
      if (navigation) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'LoginOptions' }],
        });
      }
    } else if (status === 403) {
      // Forbidden: User does not have permission.
      Alert.alert("Access Denied", "You don't have permission to perform this action.");
    } else if (status === 404) {
      // Not Found
      Alert.alert("Not Found", "The content you're looking for could not be found.");
    } else {
      // Other server errors (400, 500, etc.)
      const message = data?.message || "An unexpected server error occurred.";
      Alert.alert("Error", `${message}`);
    }

  } else if (error.request) {
    // The request was made but no response was received (e.g., network error)
    Alert.alert("Network Error", "Could not connect to the server. Please check your internet connection.");
  } else {
    // Something else happened in setting up the request
    Alert.alert("Error", "An unexpected error occurred. Please try again.");
  }
};

// Helper function to get auth headers
export const getAuthHeaders = async () => {
  const SecureStore = require('expo-secure-store');
  const token = await SecureStore.getItemAsync('jwtToken');
  if (!token) throw new Error('Authentication token not found');
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Helper function to get user ID
export const getUserId = async () => {
  const SecureStore = require('expo-secure-store');
  const userId = await SecureStore.getItemAsync('userId');
  if (!userId) throw new Error('User ID not found');
  return userId;
}; 