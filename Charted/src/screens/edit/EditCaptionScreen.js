import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const BASE_URL = 'http://10.0.0.107:8080';

const EditCaptionScreen = ({ route, navigation }) => {
  // Get post ID and current caption from route params
  const { postId, caption: initialCaption = '' } = route.params || {};
  
  // State for caption and loading
  const [caption, setCaption] = useState(initialCaption);
  const [postData, setPostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const contentRef = useRef(null);
  
  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('jwtToken');
    if (!token) throw new Error('Authentication token not found');
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };
  
  // Fetch post details to display playlist info
  useEffect(() => {
    const fetchPostDetails = async () => {
      if (!postId) {
        setError('Post ID not found');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const headers = await getAuthHeaders();
        
        // Fetch post data
        const response = await axios.get(`${BASE_URL}/api/posts/${postId}`, {
          headers
        });
        
        if (response.data) {
          setPostData(response.data);
          
          // Parse tracks if they exist
          if (response.data.tracks) {
            try {
              const parsedTracks = JSON.parse(response.data.tracks);
              response.data.parsedTracks = parsedTracks;
            } catch (e) {
              console.error('Error parsing tracks:', e);
              response.data.parsedTracks = [];
            }
          }
          
          // Remove categories parsing
          setPostData(response.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('Error fetching post details:', error);
        setError('Failed to load post details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPostDetails();
  }, [postId]);
  
  // Save the updated caption
  const saveCaption = async () => {
    if (!postId) {
      Alert.alert('Error', 'Post ID not found');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      
      // Make API call to update the caption
      await axios.put(`${BASE_URL}/api/posts/${postId}/caption`, 
      { 
        caption: caption 
      }, 
      { headers });
      
      // Reset navigation stack to Home
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Home', params: { refreshData: true } } }],
      });
    } catch (error) {
      console.error('Error updating caption:', error);
      Alert.alert('Error', 'Failed to update caption. Please try again.');
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>Edit Caption</Text>
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
          </View>
        ) : (
          <View 
            style={styles.content} 
            ref={contentRef}
          >
            {/* Playlist Header */}
            <View style={styles.playlistHeader}>
              <View style={styles.coverImageContainer}>
                        {postData?.playlistImageUrl ? (
          <Image 
            source={{ uri: postData.playlistImageUrl }}
                    style={styles.coverImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.whitePlaceholder} />
                )}
              </View>
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistName}>{postData?.playlistName || 'Playlist'}</Text>
                <Text style={styles.playlistUser}>@{postData?.username || 'user'}</Text>
              </View>
            </View>

            {/* Songs List */}
            <ScrollView style={styles.songsList}>
              {postData?.parsedTracks && postData.parsedTracks.length > 0 ? (
                postData.parsedTracks.map((song, index) => (
                  <View key={index} style={styles.songItem}>
                    <View style={styles.albumCoverContainer}>
                      {song.albumImageUrl ? (
                        <Image
                          source={{ uri: song.albumImageUrl }}
                          style={styles.albumCover}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.whitePlaceholder} />
                      )}
                    </View>
                    <View style={styles.songDetails}>
                      <Text style={styles.songTitle}>{song.songTitle || 'Unknown Title'}</Text>
                      <Text style={styles.songArtist}>{song.songArtist || 'Unknown Artist'}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noSongsText}>No songs available</Text>
              )}
            </ScrollView>

            {/* Caption and Save Button */}
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
                  multiline={true}
                  value={caption}
                  onChangeText={setCaption}
                  returnKeyType="done"
                />
                
                {/* Save Button */}
                <TouchableOpacity 
                  style={[
                    styles.saveButton, 
                    (saving || caption === initialCaption) && styles.disabledButton
                  ]}
                  onPress={saveCaption}
                  disabled={saving || caption === initialCaption}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
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
    flex: 1,
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
    backgroundColor: '#333333',
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
    backgroundColor: '#000000',
  },
  captionInput: {
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 60,
    padding: 0,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
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
  noSongsText: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
});

export default EditCaptionScreen;
