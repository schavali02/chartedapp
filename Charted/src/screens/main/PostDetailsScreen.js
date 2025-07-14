import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { handleApiError, getAuthHeaders, getUserId } from '../../utils/errorUtils';

const PostDetailsScreen = ({ navigation, route }) => {
  const [caption, setCaption] = useState('');
  
  const { playlistId, playlistName, playlistImageUrl, genres } = route.params || {};
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const contentRef = useRef(null);
  
  // Fetch playlist details when component mounts
  useEffect(() => {
    if (playlistId) {
      fetchPlaylistDetails();
    } else {
      setLoading(false);
      setError('No playlist selected');
    }
  }, [playlistId]);

  const fetchPlaylistDetails = async () => {
    const startTime = Date.now();
    try {
      setLoading(true);
      setError(null);
      
      // Get auth data using utility functions
      const userId = await getUserId();
      const headers = await getAuthHeaders();
      const username = await SecureStore.getItemAsync('username');
      
      // Make API call to the unified backend to get playlist details
      const baseUrl = 'http://10.0.0.107:8080';
      const response = await axios.get(`${baseUrl}/api/music/playlist-details`, {
        timeout: 5000,
        params: {
          userId: userId,
          playlistId: playlistId
        },
        headers
      });
      
      // Process the standardized response data
      if (response.data && response.data.playlist && response.data.data) {
        const { playlist: playlistInfo, data } = response.data;
        
        // Create a complete playlist object from the new response structure
        const fullPlaylistDetails = {
          id: playlistInfo.id,
          name: playlistName || playlistInfo.name || 'Playlist',
          user: username ? `@${username}` : '@user',
          imageUrl: playlistImageUrl || playlistInfo.imageUrl || null,
          shareableUrl: playlistInfo.url,
          source: playlistInfo.source,
          songs: data.items.map(item => {
            const images = item.track.album.images;
            const albumCoverUrl = images && images.length > 0 
              ? images[images.length - 1].url
              : null;

            return {
              id: item.track.id,
              title: item.track.name,
              artist: item.track.artists.map(artist => artist.name).join(', '),
              albumCover: albumCoverUrl
            };
          })
        };
        setPlaylist(fullPlaylistDetails);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      console.log(`Request to fetch playlist details failed after ${duration.toFixed(2)} seconds.`);

      console.log('Error fetching playlist details:', error);
      console.log('Error response:', error.response?.data);
      console.log('Error status:', error.response?.status);
      console.log('Requested playlistId:', playlistId);
      console.log('Requested userId:', await SecureStore.getItemAsync('userId'));
      
      let errorMessage = 'Failed to load playlist details. ';
      if (error.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out. Please check your connection.';
      } else if (!error.response) {
        errorMessage += 'Cannot reach the server.';
      } else if (error.response.status === 500) {
        errorMessage += `Server error occurred for playlist ${playlistId}. This playlist may have corrupted data or may not exist.`;
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      setError(errorMessage);
      
      // Set fallback playlist if API call fails
      setPlaylist({
        id: playlistId,
        name: playlistName || 'Playlist',
        user: '@user',
        imageUrl: playlistImageUrl || null,
        songs: [
          { title: "Song 1", artist: "Artist 1", albumCover: null },
          { title: "Song 2", artist: "Artist 2", albumCover: null },
          { title: "Song 3", artist: "Artist 3", albumCover: null },
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New post</Text>
          <View style={styles.spacer} />
        </View>

        {/* Main Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading playlist...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={fetchPlaylistDetails}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.retryButton, { marginTop: 10, backgroundColor: '#007AFF' }]}
              onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            >
              <Text style={styles.retryButtonText}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View 
            style={styles.content} 
            ref={contentRef}
          >
            {/* Playlist Header */}
            <View style={styles.playlistHeader}>
              <View style={styles.coverImageContainer}>
                {playlist.imageUrl ? (
                  <Image
                    source={{ uri: playlist.imageUrl }}
                    style={styles.coverImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.whitePlaceholder} />
                )}
              </View>
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistName}>{playlist.name}</Text>
                <Text style={styles.playlistUser}>{playlist.user}</Text>
              </View>
            </View>

            {/* Selected Genres */}
            {genres && genres.length > 0 && (
              <View style={styles.genresContainer}>
                <Text style={styles.genresTitle}>Categories:</Text>
                <View style={styles.genresList}>
                  {genres.map((genre, index) => (
                    <View key={index} style={styles.genreBadge}>
                      <Text style={styles.genreText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Songs List */}
            <ScrollView 
              style={styles.songsList}
              contentContainerStyle={keyboardVisible ? { paddingBottom: 0 } : null}
            >
              {playlist.songs.map((song, index) => (
                <View key={index} style={styles.songItem}>
                  <View style={styles.albumCoverContainer}>
                    {song.albumCover ? (
                      <Image
                        source={{ uri: song.albumCover }}
                        style={styles.albumCover}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.whitePlaceholder} />
                    )}
                  </View>
                  <View style={styles.songDetails}>
                    <Text style={styles.songTitle}>{song.title}</Text>
                    <Text style={styles.songArtist}>{song.artist}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Caption and Actions */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
              style={{ width: '100%' }}
            >
              <View style={styles.captionContainer}>
                <TextInput
                  style={styles.captionInput}
                  placeholder="Add a caption..."
                  placeholderTextColor="#999999"
                  multiline={false}
                  value={caption}
                  onChangeText={setCaption}
                  returnKeyType="done"
                  blurOnSubmit={true}
                />
                
                {/* Share Button */}
                <TouchableOpacity 
                  style={styles.shareButton}
                  onPress={async () => {
                    try {
                      console.log('Preparing to share playlist with caption:', caption);
                      
                      // Get userId from SecureStore
                      const userId = await SecureStore.getItemAsync('userId');
                      if (!userId) {
                        throw new Error('User ID not found');
                      }
                      
                      // Get JWT token from SecureStore
                      const token = await SecureStore.getItemAsync('jwtToken');
                      if (!token) {
                        throw new Error('Authentication token not found');
                      }
                      
                      // Get username from SecureStore
                      const username = await SecureStore.getItemAsync('username');
                      
                      // Prepare tracks JSON string
                      const tracksJson = JSON.stringify(playlist.songs.map(song => ({
                        trackId: song.id,
                        songTitle: song.title,
                        songArtist: song.artist,
                        albumImageUrl: song.albumCover
                      })));
                      
                      // Prepare categories JSON string
                      const categoryJson = JSON.stringify({
                        categories: genres || []
                      });
                      
                      // Prepare post data
                      const postData = {
                        userId: parseInt(userId),
                        caption: caption,
                        active: true,
                        playlistId: playlist.id,
                        playlistName: playlist.name,
                        playlistUrl: playlist.shareableUrl,
                        playlistImageUrl: playlist.imageUrl,
                        playlistSource: playlist.source,
                        username: username,
                        tracks: tracksJson,
                        category: categoryJson
                      };
                      
                      // Make API call to backend to create post
                      const headers = {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      };

                      await axios.post('http://10.0.0.107:8080/api/posts', postData, { headers });
                      console.log('Post created successfully');
                      
                      // Navigate to the Home screen after a successful post
                      navigation.navigate('Main', { 
                        screen: 'Home',
                        params: { refreshData: true } 
                      });
                    } catch (error) {
                      console.error('Error creating post:', error);
                      Alert.alert('Error', 'Could not create the post. Please try again.');
                    }
                  }}
                >
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  spacer: {
    width: 28,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  playlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  coverImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 16,
  },
  whitePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  playlistUser: {
    fontSize: 14,
    color: '#999999',
  },
  songsList: {
    flex: 1,  // This ensures the songs list takes up all available space
    padding: 16,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  albumCoverContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  albumCover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333', // Fallback color while loading
  },
  songDetails: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  songArtist: {
    fontSize: 14,
    color: '#999999',
  },
  captionContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    backgroundColor: '#000000', // Ensure background is black
  },
  captionInput: {
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 40, // Reduced from 60
    padding: 0,
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
  },
  musicSuggestions: {
    flexDirection: 'row',
    marginVertical: 16,
  },
  musicTag: {
    backgroundColor: '#333333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  musicTagText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  shareButton: {
    backgroundColor: '#007AFF',
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8, // Reduced from 16
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
  genresContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  genresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  genresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  genreBadge: {
    backgroundColor: '#333333',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  genreText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});

export default PostDetailsScreen;