import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  ActivityIndicator,
  Image,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const PostScreen = ({ navigation, route }) => {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fromAuthFlow = route.params?.fromAuthFlow;

  // Fetch playlists when component mounts
  useEffect(() => {
    console.log('[PostScreen] Component mounted. Starting playlist fetch.');
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get userId from SecureStore
      const userId = await SecureStore.getItemAsync('userId');
      console.log('[PostScreen] Fetched from SecureStore - userId:', userId);
      if (!userId) {
        throw new Error('User ID not found in SecureStore');
      }
      
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      console.log('[PostScreen] Fetched from SecureStore - jwtToken exists:', !!token);
      if (!token) {
        throw new Error('Authentication token not found in SecureStore');
      }
      
      // Make API call to the new unified music playlists endpoint
      const baseUrl = 'http://10.0.0.107:8080';
      console.log(`[PostScreen] Making API call to: ${baseUrl}/api/music/playlists`);
      const response = await axios.get(`${baseUrl}/api/music/playlists`, {
        timeout: 5000,
        params: {
          userId: userId
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[PostScreen] API call successful. Response status:', response.status);
      console.log('[PostScreen] Response data:', JSON.stringify(response.data, null, 2));

      // Directly use the response data - no transformation needed
      // The backend now returns data in the exact format: [{id, name, imageUrl, source}]
      if (response.data) {
        console.log(`[PostScreen] Setting ${response.data.length} playlists to state.`);
        setPlaylists(response.data);
      } else {
        console.log('[PostScreen] Response data is falsy. Setting playlists to empty array.');
        setPlaylists([]);
      }
    } catch (error) {
      console.log('[PostScreen] An error occurred in fetchPlaylists.');
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('[PostScreen] API Error Response Status:', error.response.status);
        console.error('[PostScreen] API Error Response Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        // The request was made but no response was received
        console.error('[PostScreen] Network Error: No response received. Is the server running?');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('[PostScreen] Client-side Error:', error.message);
      }
      
      // For 500 errors, we want to show the reload button but no error message.
      if (error.response && error.response.status === 500) {
        setError(true); // Indicates an error occurred, but show no message
      } else {
        let errorMessage = 'Failed to load playlists. ';
        if (error.code === 'ECONNABORTED') {
          errorMessage += 'Request timed out. Please check your connection.';
        } else if (!error.response) {
          errorMessage += 'Cannot reach the server.';
        } else {
          errorMessage += error.message || 'Please try again.';
        }
        setError(errorMessage);
      }
      
      // Set fallback playlists if API call fails
      console.log('[PostScreen] Setting fallback playlists due to error.');
      setPlaylists([
        { id: "late-night-drive", name: "Late Night Drive" },
        { id: "workout-beats", name: "Workout Beats" },
        { id: "chill-vibes", name: "Chill Vibes Only" },
        { id: "party-mix", name: "Party Mix 2024" },
        { id: "morning-coffee", name: "Morning Coffee" },
        { id: "study-session", name: "Study Session" },
      ]);
    } finally {
      console.log('[PostScreen] fetchPlaylists finished. Setting loading to false.');
      setLoading(false);
    }
  };

  console.log('[PostScreen] Rendering component. Current state:', {
    loading,
    error,
    playlistCount: playlists.length,
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {fromAuthFlow ? (
          <View style={styles.headerSpacer} />
        ) : (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>New Post</Text>
        {/* When navigating to PostDetails, add the imageUrl parameter */}
        <TouchableOpacity 
          style={[styles.nextButton, !selectedPlaylist && styles.disabledButton]}
          disabled={!selectedPlaylist}
          onPress={() => {
            if (selectedPlaylist) {
              // Find the selected playlist to get its name and image
              const selected = playlists.find(p => p.id === selectedPlaylist);
              navigation.navigate('PostCategory', { 
                playlistId: selectedPlaylist,
                playlistName: selected ? selected.name : 'Playlist',
                playlistImageUrl: selected ? selected.imageUrl : null
              });
            } else {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Loading indicator */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading playlists...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          {typeof error === 'string' && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchPlaylists}
          >
            <Text style={styles.retryButtonText}>Reload</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Playlist Grid - Two columns */
        <ScrollView style={styles.scrollView}>
          <View style={styles.gridContainer}>
            {playlists.map((playlist) => (
              <TouchableOpacity
                key={playlist.id}
                style={[
                  styles.playlistItem,
                  selectedPlaylist === playlist.id && styles.selectedPlaylistItem
                ]}
                onPress={() => setSelectedPlaylist(playlist.id)}
              >
                {/* Playlist name above the image */}
                <Text 
                  style={[
                    styles.playlistName,
                    selectedPlaylist === playlist.id && styles.selectedPlaylistName
                  ]} 
                  numberOfLines={1}
                >
                  {playlist.name}
                </Text>
                
                {/* Playlist cover image or placeholder */}
                <View style={styles.playlistCover}>
                  {playlist.imageUrl ? (
                    <Image
                      source={{ uri: playlist.imageUrl }}
                      style={styles.playlistImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.whitePlaceholder} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// Styles remain the same
const { width } = Dimensions.get('window');
const itemWidth = (width - 32) / 2; // 2 columns with padding

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 4,
  },
  headerSpacer: {
    width: 32, // Same width as the back button to maintain alignment
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nextButton: {
    padding: 8,
  },
  nextButtonText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    justifyContent: 'space-between',
  },
  playlistItem: {
    width: itemWidth,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPlaylistItem: {
    borderColor: '#007AFF',
  },
  playlistName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  selectedPlaylistName: {
    color: '#007AFF',
  },
  playlistCover: {
    aspectRatio: 1, // Square aspect ratio
    borderRadius: 4,
    overflow: 'hidden',
  },
  whitePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  playlistImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333', // Fallback color while loading
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PostScreen;