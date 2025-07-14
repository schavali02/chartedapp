import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  Animated,
  Alert,
  Share,
  RefreshControl,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { handleApiError, getAuthHeaders, getUserId } from '../../utils/errorUtils';

const ProfileScreen = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState('playlists');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Post states
  const [userPosts, setUserPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState(null);
  
  // Keyset pagination for user posts - updated for cursor-based pagination
  const [postsNextCursor, setPostsNextCursor] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  
  // Saved posts states
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [savedError, setSavedError] = useState(null);
  
  // Keyset pagination for saved posts - updated for cursor-based pagination
  const [savedNextCursor, setSavedNextCursor] = useState(null);
  const [hasMoreSaved, setHasMoreSaved] = useState(true);
  const [loadingMoreSaved, setLoadingMoreSaved] = useState(false);
  
  // Configuration for pagination
  const PLAYLISTS_PER_PAGE = 5;
  
  // User profile states
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  
  // Add state for options modal
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  
  // Add state for playlist ownership and report reasons
  const [isOwnPlaylist, setIsOwnPlaylist] = useState(false);
  const [showReportReasons, setShowReportReasons] = useState(false);
  
  // Animation value for options bottom sheet
  const optionsSheetAnim = useRef(new Animated.Value(0)).current;
  
  // Get screen dimensions for accurate animation
  const screenHeight = Dimensions.get('window').height;
  
  // Reference to scroll views
  const scrollViewRef = useRef(null);
  
  // Base URL for API calls
  const baseUrl = 'http://10.0.0.107:8080';
  
  // Sample user profile data
  const userProfile = {
    username: "shashankc",
    displayName: "Shashank C",
    avatar: null,
    bio: "",
    stats: {
      posts: 42,
      followers: 1024,
      following: 315,
    },
  };

  useFocusEffect(
    React.useCallback(() => {
      const refreshRequired = route.params?.refreshData === true;
      console.log('ProfileScreen focused, refreshRequired:', refreshRequired, 'Params:', route.params);
      if (refreshRequired) {
        console.log('ProfileScreen focused with refresh required, refetching data.');
        // Refresh the data for the currently active tab
        if (activeTab === 'playlists') {
          fetchUserPosts(true);
        } else if (activeTab === 'saved') {
          fetchSavedPlaylists(true);
        }
        // Also refresh the user data like follower counts
        fetchUserData();
        // Reset the param to avoid re-fetching on subsequent focus events
        navigation.setParams({ refreshData: false });
      }
    }, [route.params?.refreshData, activeTab])
  );

  // Add a ref to track component mounted state
  const isMounted = React.useRef(true);

  // Update the useEffect with better logging
  useEffect(() => {
    isMounted.current = true;
    
    // Only fetch data if it hasn't been loaded yet. This prevents refreshing on every navigation.
    if (userPosts.length === 0) {
      setLoadingPosts(true);
      fetchUserPosts(true);
      fetchUserData();
    }
    
    // The previous 'focus' listener that caused re-fetching has been removed.
    // If you need to refresh data when the screen is focused in the future,
    // you can use the useFocusEffect hook from @react-navigation/native.
    
    return () => {
      isMounted.current = false;
      // Cancel any pending state updates or animations
      setLoading(false);
    };
  }, []);
  
  // Fetch saved playlists when tab changes to 'saved'
  useEffect(() => {
    if (activeTab === 'saved' && savedPlaylists.length === 0) {
      fetchSavedPlaylists(true); // Reset pagination when tab changes
    }
  }, [activeTab]);

  // Handle scroll events for playlists tab
  const handlePlaylistsScroll = (event) => {
    if (activeTab !== 'playlists') return;
    
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20; // How far from the bottom to trigger loading more
    
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom && 
        !loadingMorePosts && 
        hasMorePosts) {
      loadMoreUserPosts();
    }
  };
  
  // Handle scroll events for saved tab
  const handleSavedScroll = (event) => {
    if (activeTab !== 'saved') return;
    
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20; // How far from the bottom to trigger loading more
    
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom && 
        !loadingMoreSaved && 
        hasMoreSaved) {
      loadMoreSavedPlaylists();
    }
  };
  
  // Function to load more user posts
  const loadMoreUserPosts = () => {
    if (!loadingMorePosts && hasMorePosts && !loadingPosts && postsNextCursor) {
      fetchUserPosts(false);
    }
  };
  
  // Function to load more saved playlists
  const loadMoreSavedPlaylists = () => {
    if (!loadingMoreSaved && hasMoreSaved && !loadingSaved && savedNextCursor) {
      fetchSavedPlaylists(false);
    }
  };

  // UPDATED: Fetch user posts with keyset pagination
  const fetchUserPosts = async (resetPagination = false) => {
    try {
      if (resetPagination) {
        setPostsNextCursor(null);
        setHasMorePosts(true);
      } else {
        setLoadingMorePosts(true);
      }
      
      setError(null);
      
      const headers = await getAuthHeaders();
      const userId = await getUserId();
      
      // Build parameters for keyset pagination
      const params = {
        limit: PLAYLISTS_PER_PAGE
      };
      
      // Add cursor for subsequent pages
      if (!resetPagination && postsNextCursor) {
        params.after = postsNextCursor;
      }
      
      // SINGLE OPTIMIZED REQUEST - includes netVotes, userVote, and isSaved
      const response = await axios.get(`${baseUrl}/api/posts/user/${userId}/paginated`, {
        timeout: 10000,
        headers,
        params
      });
      
      // Check if component is still mounted before continuing
      if (!isMounted.current) return;
      
      // Process the enriched response data with new keyset pagination format
      if (response.data && response.data.data && response.data.data.length > 0) {
        // Data already includes netVotes, userVote, and isSaved
        const enrichedPosts = response.data.data.map(post => ({
          ...post,
          // Map backend field names if needed
          votes: post.netVotes || 0,
          userVote: post.userVote || 0,
          isSaved: post.isSaved || false
        }));
        
        if (isMounted.current) {
          if (resetPagination) {
            // Fresh start - replace all posts
            setUserPosts(enrichedPosts);
          } else {
            // Pagination - append new posts
            setUserPosts(prev => [...prev, ...enrichedPosts]);
          }
          
          // Update pagination state from response
          setPostsNextCursor(response.data.nextCursor);
          setHasMorePosts(response.data.hasMore);
        }
      } else {
        // No posts returned
        if (resetPagination && isMounted.current) {
          setUserPosts([]);
        }
        setHasMorePosts(false);
        setPostsNextCursor(null);
      }
    } catch (error) {
      if (isMounted.current) {
        // Handle invalid cursor errors specifically
        if (error.response?.status === 400 && error.response?.data?.message?.includes('cursor')) {
          setUserPosts([]);
          setPostsNextCursor(null);
          setError('Posts data has been updated. Please refresh to see the latest posts.');
        } else {
          handleApiError(error, navigation);
          setError('Failed to load posts. Please try again.');
        }
      }
    } finally {
      if (isMounted.current) {
        setLoadingPosts(false);
        setLoadingMorePosts(false);
      }
    }
  };
  
  // UPDATED: Fetch saved playlists with keyset pagination
  const fetchSavedPlaylists = async (resetPagination = false) => {
    try {
      if (resetPagination) {
        setLoadingSaved(true);
        setSavedNextCursor(null);
        setHasMoreSaved(true);
      } else {
        setLoadingMoreSaved(true);
      }
      
      setSavedError(null);
      
      const headers = await getAuthHeaders();
      const userId = await getUserId();
      
      // Build parameters for keyset pagination
      const params = {
        limit: PLAYLISTS_PER_PAGE,
        enriched: true  // Request enriched data if backend supports it
      };
      
      // Add cursor for subsequent pages
      if (!resetPagination && savedNextCursor) {
        params.after = savedNextCursor;
      }
      
      // SINGLE OPTIMIZED REQUEST for saved posts - should return enriched data
      const response = await axios.get(`${baseUrl}/api/saved-posts/user/${userId}/paginated`, {
        timeout: 10000,
        headers,
        params
      });
      
      // Process the response data with new keyset pagination format
      if (response.data && response.data.data && response.data.data.length > 0) {
        // If backend returns enriched saved posts directly
        let enrichedSavedPosts;
        
        if (response.data.data[0].netVotes !== undefined && response.data.data[0].netVotes !== null) {
          // Backend returns enriched data directly
          enrichedSavedPosts = response.data.data.map(post => ({
            ...post,
            votes: post.netVotes || 0,
            userVote: post.userVote || 0,
            isSaved: true // Always true for saved posts
          }));
        } else {
          // Fallback: if backend doesn't support enriched saved posts yet,
          // we fetch post details individually (temporary until backend is updated)
          enrichedSavedPosts = await Promise.all(response.data.data.map(async (savedPost) => {
            try {
              // Get the full post details with enriched data
              const postResponse = await axios.get(`${baseUrl}/api/posts/${savedPost.postId}`, { 
                headers,
                params: { enriched: true }
              });
              
              return {
                ...postResponse.data,
                votes: postResponse.data.netVotes || 0,
                userVote: postResponse.data.userVote || 0,
                isSaved: true
              };
            } catch (error) {
              console.error('Error fetching saved post details:', error);
              return null;
            }
          }));
          
          // Filter out failed requests
          enrichedSavedPosts = enrichedSavedPosts.filter(post => post !== null);
        }
        
        if (resetPagination) {
          // Fresh start - replace all saved playlists
          setSavedPlaylists(enrichedSavedPosts);
        } else {
          // Pagination - append new saved playlists  
          setSavedPlaylists(prev => [...prev, ...enrichedSavedPosts]);
        }
        
        // Update pagination state from response
        setSavedNextCursor(response.data.nextCursor);
        setHasMoreSaved(response.data.hasMore);
      } else {
        // No saved playlists returned
        if (resetPagination) {
          setSavedPlaylists([]);
        }
        setHasMoreSaved(false);
        setSavedNextCursor(null);
      }
    } catch (error) {
      // Handle invalid cursor errors specifically
      if (error.response?.status === 400 && error.response?.data?.message?.includes('cursor')) {
        setSavedPlaylists([]);
        setSavedNextCursor(null);
        setSavedError('Saved playlists data has been updated. Please refresh to see the latest posts.');
      } else {
        handleApiError(error, navigation);
        setSavedError('Failed to load saved playlists. Please try again.');
      }
    } finally {
      setLoadingSaved(false);
      setLoadingMoreSaved(false);
    }
  };

  // Function to fetch the username from SecureStore
  const fetchUserData = async () => {
    try {
      const storedUsername = await SecureStore.getItemAsync('username');
      const storedName = await SecureStore.getItemAsync('name');
      const storedBio = await SecureStore.getItemAsync('bio');
      const storedAvatarUrl = await SecureStore.getItemAsync('avatarUrl');
      
      if (storedUsername) setUsername(storedUsername);
      if (storedName) setDisplayName(storedName);
      if (storedBio) setBio(storedBio);
      if (storedAvatarUrl) setAvatarUrl(storedAvatarUrl);
      
      // Fetch follower and following counts from API
      try {
        const userId = await getUserId();
        const headers = await getAuthHeaders();
        
        // Get total followers count
        const followersResponse = await axios.get(`${baseUrl}/api/follows/followers/${userId}/total`, { headers });
        
        // Get total following count
        const followingResponse = await axios.get(`${baseUrl}/api/follows/following/${userId}/total`, { headers });
        
        // Update state with actual counts
        if (followersResponse.data !== undefined) {
          setFollowerCount(followersResponse.data);
        }
        
        if (followingResponse.data !== undefined) {
          setFollowingCount(followingResponse.data);
        }
      } catch (error) {
        // Fallback to stored counts if API fails
        const storedFollowerCount = await SecureStore.getItemAsync('followerCount');
        const storedFollowingCount = await SecureStore.getItemAsync('followingCount');
        
        setFollowerCount(storedFollowerCount ? parseInt(storedFollowerCount) : 0);
        setFollowingCount(storedFollowingCount ? parseInt(storedFollowingCount) : 0);
      }
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Silent error - user will still see the UI with default values
    }
  };

  // Function to handle logout
  const handleLogout = async () => {
    try {
      setLoading(true);
      await SecureStore.deleteItemAsync('jwtToken');
      await SecureStore.deleteItemAsync('userId');
      await SecureStore.deleteItemAsync('username');
      await SecureStore.deleteItemAsync('name');
      await SecureStore.deleteItemAsync('bio');
      await SecureStore.deleteItemAsync('avatarUrl');
      await SecureStore.deleteItemAsync('followerCount');
      await SecureStore.deleteItemAsync('followingCount');
      navigation.reset({
        index: 0,
        routes: [{ name: 'LoginOptions' }],
      });
    } catch (error) {
      // Error handling
    } finally {
      setLoading(false);
    }
  };
  
  // Function to show the options modal with animation
  const showOptionsSheet = async (postId) => {
    setSelectedPostId(postId);

    // Check if this playlist belongs to the current user
    const currentUsername = await SecureStore.getItemAsync('username');

    // Find the post in the correct list based on the active tab
    let post;
    if (activeTab === 'playlists') {
      post = userPosts.find(p => p.postId === postId);
    } else { // activeTab === 'saved'
      post = savedPlaylists.find(p => p.postId === postId);
    }
    
    const postOwner = post ? post.username : null;
    
    // Set whether this is the user's own playlist
    setIsOwnPlaylist(currentUsername === postOwner);
    
    setShowOptionsModal(true);
    Animated.timing(optionsSheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };
  
  // Function to hide the options modal with animation
  const hideOptionsSheet = () => {
    Animated.timing(optionsSheetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setShowOptionsModal(false);
        setSelectedPostId(null);
        setShowReportReasons(false);
        setIsOwnPlaylist(false);
      }
    });
  };
  
  // Calculate the translation Y for options sheet
  const optionsTranslateY = optionsSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  // Handle report playlist action - show reasons
  const handleReportPlaylist = () => {
    setShowReportReasons(true);
  };

  // Handle specific report reason selection
  const handleReportReason = async (reason) => {
    hideOptionsSheet();
    
    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        Alert.alert("Authentication Error", "Please log in to report content.");
        return;
      }

      const response = await axios.post(
        `${baseUrl}/api/reports/playlist`,
        {
          postId: selectedPostId,
          reason: reason
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.status === 201) {
        // SUCCESS!
        Alert.alert(
          "Report Submitted",
          "Thank you for helping us keep our community safe."
        );
      }
    } catch (error) {
      if (error.response) {
        // Handle backend errors
        const errorMessage = error.response.data.message || 'An unknown error occurred.';
        Alert.alert("Error", `Could not submit report: ${errorMessage}`);
      } else {
        // Handle network or other errors
        console.error("Report submission failed:", error);
        Alert.alert("Network Error", "Unable to connect to the server.");
      }
    }
  };

  // Handle going back from report reasons to main options screen
  const handleBackToOptions = () => {
    setShowReportReasons(false);
  };

  // PlaylistCard component - simplified
  const PlaylistCard = ({ post, onVote, onSave, onPostUpdate }) => {
    // Parse the tracks JSON string into an array of track objects
    const parsedTracks = React.useMemo(() => {
      try {
        return JSON.parse(post.tracks || '[]');
      } catch (error) {
        return [];
      }
    }, [post.tracks]);

    // Component now uses props for vote and save status
    const voteStatus = post.userVote > 0 ? 'upvote' : post.userVote < 0 ? 'downvote' : null;
    const netVotes = post.votes || 0;
    const isSaved = post.isSaved || false;

    // Handle saving a playlist
    const handleSave = async () => {
      const originalPost = { ...post }; // Keep a copy for error recovery
      
      try {
        const headers = await getAuthHeaders();
        const userId = await getUserId();
        
        // Optimistic update via parent
        onSave(post.postId, !isSaved);
        
        let response;
        if (!isSaved) {
          // Save the playlist
          response = await axios.post(`${baseUrl}/api/saved-posts`, {
            userId: parseInt(userId),
            postId: post.postId
          }, { headers });
        } else {
          // Unsave the playlist
          response = await axios.delete(`${baseUrl}/api/saved-posts`, {
            params: {
              userId: parseInt(userId),
              postId: post.postId
            },
            headers
          });
        }
        
        // ✅ Use server response as the single source of truth
        if (response.data) {
          onPostUpdate(response.data);
        }
      } catch (error) {
        // Revert to original state on error
        onPostUpdate(originalPost);
        handleApiError(error, navigation);
      }
    };

    // Handle voting on posts
    const handleVote = async (voteType) => {
      const originalPost = { ...post }; // Keep a copy for error recovery

      // Calculate new vote status and net votes for optimistic update
      let newVoteStatus;
      let voteDiff;

      if (voteType === 'upvote') {
        if (voteStatus === 'upvote') {
          newVoteStatus = null;
          voteDiff = -1;
        } else if (voteStatus === 'downvote') {
          newVoteStatus = 'upvote';
          voteDiff = 2;
        } else {
          newVoteStatus = 'upvote';
          voteDiff = 1;
        }
      } else { // downvote
        if (voteStatus === 'downvote') {
          newVoteStatus = null;
          voteDiff = 1;
        } else if (voteStatus === 'upvote') {
          newVoteStatus = 'downvote';
          voteDiff = -2;
        } else {
          newVoteStatus = 'downvote';
          voteDiff = -1;
        }
      }
      
      const newNetVotes = netVotes + voteDiff;
      // Optimistic update via parent
      onVote(post.postId, newVoteStatus, newNetVotes);
      
      try {
        const headers = await getAuthHeaders();
        const userId = await getUserId();
        
        // Prepare vote value for API
        const voteValue = newVoteStatus === 'upvote' ? 1 : newVoteStatus === 'downvote' ? -1 : 0;
        
        let response;
        // Check if we're toggling off a vote
        if (voteValue === 0) {
          // Delete the vote
          response = await axios.delete(`${baseUrl}/api/votes`, {
            params: {
              postId: post.postId,
              userId: parseInt(userId)
            },
            headers
          });
        } else {
          // Create or update vote
          const voteData = {
            postId: post.postId,
            userId: parseInt(userId),
            voteValue: voteValue,
            createdAt: new Date().toISOString()
          };
          
          response = await axios.post(`${baseUrl}/api/votes`, voteData, { headers });
        }
        
        // ✅ Use server response as the single source of truth
        if (response.data) {
          onPostUpdate(response.data);
        }
      } catch (error) {
        // Revert to original state on error
        onPostUpdate(originalPost);
        handleApiError(error, navigation);
      }
    };

    // Handle playing a playlist (opening playlist URL)
    const handlePlayPlaylist = async () => {
      try {
              // Check for playlist URL
      const playlistUrl = post.playlistUrl;
        
        if (!playlistUrl) {
          Alert.alert('Unavailable', 'This playlist cannot be opened because no URL is available.');
          return;
        }
        
        // Record the play before opening the playlist
        try {
          const token = await SecureStore.getItemAsync('jwtToken');
          if (token) {
            const baseUrl = 'http://10.0.0.107:8080';
            await axios.post(`${baseUrl}/api/posts/${post.postId}/play`, {}, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
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

    // Handle sharing a playlist
    const handleShare = async () => {
      try {
        const playlistName = post.playlistName;
        const shareTitle = `${playlistName} by ${post.username}`;
        const shareMessage = `Check out ${playlistName} by ${post.username} on Charted!!!`;
        
        // Use HTTPS URL for universal links
        const shareUrl = `https://www.chartedapp.org/playlist/${post.postId}`;
        
        const shareOptions = {
          title: shareTitle,
          message: shareMessage,
          url: shareUrl,
        };
        
        const result = await Share.share(shareOptions);
        
        if (result.action === Share.sharedAction) {
          if (result.activityType) {
            // shared with activity type of result.activityType
          } else {
            // shared
          }
        } else if (result.action === Share.dismissedAction) {
          // dismissed
        }
      } catch (error) {
        console.error('Error sharing playlist:', error);
      }
    };

    // Rest of the PlaylistCard component remains the same
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

        {/* Songs Container with fixed height */}
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

        {/* Action Buttons at bottom of card */}
        <View style={styles.cardFooter}>
          <View style={styles.footerButtonsLeft}>
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => handleVote('upvote')}
            >
              <Ionicons 
                name={voteStatus === 'upvote' ? "arrow-up" : "arrow-up-outline"} 
                size={24} 
                color={voteStatus === 'upvote' ? "#4CAF50" : "#FFFFFF"} 
              />
            </TouchableOpacity>
            
            <Text style={[
              styles.voteCountText, 
              voteStatus === 'upvote' ? styles.upvotedText : 
              voteStatus === 'downvote' ? styles.downvotedText : 
              styles.neutralVoteText
            ]}>
              {netVotes}
            </Text>
            
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => handleVote('downvote')}
            >
              <Ionicons 
                name={voteStatus === 'downvote' ? "arrow-down" : "arrow-down-outline"} 
                size={24} 
                color={voteStatus === 'downvote' ? "#F44336" : "#FFFFFF"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => navigation.navigate('HomeStack', { 
                screen: 'Comments',
                params: {
                  postId: post.postId,
                  postUsername: post.username
                }
              })}
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
          <View style={styles.footerButtonsRight}>
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={handleSave}
            >
              <Ionicons 
                name={isSaved ? "bookmark" : "bookmark-outline"} 
                size={24} 
                color={isSaved ? "#FFD700" : "#FFFFFF"} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => {
                // Show options modal when options button is pressed
                showOptionsSheet(post.postId);
              }}
            >
              <View style={styles.rotatedIcon}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Username and caption section */}
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
  
  // Add handleEditProfile function
  const handleEditProfile = () => {
    // In the future, this would navigate to an edit profile screen
    // For now just show an alert or navigate to settings
    navigation.navigate('Settings');
  };
  
  // Add this helper function to check if username matches current user
  const navigateToUserOrProfile = async (targetUsername) => {
    try {
      // Get the current user's username from SecureStore
      const currentUsername = await SecureStore.getItemAsync('username');
      
      // If the username clicked matches the current user, go to Profile
      // Otherwise go to the User screen for that username
      if (targetUsername === currentUsername) {
        // No need to navigate since we're already here
        return;
      } else {
        navigation.navigate('HomeStack', { 
          screen: 'User', 
          params: { username: targetUsername }
        });
      }
    } catch (error) {
      console.error('Error checking username:', error);
      // Default to User screen if there's an error
      navigation.navigate('HomeStack', { 
        screen: 'User', 
        params: { username: targetUsername }
      });
    }
  };
  
  // Add this function to fetch followers with usernames
  const fetchFollowersWithUsernames = async () => {
    try {
      const userId = await getUserId();
      const headers = await getAuthHeaders();
      
      // Get followers for the current user (user IDs)
      const followersResponse = await axios.get(`${baseUrl}/api/follows/followers/${userId}`, { headers });
      
      if (followersResponse.data && followersResponse.data.length > 0) {
        // Convert follower IDs to usernames using the new endpoint
        const followersWithUsernames = await Promise.all(followersResponse.data.map(async (follow) => {
          try {
            // Get username for this follower ID
            const usernameResponse = await axios.get(`${baseUrl}/api/users/${follow.followerId}/username`, { headers });
            return {
              id: follow.followerId,
              username: usernameResponse.data
            };
          } catch (error) {
            // If we can't get the username, return the ID as a fallback
            return {
              id: follow.followerId,
              username: `User ${follow.followerId}`
            };
          }
        }));
        
        return followersWithUsernames;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching followers with usernames:', error);
      return [];
    }
  };
  
  // Add this function to fetch following with usernames
  const fetchFollowingWithUsernames = async () => {
    try {
      const userId = await getUserId();
      const headers = await getAuthHeaders();
      
      // Get following for the current user (user IDs)
      const followingResponse = await axios.get(`${baseUrl}/api/follows/following/${userId}`, { headers });
      
      if (followingResponse.data && followingResponse.data.length > 0) {
        // Convert following IDs to usernames using the new endpoint
        const followingWithUsernames = await Promise.all(followingResponse.data.map(async (follow) => {
          try {
            // Get username for this following ID
            const usernameResponse = await axios.get(`${baseUrl}/api/users/${follow.followedId}/username`, { headers });
            return {
              id: follow.followedId,
              username: usernameResponse.data
            };
          } catch (error) {
            // If we can't get the username, return the ID as a fallback
            return {
              id: follow.followedId,
              username: `User ${follow.followedId}`
            };
          }
        }));
        
        return followingWithUsernames;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching following with usernames:', error);
      return [];
    }
  };
  
  // Function to handle deleting a playlist after confirmation
  const handleDeletePlaylist = async (postId) => {
    try {
      // Get the authentication token
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Make the API call to delete the post
      const response = await axios.delete(`${baseUrl}/api/posts/${postId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Check for the expected 204 No Content response
      if (response.status === 204) {
        console.log('Playlist deleted successfully');
        
        // Update the local state to remove the deleted post immediately
        setUserPosts(currentPosts => 
          currentPosts.filter(post => post.postId !== postId)
        );
        
        // Optionally show success message
        Alert.alert('Success', 'Playlist deleted successfully');
      }
      
    } catch (error) {
      console.error('Error deleting playlist:', error);
      
      // Handle specific error responses from the backend
      if (error.response) {
        switch (error.response.status) {
          case 401:
            Alert.alert('Error', 'You are not authorized. Please log in again.');
            break;
          case 403:
            Alert.alert('Error', 'You can only delete your own playlists.');
            break;
          case 404:
            Alert.alert('Error', 'This playlist no longer exists.');
            break;
          default:
            Alert.alert('Error', 'Failed to delete the playlist. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Network error. Please check your connection and try again.');
      }
    }
  };

  // Function to update a playlist
  const handleUpdatePlaylist = async (postId) => {
    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        console.error('Authentication token not found');
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        return;
      }

      const baseUrl = 'http://10.0.0.107:8080';
      
      // Show loading indicator or disable button here if needed
      console.log('Updating playlist...');
      
      // Make API call to update the playlist
      const response = await axios.put(`${baseUrl}/api/posts/${postId}/update`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        console.log('Playlist updated successfully');
        const updatedPost = response.data;
        
        // Update the post in the userPosts array
        setUserPosts(prevPosts => 
          prevPosts.map(post => 
            post.postId === postId ? { ...post, ...updatedPost } : post
          )
        );
        
        Alert.alert('Success', 'Playlist updated successfully!');
      }
      
    } catch (error) {
      console.error('Error updating playlist:', error);
      
      if (error.response?.status === 400) {
        Alert.alert('Error', 'Failed to update playlist. You may not have permission to update this playlist, or the original playlist may no longer exist.');
      } else if (error.response?.status === 401) {
        Alert.alert('Error', 'Authentication failed. Please log in again.');
      } else {
        Alert.alert('Error', 'Failed to update the playlist. Please try again.');
      }
    }
  };

  // Function to show the delete confirmation dialog
  const showDeleteConfirmation = (postId) => {
    Alert.alert(
      "Delete Playlist",
      "Are you sure you want to delete this playlist? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => handleDeletePlaylist(postId),
          style: "destructive"
        }
      ],
      { cancelable: false }
    );
  };
  
  // Centralized function to update post state in both lists
  // ✅ Centralized function to update a complete post object in both lists
  const updatePostInBothLists = (updatedPost) => {
    setUserPosts(prevPosts =>
      prevPosts.map(post =>
        post.postId === updatedPost.postId ? updatedPost : post
      )
    );

    setSavedPlaylists(prevPlaylists =>
      prevPlaylists.map(post =>
        post.postId === updatedPost.postId ? updatedPost : post
      )
    );
  };

  // Legacy functions for optimistic updates (kept for backward compatibility)
  const updatePostState = (postId, updates) => {
    const updateUserPosts = (posts) =>
      posts.map((post) =>
        post.postId === postId ? { ...post, ...updates } : post
      );

    const updateSavedPlaylists = (playlists) =>
      playlists.map((post) =>
        post.postId === postId ? { ...post, ...updates } : post
      );

    setUserPosts(updateUserPosts);
    setSavedPlaylists(updateSavedPlaylists);
  };

  // Centralized save handler
  const handleSaveStateChange = (postId, isSaved) => {
    updatePostState(postId, { isSaved });
    if (!isSaved && activeTab === 'saved') {
      setSavedPlaylists((prev) => prev.filter((p) => p.postId !== postId));
    }
  };

  // Centralized vote handler
  const handleVoteStateChange = (postId, newVoteStatus, newNetVotes) => {
    const userVote = newVoteStatus === 'upvote' ? 1 : newVoteStatus === 'downvote' ? -1 : 0;
    updatePostState(postId, { votes: newNetVotes, userVote });
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'playlists') {
      fetchUserPosts(true).finally(() => setRefreshing(false));
    } else {
      fetchSavedPlaylists(true).finally(() => setRefreshing(false));
    }
    fetchUserData();
  };

  // Rest of the component remains the same
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>@{username || userProfile.username}</Text>
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      
      {/* Main Content */}
      <FlatList
        data={activeTab === 'playlists' ? userPosts : savedPlaylists}
        keyExtractor={(item) => item.postId.toString()}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <PlaylistCard 
              post={item} 
              onVote={handleVoteStateChange}
              onSave={handleSaveStateChange}
              onPostUpdate={updatePostInBothLists}
            />
          </View>
        )}
        ListHeaderComponent={
          <>
            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <View style={styles.profileHeader}>
                <View style={styles.avatarContainer}>
                  {avatarUrl ? (
                    <Image 
                      source={{ uri: avatarUrl }}
                      style={styles.avatar} 
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Ionicons name="person" size={40} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.profileStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{userPosts.length}</Text>
                    <Text style={styles.statLabel}>Posts</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.statItem}
                    onPress={async () => {
                      setLoading(true);
                      try {
                        const followers = await fetchFollowersWithUsernames();
                        navigation.navigate('Follow', { 
                          initialTab: 'followers',
                          followers: followers
                        });
                      } catch (error) {
                        console.error('Error preparing followers data:', error);
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <Text style={styles.statNumber}>{followerCount}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.statItem}
                    onPress={async () => {
                      setLoading(true);
                      try {
                        const following = await fetchFollowingWithUsernames();
                        navigation.navigate('Follow', { 
                          initialTab: 'following',
                          following: following
                        });
                      } catch (error) {
                        console.error('Error preparing following data:', error);
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <Text style={styles.statNumber}>{followingCount}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <Text style={styles.displayName}>
                                {displayName || userProfile.displayName}
              </Text>
              <Text style={styles.bio}>{bio || userProfile.bio}</Text>
            </View>
            
            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'playlists' && styles.activeTab]}
                onPress={() => {
                  setActiveTab('playlists');
                }}
              >
                <Ionicons 
                  name="musical-notes" 
                  size={24} 
                  color={activeTab === 'playlists' ? "#FFFFFF" : "#AAAAAA"} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
                onPress={() => {
                  setActiveTab('saved');
                }}
              >
                <Ionicons 
                  name={activeTab === 'saved' ? "bookmark" : "bookmark-outline"}
                  size={24} 
                  color={activeTab === 'saved' ? "#FFD700" : "#AAAAAA"} 
                />
              </TouchableOpacity>
            </View>
          </>
        }
        ListFooterComponent={() => {
          const loadingMore = activeTab === 'playlists' ? loadingMorePosts : loadingMoreSaved;
          const hasMore = activeTab === 'playlists' ? hasMorePosts : hasMoreSaved;
          const data = activeTab === 'playlists' ? userPosts : savedPlaylists;

          if (loadingMore) {
            return (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            );
          }
          if (!hasMore && data.length > 0) {
            return (
              <View style={styles.noMorePostsContainer}>
                <Text style={styles.noMorePostsText}>No more {activeTab === 'playlists' ? 'playlists' : 'saved items'} to load</Text>
              </View>
            );
          }
          return <View style={{ height: 80 }} />;
        }}
        ListEmptyComponent={() => {
          const loading = activeTab === 'playlists' ? loadingPosts : loadingSaved;
          const errorState = activeTab === 'playlists' ? error : savedError;

          if (loading) {
            return (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            );
          }
          if (errorState) {
            return (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorState}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => activeTab === 'playlists' ? fetchUserPosts(true) : fetchSavedPlaylists(true)}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <View style={styles.emptyState}>
              <Ionicons name={activeTab === 'playlists' ? "musical-notes" : "bookmark"} size={48} color="#333333" />
              <Text style={styles.emptyStateText}>
                {activeTab === 'playlists' ? 'No playlists posted yet' : 'No saved playlists yet'}
              </Text>
            </View>
          );
        }}
        onEndReached={() => {
          if (activeTab === 'playlists') {
            loadMoreUserPosts();
          } else {
            loadMoreSavedPlaylists();
          }
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.feedContainer}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
      />
      
      {/* Options Bottom Sheet */}
      <Modal
        visible={showOptionsModal}
        transparent={true}
        animationType="none"
        onRequestClose={hideOptionsSheet}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={hideOptionsSheet}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View 
              style={[
                styles.optionsBottomSheet,
                { transform: [{ translateY: optionsTranslateY }] }
              ]}
            >
              {!showReportReasons ? (
                <>
                  {/* Options list */}
                  <View style={styles.optionsList}>
                    {/* Show these options only if it's the user's own playlist */}
                    {isOwnPlaylist && (
                      <>
                        {/* Edit caption option */}
                        <TouchableOpacity 
                          style={styles.optionItem}
                          onPress={() => {
                            hideOptionsSheet();
                            navigation.navigate('EditCaption', { 
                              postId: selectedPostId,
                              caption: (userPosts.find(p => p.postId === selectedPostId) || savedPlaylists.find(p => p.postId === selectedPostId))?.caption || ''
                            });
                          }}
                        >
                          <Ionicons name="pencil" size={24} color="#FFFFFF" />
                          <Text style={styles.optionText}>Edit caption</Text>
                          <View style={styles.optionRightIcon}>
                            <Ionicons name="chevron-forward" size={20} color="#777777" />
                          </View>
                        </TouchableOpacity>
                        
                        {/* Change categories option */}
                        <TouchableOpacity 
                          style={styles.optionItem}
                          onPress={() => {
                            hideOptionsSheet();
                            navigation.navigate('ChangeCategories', { 
                              postId: selectedPostId,
                              categories: (userPosts.find(p => p.postId === selectedPostId) || savedPlaylists.find(p => p.postId === selectedPostId))?.categories || []
                            });
                          }}
                        >
                          <Ionicons name="pricetag" size={24} color="#FFFFFF" />
                          <Text style={styles.optionText}>Change categories</Text>
                          <View style={styles.optionRightIcon}>
                            <Ionicons name="chevron-forward" size={20} color="#777777" />
                          </View>
                        </TouchableOpacity>
                        
                        {/* Update playlist option */}
                        <TouchableOpacity 
                          style={styles.optionItem}
                          onPress={() => {
                            hideOptionsSheet();
                            handleUpdatePlaylist(selectedPostId);
                          }}
                        >
                          <Ionicons name="refresh" size={24} color="#FFFFFF" />
                          <Text style={styles.optionText}>Update playlist</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    
                    {/* Report playlist option - shown for other people's playlists */}
                    {!isOwnPlaylist && (
                      <TouchableOpacity 
                        style={styles.optionItem}
                        onPress={handleReportPlaylist}
                      >
                        <Ionicons name="flag-outline" size={24} color="#FFA500" />
                        <Text style={[styles.optionText, styles.reportText]}>Report playlist</Text>
                        <View style={styles.optionRightIcon}>
                          <Ionicons name="chevron-forward" size={20} color="#777777" />
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {/* Delete playlist option - only for own playlists */}
                    {isOwnPlaylist && (
                      <TouchableOpacity 
                        style={[styles.optionItem, styles.deleteOption]}
                        onPress={() => {
                          hideOptionsSheet();
                          showDeleteConfirmation(selectedPostId);
                        }}
                      >
                        <Ionicons name="trash" size={24} color="#FF3B30" />
                        <Text style={[styles.optionText, styles.deleteText]}>Delete playlist</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* Close button at bottom */}
                  <TouchableOpacity 
                    style={styles.closeButtonContainer}
                    onPress={hideOptionsSheet}
                  >
                    <Text style={styles.closeButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Report reasons screen
                <>
                  {/* Header with back button */}
                  <View style={styles.reportReasonsHeader}>
                    <TouchableOpacity 
                      style={styles.backToOptionsButton}
                      onPress={handleBackToOptions}
                    >
                      <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.reportReasonsTitle}>Why are you reporting this playlist?</Text>
                    <View style={styles.headerSpacer} />
                  </View>

                  {/* Report reasons list */}
                  <View style={styles.reportReasonsList}>
                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Inappropriate content or explicit material')}
                    >
                      <Text style={styles.reportReasonText}>Inappropriate content or explicit material</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Misleading playlist information')}
                    >
                      <Text style={styles.reportReasonText}>Misleading playlist information</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Spam or promotional content')}
                    >
                      <Text style={styles.reportReasonText}>Spam or promotional content</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Offensive playlist name or description')}
                    >
                      <Text style={styles.reportReasonText}>Offensive playlist name or description</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Low quality or irrelevant content')}
                    >
                      <Text style={styles.reportReasonText}>Low quality or irrelevant content</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Copying another user\'s playlist')}
                    >
                      <Text style={styles.reportReasonText}>Copying another user's playlist</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Other')}
                    >
                      <Text style={styles.reportReasonText}>Other</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// Styles remain the same
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingsButton: {
    padding: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  scrollView: {
    flex: 1,
  },
  profileInfo: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginRight: 24,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333',
  },
  profileStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  feedContainer: {
    padding: 16,
    paddingBottom: 80, // Extra padding at bottom to account for nav bar
  },
  cardWrapper: {
    marginBottom: 16,
  },
  playlistCard: {
    backgroundColor: '#121212',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
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
  headerTextContainer: {
    flex: 1,
  },
  playButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whitePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
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
    height: 250, // Fixed height for songs container
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
    gap: 12, // Reduced from 16 to make buttons closer together
    alignItems: 'center',
  },
  footerButtonsRight: {
    flexDirection: 'row',
    gap: 12, // Same gap as footerButtonsLeft
    alignItems: 'center',
  },
  footerButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,  // No padding at top to remove space after buttons
    paddingBottom: 12,  // Keep some padding at bottom
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
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  emptyStateText: {
    color: '#AAAAAA',
    fontSize: 16,
    marginTop: 16,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 80,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    backgroundColor: '#121212',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingBottom: 10,
  },
  activeNavButton: {
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
  },
  rotatedIcon: {
    transform: [{ rotate: '90deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  closeButtonContainer: {
    marginTop: 10,
    marginHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  optionsBottomSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingBottom: 20,
  },
  optionsList: {
    paddingTop: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  optionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 15,
    flex: 1,
  },
  optionRightIcon: {
    marginLeft: 10,
  },
  deleteOption: {
    borderBottomWidth: 0,
  },
  deleteText: {
    color: '#FF3B30',
  },
  reportText: {
    color: '#FFA500', // Orange color for report text
  },
  loadingMoreContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMorePostsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMorePostsText: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  reportReasonsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backToOptionsButton: {
    padding: 8,
    marginLeft: 4,
  },
  reportReasonsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  reportReasonsList: {
    paddingVertical: 8,
  },
  reportReasonItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  reportReasonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});

export default ProfileScreen;