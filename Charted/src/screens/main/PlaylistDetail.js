import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
  Share,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { handleApiError, getAuthHeaders, getUserId } from '../../utils/errorUtils';

const PlaylistDetail = ({ navigation, route }) => {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { postId } = route.params || {};
  const [refreshing, setRefreshing] = useState(false);
  
  // State to track if data has changed on this screen
  const [dataChanged, setDataChanged] = useState(false);
  
  // Move parsedTracks useMemo to component top level
  const parsedTracks = React.useMemo(() => {
    if (!post?.tracks) return [];
    try {
      return JSON.parse(post.tracks || '[]');
    } catch (error) {
      console.error('Error parsing tracks:', error);
      return [];
    }
  }, [post?.tracks]);
  
  // Base URL for API calls
  const baseUrl = 'http://10.0.0.107:8080';
  
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      console.log('[PlaylistDetail] beforeRemove triggered. dataChanged:', dataChanged);
      if (!dataChanged) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();
      
      const state = navigation.getState();
      console.log('[PlaylistDetail] Navigation state:', JSON.stringify(state, null, 2));

      if (state.routes.length > 1) {
        const prevRouteName = state.routes[state.routes.length - 2].name;
        console.log(`[PlaylistDetail] Navigating back to ${prevRouteName} with refreshData: true`);
        navigation.navigate(prevRouteName, { refreshData: true });
      } else {
        console.log('[PlaylistDetail] No previous route, dispatching default action.');
        navigation.dispatch(e.data.action);
      }
    });

    return unsubscribe;
  }, [navigation, dataChanged]);

  // Immediate auth check on component mount (runs before anything else)
  useEffect(() => {
    const immediateAuthCheck = async () => {
      try {
        const token = await SecureStore.getItemAsync('jwtToken');
        if (!token) {
          console.log('User not authenticated, redirecting to login options');
          navigation.reset({
            index: 0,
            routes: [{ name: 'LoginOptions' }],
          });
        }
      } catch (error) {
        console.error('Error in immediate auth check:', error);
        navigation.reset({
          index: 0,
          routes: [{ name: 'LoginOptions' }],
        });
      }
    };
    
    immediateAuthCheck();
  }, [navigation]);
  
  // Check auth status, then fetch post if user is authenticated
  useEffect(() => {
    const checkAuthAndFetchPost = async () => {
      try {
        // Check if user is authenticated by looking for token
        const token = await SecureStore.getItemAsync('jwtToken');
        
        if (!token) {
          console.log('User not authenticated, redirecting to login options');
          // Navigate to LoginOptionsScreen if no token found
          navigation.reset({
            index: 0,
            routes: [{ name: 'LoginOptions' }],
          });
          return;
        }
        
        // Only proceed to fetch post if we have a postId and user is authenticated
        if (postId) {
          fetchPost();
        } else {
          setLoading(false);
          setError('No post ID provided');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        // If there's any error, assume user is not authenticated
        navigation.reset({
          index: 0,
          routes: [{ name: 'LoginOptions' }],
        });
      }
    };
    
    checkAuthAndFetchPost();
  }, [postId, navigation]);
  
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchPost();
    setRefreshing(false);
  }, [postId]);

  // OPTIMIZED: Fetch post with enriched data in a single request
  const fetchPost = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const headers = await getAuthHeaders();
      
      // SINGLE OPTIMIZED REQUEST - includes netVotes, userVote, and isSaved
      const response = await axios.get(`${baseUrl}/api/posts/${postId}`, {
        timeout: 10000,
        headers
      });
      
      console.log(`[PlaylistDetail] Raw response from /api/posts/${postId}:`, JSON.stringify(response.data, null, 2));

      // Data is already enriched with vote and save information
      if (response.data) {
        const enrichedPost = response.data;
        
        // Set post with enriched data
        setPost({
          ...enrichedPost,
          votes: enrichedPost.netVotes || 0,
          userVote: enrichedPost.userVote || 0,
          isSaved: enrichedPost.isSaved || false
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      handleApiError(error, navigation);
      setError('Failed to load post. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle voting on posts
  const handleVote = async (voteType) => {
    if (!post) return;

    const originalPost = { ...post };

    // Optimistic UI update
    let newVoteStatus = post.userVote;
    let voteChange = 0;

    if (voteType === 'upvote') {
      if (post.userVote === 1) { // un-upvote
        newVoteStatus = 0;
        voteChange = -1;
      } else {
        voteChange = 1 - (post.userVote || 0);
        newVoteStatus = 1;
      }
    } else { // downvote
      if (post.userVote === -1) { // un-downvote
        newVoteStatus = 0;
        voteChange = 1;
      } else {
        voteChange = -1 - (post.userVote || 0);
        newVoteStatus = -1;
      }
    }

    setPost({
        ...post,
        userVote: newVoteStatus,
        votes: post.votes + voteChange,
    });
    console.log('[PlaylistDetail] Vote action occurred, setting dataChanged to true.');
    setDataChanged(true);

    try {
        const userId = await getUserId();
        const headers = await getAuthHeaders();

        let response;
        if (newVoteStatus === 0) {
            response = await axios.delete(`${baseUrl}/api/votes`, { params: { postId: post.postId, userId }, headers });
        } else {
            response = await axios.post(`${baseUrl}/api/votes`, { postId: post.postId, userId: parseInt(userId), voteValue: newVoteStatus }, { headers });
        }

        // Update with authoritative data from server
        if (response.data) {
          setPost(response.data);
        }

    } catch (error) {
        // Revert UI on error
        setPost(originalPost);
        handleApiError(error, navigation);
    }
  };
  
  // Handle save/unsave
  const handleSave = async () => {
    if (!post) return;

    const originalPost = { ...post };
    // Optimistic update
    setPost({ ...post, isSaved: !post.isSaved });
    console.log('[PlaylistDetail] Save action occurred, setting dataChanged to true.');
    setDataChanged(true);
    
    try {
      const userId = await getUserId();
      const headers = await getAuthHeaders();
      
      let response;
      if (originalPost.isSaved) {
        // Unsave the post
        response = await axios.delete(`${baseUrl}/api/saved-posts`, { params: { userId: parseInt(userId), postId: post.postId }, headers });
      } else {
        // Save the post
        response = await axios.post(`${baseUrl}/api/saved-posts`, { userId: parseInt(userId), postId: post.postId }, { headers });
      }

      // Update with authoritative data from server
      if (response.data) {
        setPost(response.data);
      }

    } catch (error) {
      // Revert optimistic update on error
      setPost(originalPost);
      handleApiError(error, navigation);
    }
  };
  
  // Handle sharing
  const handleShare = async () => {
    if (!post) return;
    
    try {
      const playlistName = post.playlistName;
      const shareTitle = `${playlistName} by ${post.username}`;
      const shareMessage = `Check out ${playlistName} by ${post.username} on Charted!!!`;
      
      // Use HTTPS URL for universal links
      const shareUrl = `https://www.chartedapp.org/playlist/${postId}`;
      
      const result = await Share.share({
        title: shareTitle,
        message: shareMessage,
        url: shareUrl
      });
      
      if (result.action === Share.sharedAction) {
        console.log('Shared successfully');
      }
    } catch (error) {
      console.error('Error sharing playlist:', error);
      // No auth check needed for Share API
    }
  };

  const navigateToUserOrProfile = async (targetUsername) => {
    try {
      // Get the current user's username from SecureStore
      const currentUsername = await SecureStore.getItemAsync('username');
      
      // If the username clicked matches the current user, go to Profile
      // Otherwise go to the User screen for that username
      if (targetUsername === currentUsername) {
        navigation.navigate('ProfileStack');
      } else {
        navigation.navigate('HomeStack', { 
            screen: 'User', 
            params: { username: targetUsername }
        });
      }
    } catch (error) {
      console.error('Error in navigateToUserOrProfile:', error);
      // Default to User screen if there's an error
      navigation.navigate('HomeStack', { 
        screen: 'User', 
        params: { username: targetUsername }
      });
    }
  };

  const handlePlayPlaylist = async () => {
    if (!post) return;
    try {
          // Check for playlist URL
    const playlistUrl = post.playlistUrl;
      
      if (!playlistUrl) {
        console.log('No playlist URL available for this playlist');
        Alert.alert('Unavailable', 'This playlist cannot be opened because no URL is available.');
        return;
      }
      
      console.log('Opening playlist URL:', playlistUrl);
      
      // Record the play before opening the playlist
      try {
        const token = await SecureStore.getItemAsync('jwtToken');
        if (token) {
          await axios.post(`${baseUrl}/api/posts/${postId}/play`, {}, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Play recorded successfully for post:', postId);
        }
      } catch (playError) {
        console.error('Error recording play:', playError);
        // Continue with opening the playlist even if recording fails
      }
      
      // Check if the URL can be opened
      const canOpen = await Linking.canOpenURL(playlistUrl);
      
      if (canOpen) {
        // Open the playlist URL (will open in Apple Music app or web browser)
        await Linking.openURL(playlistUrl);
      } else {
        Alert.alert('Error', 'Unable to open this playlist. Please make sure you have the appropriate app installed.');
      }
    } catch (error) {
      console.error('Error opening playlist:', error);
      Alert.alert('Error', 'Failed to open the playlist. Please try again.');
    }
  };
  
  // Render a PlaylistCard
  const renderPlaylistCard = () => {
    if (!post) return null;
    
    return (
      <View style={styles.playlistCard}>
        {/* Card Header with playlist info */}
        <View style={styles.playlistHeader}>
          <View style={styles.coverImageContainer}>
                    {post.playlistImageUrl ? (
          <Image 
            source={{ uri: post.playlistImageUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.whitePlaceholder} />
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.playlistName}>{post.playlistName}</Text>
            <TouchableOpacity 
              onPress={() => {
                navigateToUserOrProfile(post.username);
              }}
            >
              <Text style={styles.playlistUser}>@{post.username}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Play button */}
          <TouchableOpacity 
            style={styles.playButton}
            onPress={handlePlayPlaylist}
          >
            <Ionicons name="play-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {/* Songs Container with increased height */}
        <View style={styles.songsContainer}>
          <ScrollView style={styles.songsList} nestedScrollEnabled={true}>
            {parsedTracks.map((track, idx) => (
              <View key={idx} style={styles.songItem}>
                <View style={styles.albumCoverContainer}>
                  {track.albumImageUrl ? (
                    <Image
                      source={{ uri: track.albumImageUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.whitePlaceholder} />
                  )}
                </View>
                <View style={styles.songDetails}>
                  <Text style={styles.songTitle}>{track.songTitle}</Text>
                  <Text style={styles.songArtist}>{track.songArtist}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.cardFooter}>
          <View style={styles.footerButtonsLeft}>
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => handleVote('upvote')}
            >
              <Ionicons 
                name={post.userVote === 1 ? "arrow-up" : "arrow-up-outline"} 
                size={24} 
                color={post.userVote === 1 ? "#4CAF50" : "#FFFFFF"} 
              />
            </TouchableOpacity>
            
            <Text style={[
              styles.voteCountText, 
              post.userVote === 1 ? styles.upvotedText : 
              post.userVote === -1 ? styles.downvotedText : 
              styles.neutralVoteText
            ]}>
              {post.votes}
            </Text>
            
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => handleVote('downvote')}
            >
              <Ionicons 
                name={post.userVote === -1 ? "arrow-down" : "arrow-down-outline"} 
                size={24} 
                color={post.userVote === -1 ? "#F44336" : "#FFFFFF"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => {
                navigation.navigate('Comments', { 
                  postId: postId,
                  postUsername: post.username 
                });
              }}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.footerButton}
            onPress={handleSave}
          >
            <Ionicons 
              name={post.isSaved ? "bookmark" : "bookmark-outline"} 
              size={24} 
              color={post.isSaved ? "#FFD700" : "#FFFFFF"} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Caption section */}
        <View style={styles.captionContainer}>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity 
              onPress={() => {
                navigateToUserOrProfile(post.username);
              }}
            >
              <Text style={styles.captionUsername}>@{post.username}</Text>
            </TouchableOpacity>
            {post.caption ? <Text style={styles.captionText}> {post.caption}</Text> : null}
          </View>
        </View>
      </View>
    );
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
        <Text style={styles.headerTitle}>Playlist</Text>
        <View style={styles.spacer} />
      </View>
      
      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
      >
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
              onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            >
              <Text style={styles.retryButtonText}>Go to Home</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.retryButton, { marginTop: 10 }]}
              onPress={() => navigation.reset({
                index: 0,
                routes: [{ name: 'LoginOptions' }],
              })}
            >
              <Text style={styles.retryButtonText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderPlaylistCard()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const { height } = Dimensions.get('window');

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
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  spacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: height * 0.7,
  },
  loadingText: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: height * 0.7,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
  },
  playlistCard: {
    backgroundColor: '#121212',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
    margin: 16,
    minHeight: height * 0.75, // Set a minimum height to ensure it fills most of the screen
  },
  playlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  coverImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 16,
  },
  whitePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  headerTextContainer: {
    flex: 1,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  playlistUser: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  songsContainer: {
    flex: 1,
    height: height * 0.5, // Increased height to take most of the screen
  },
  songsList: {
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
    color: '#AAAAAA',
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  captionUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  captionText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  footerButtonsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  voteCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'center',
  },
  upvotedText: {
    color: '#4CAF50',
  },
  downvotedText: {
    color: '#F44336',
  },
  neutralVoteText: {
    color: '#FFFFFF',
  },
  playButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
});

export default PlaylistDetail; 