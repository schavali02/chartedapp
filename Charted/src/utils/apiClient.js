import axios from 'axios';
import { getToken } from './tokenStorage';

// Base API URL - matching what's used in SignInScreen
const BASE_URL = 'http://10.0.0.107:8080';

// Create axios instance
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add JWT token to all requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getToken();
      if (token) {
        console.log('--- 🕵️‍♂️ API Client Auth Debug Start 🕵️‍♂️ ---');
        console.log('1. Token Type:', typeof token);
        console.log('2. Token Length:', token.length);
        console.log('3. Raw Token:', token);

        config.headers.Authorization = `Bearer ${token}`;
        
        console.log('4. Constructed Auth Header:', config.headers.Authorization);
        console.log('5. All Request Headers:', JSON.stringify(config.headers, null, 2));
        console.log('--- 🕵️‍♂️ API Client Auth Debug End 🕵️‍♂️ ---');
      } else {
        console.log('🔑 API Client: No token found, sending request without auth.');
      }
    } catch (error) {
      console.error('❌ API Client: Error getting token for request', error);
    }
    
    console.log(`📤 API Client: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Client: Request interceptor error', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Client: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`❌ API Client: ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.response.data);
    } else if (error.request) {
      console.error('❌ API Client: Network error - no response received', error.message);
    } else {
      console.error('❌ API Client: Request setup error', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient; 