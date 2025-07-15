import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'jwtToken';

export const saveToken = async (token) => {
  try {
    console.log('📱 TokenStorage: Saving token to secure store');
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    console.log('✅ TokenStorage: Token saved successfully');
  } catch (error) {
    console.error('❌ TokenStorage: Error saving token to secure store', error);
    throw error;
  }
};

export const getToken = async () => {
  try {
    console.log('📱 TokenStorage: Getting token from secure store');
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      console.log('✅ TokenStorage: Token retrieved successfully');
    } else {
      console.log('ℹ️ TokenStorage: No token found in secure store');
    }
    return token;
  } catch (error) {
    console.error('❌ TokenStorage: Error getting token from secure store', error);
    return null;
  }
};

export const removeToken = async () => {
  try {
    console.log('📱 TokenStorage: Removing token from secure store');
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    console.log('✅ TokenStorage: Token removed successfully');
  } catch (error) {
    console.error('❌ TokenStorage: Error removing token from secure store', error);
    throw error;
  }
}; 