import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
  Share,
  Alert,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackHandler } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { handleApiError, getAuthHeaders, getUserId } from '../../utils/errorUtils';

const HomeScreen = ({ navigation, route }) => {
  // Simplified state - no need for separate votes/saved states
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Keyset pagination state - updated for cursor-based pagination
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const POSTS_PER_PAGE = 5;
  
  // Add state for filter modal
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('New');
  
  // Add state for options modal
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  
  // Animation value for bottom sheet
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  // Animation value for options bottom sheet
  const optionsSheetAnim = useRef(new Animated.Value(0)).current;
  
  // Get screen dimensions for more accurate animation
  const screenHeight = Dimensions.get('window').height;
  
  // Add a ref to track component mounted state
  const isMounted = React.useRef(true);
  
  // Add a state to track if the selected post belongs to the current user
  const [isOwnPlaylist, setIsOwnPlaylist] = useState(false);
  
  // Add state for report reasons
  const [showReportReasons, setShowReportReasons] = useState(false);
  
  // Reference to the scroll view
  const scrollViewRef = useRef(null);
  
  // Base URL for API calls
  const baseUrl = 'http://10.0.0.107:8080';
  
  // Use useFocusEffect to check if we need to refresh based on route params
  useFocusEffect(
    React.useCallback(() => {
      if (isMounted.current) {
        // Check if we have a refreshData flag in the route params
        const refreshRequired = route.params?.refreshData === true;
        console.log('HomeScreen focused, refreshRequired:', refreshRequired, 'Params:', route.params);
        
        if (refreshRequired) {
          console.log('Refreshing HomeScreen data after edit/post');
          fetchPosts(selectedFilter, true);
          
          // Reset the refresh flag to prevent repeated refreshes
          navigation.setParams({ refreshData: false });
        }
      }
      
      return () => {
        // Cleanup function when screen loses focus
        console.log('HomeScreen unfocused');
      };
    }, [route.params?.refreshData, selectedFilter, navigation])
  );

  // Function to handle filter change
  const handleFilterChange = (filter) => {
    hideFilterSheet();
    // Prevent re-fetching if the filter is the same
    if (filter !== selectedFilter) {
      setSelectedFilter(filter);
      // Fetch posts with the new filter and reset pagination
      fetchPosts(filter, true);
    }
  };

  // Function to show the filter modal with animation
  const showFilterSheet = () => {
    setShowFilterModal(true);
    Animated.timing(bottomSheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };
  
  // Function to hide the filter modal with animation
  const hideFilterSheet = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setShowFilterModal(false);
      }
    });
  };

  // Function to show the options modal with animation
  const showOptionsSheet = async (postId) => {
    setSelectedPostId(postId);
    
    // Check if this playlist belongs to the current user
    const currentUsername = await SecureStore.getItemAsync('username');
    const postOwner = posts.find(post => post.postId === postId)?.username;
    
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
      }
    });
  };
  
  // Calculate the translation Y based on animation value
  const translateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  // Calculate the translation Y for options sheet
  const optionsTranslateY = optionsSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  // Use a simple useEffect to handle back button and prevent going back to login
  useEffect(() => {
    // Disable back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Return true to prevent default behavior (going back)
    });
    
    // Disable gesture navigation back to login
    navigation.setOptions({
      gestureEnabled: false,
    });
    
    return () => backHandler.remove();
  }, [navigation]);

  // Add useEffect to fetch posts when component mounts
  useEffect(() => {
    isMounted.current = true;
    // Only fetch posts if they haven't been loaded yet.
    // This prevents refreshing when the user navigates back to the screen.
    if (posts.length === 0) {
      setLoading(true);
      fetchPosts(selectedFilter, true);
    }

    return () => {
    };
  }, []);

  // UPDATED: Single request function to fetch posts with keyset pagination
  const fetchPosts = async (filter = selectedFilter, resetPagination = false) => {
    try {
      if (resetPagination) {
        setNextCursor(null);
        setHasMorePosts(true);
      } else {
        setLoadingMore(true);
      }
      
      setError(null);
      
      // Get auth headers - throws error if no token
      const headers = await getAuthHeaders();
      
      // Determine the API endpoint based on the filter
      let apiUrl = `${baseUrl}/api/posts/paginated`;
      
      // If filter is 'Following', use the feed endpoint with userId
      if (filter === 'Following') {
        const userId = await getUserId();
        apiUrl = `${baseUrl}/api/feed/${userId}/paginated`;
        console.log('Fetching following feed for user:', userId);
      } else {
        console.log('Fetching regular posts feed');
      }
      
      // Build parameters for keyset pagination
      const params = {
        limit: POSTS_PER_PAGE
      };
      
      // Add filter parameter for main feed (not for following feed)
      if (filter !== 'Following') {
        params.filter = filter;
      }
      
      // Add cursor for subsequent pages
      if (!resetPagination && nextCursor) {
        params.after = nextCursor;
      }
      
      // SINGLE OPTIMIZED REQUEST - includes netVotes, userVote, and isSaved
      const response = await axios.get(apiUrl, {
        timeout: 10000,
        headers,
        params
      });
      
      // Process the enriched response data with new keyset pagination format
      if (response.data && response.data.data && response.data.data.length > 0) {
        console.log(`Optimized GET call successful - ${filter} Posts retrieved:`, response.data.data.length);
        
        // Data is already enriched with netVotes, userVote, and isSaved
        const enrichedPosts = response.data.data.map(post => ({
          ...post,
          // Map backend field names to frontend expectations if needed
          votes: post.netVotes || 0,
          userVote: post.userVote || 0,
          isSaved: post.isSaved || false
        }));
        
        if (isMounted.current) {
          if (resetPagination) {
            // Fresh start - replace all posts
            setPosts(enrichedPosts);
          } else {
            // Pagination - append new posts and deduplicate to prevent key errors
            setPosts(prev => {
              const allPosts = [...prev, ...enrichedPosts];
              const uniquePosts = Array.from(new Map(allPosts.map(p => [p.postId, p])).values());
              return uniquePosts;
            });
          }
          
          // Update pagination state from response
          setNextCursor(response.data.nextCursor);
          setHasMorePosts(response.data.hasMore);
        }
      } else {
        // No posts returned
        if (resetPagination && isMounted.current) {
          setPosts([]);
        }
        setHasMorePosts(false);
        setNextCursor(null);
      }
    } catch (error) {
      console.log('Error fetching posts:', error);
      
      // Handle invalid cursor errors specifically
      if (error.response?.status === 400 && error.response?.data?.message?.includes('cursor')) {
        console.log('Invalid cursor detected, resetting feed');
        // Clear the feed and restart from the beginning
        setPosts([]);
        setNextCursor(null);
        setError('Feed data has been updated. Please refresh to see the latest posts.');
      } else {
        handleApiError(error, navigation);
        if (isMounted.current) {
          setError('Failed to load posts. Please try again.');
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
      }
      setRefreshing(false);
    }
  };

  // SIMPLIFIED: Load more posts function
  const loadMorePosts = async () => {
    if (!loadingMore && hasMorePosts && !loading && nextCursor) {
      console.log('Loading more posts...');
      await fetchPosts(selectedFilter, false);
    }
  };

  // Handle scroll events to detect when user reaches bottom
  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20; // How far from the bottom to trigger loading more
    
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom && !loadingMore && hasMorePosts) {
      loadMorePosts();
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts(selectedFilter, true); // Reset pagination when refreshing
  };

  // Add this helper function to check if username matches current user
  const navigateToUserOrProfile = async (targetUsername) => {
    try {
      // Get the current user's username from SecureStore
      const currentUsername = await SecureStore.getItemAsync('username');
      
      // If the username clicked matches the current user, go to Profile
      // Otherwise go to the User screen for that username
      if (targetUsername === currentUsername) {
        console.log('HomeScreen - Navigating to own Profile');
        // Navigate to the ProfileStack, which will load the main profile screen
        navigation.navigate('ProfileStack');
      } else {
        console.log(`HomeScreen - Navigating to User: ${targetUsername}`);
        navigation.navigate('User', { username: targetUsername });
      }
    } catch (error) {
      console.error('Error checking username:', error);
      // Default to User screen if there's an error
      navigation.navigate('User', { username: targetUsername });
    }
  };

  // Function to delete a playlist
  const handleDeletePlaylist = async (postId) => {
    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        console.error('Authentication token not found');
        return;
      }

      const baseUrl = 'http://10.0.0.107:8080';
      
      // Make API call to delete the playlist
      await axios.delete(`${baseUrl}/api/posts/${postId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Playlist deleted successfully');
      
      // Remove the deleted post from the posts array
      setPosts(prevPosts => prevPosts.filter(post => post.postId !== postId));
      
    } catch (error) {
      console.error('Error deleting playlist:', error);
      Alert.alert('Error', 'Failed to delete the playlist. Please try again.');
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
        
        // Update the post in the posts array
        setPosts(prevPosts => 
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

      const baseUrl = 'http://10.0.0.107:8080';
      
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

  // Render a single playlist card in feed style
  const PlaylistCard = ({ post }) => {
    // Parse the tracks JSON string into an array of track objects
    const parsedTracks = React.useMemo(() => {
      try {
        return JSON.parse(post.tracks || '[]');
      } catch (error) {
        console.error('Error parsing tracks:', error);
        return [];
      }
    }, [post.tracks]);

    // Add state for tracking upvote/downvote status
    const [voteStatus, setVoteStatus] = useState(post.userVote > 0 ? 'upvote' : post.userVote < 0 ? 'downvote' : null);
    // Add state for tracking net votes count
    const [netVotes, setNetVotes] = useState(post.votes || 0);
    // Add state for tracking saved status
    const [isSaved, setIsSaved] = useState(post.isSaved || false);

    // Handle saving/unsaving a playlist
    const handleSave = async () => {
      try {
        const userId = await getUserId();
        const headers = await getAuthHeaders();
        
        // Optimistic update
        setIsSaved(!isSaved);
        
        if (isSaved) {
          // Unsave the post
          await axios.delete(`${baseUrl}/api/saved-posts`, {
            params: {
              userId: parseInt(userId),
              postId: post.postId
            },
            headers
          });
        } else {
          // Save the post
          await axios.post(`${baseUrl}/api/saved-posts`, {
            userId: parseInt(userId),
            postId: post.postId
          }, { headers });
        }
      } catch (error) {
        // Revert optimistic update on error
        setIsSaved(!isSaved);
        handleApiError(error, navigation);
      }
    };

    // Handle voting on posts
    const handleVote = async (voteType) => {
      try {
        const userId = await getUserId();
        const headers = await getAuthHeaders();
        
        // First update UI optimistically
        const prevVoteStatus = voteStatus;
        const prevNetVotes = netVotes;
        
        // Calculate new vote status and net votes
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
        
        // Update UI state
        setVoteStatus(newVoteStatus);
        setNetVotes(prevNetVotes + voteDiff);
        
        // Prepare vote value for API
        const voteValue = newVoteStatus === 'upvote' ? 1 : newVoteStatus === 'downvote' ? -1 : 0;
        
        // Check if we're toggling off a vote
        if (voteValue === 0) {
          // Delete the vote
          await axios.delete(`${baseUrl}/api/votes`, {
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
          
          await axios.post(`${baseUrl}/api/votes`, voteData, { headers });
        }
      } catch (error) {
        // Revert UI on error
        setVoteStatus(prevVoteStatus);
        setNetVotes(prevNetVotes);
        handleApiError(error, navigation);
      }
    };

    // Handle playing a playlist (opening playlist URL)
    const handlePlayPlaylist = async () => {
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
            const baseUrl = 'http://10.0.0.107:8080';
            await axios.post(`${baseUrl}/api/posts/${post.postId}/play`, {}, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            console.log('Play recorded successfully for post:', post.postId);
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
          console.log('Cannot open playlist URL:', playlistUrl);
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
            console.log('Shared with activity type:', result.activityType);
          } else {
            // shared
            console.log('Shared successfully');
          }
        } else if (result.action === Share.dismissedAction) {
          // dismissed
          console.log('Share dismissed');
        }
      } catch (error) {
        console.error('Error sharing playlist:', error);
      }
    };
    
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
            
            {/* Net votes counter */}
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
            
            {/* Rest of the buttons remain unchanged */}
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => {
                navigation.navigate('Comments', { 
                  postId: post.postId,
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
        
        {/* Username and caption section - moved below action buttons */}
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

  // Renders the main content of the screen
  const renderContent = () => {
    if (loading && !loadingMore) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchPosts(selectedFilter, true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (posts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Follow Users to See Their Posts</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <PlaylistCard post={item} />
          </View>
        )}
        keyExtractor={(item) => item.postId.toString()}
        style={styles.feedScrollView}
        contentContainerStyle={styles.feedContainer}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={["#FFFFFF"]}
            progressBackgroundColor="#121212"
            title="Refreshing..."
            titleColor="#AAAAAA"
          />
        }
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={() => null}
        ListFooterComponent={() => {
          if (loadingMore) {
            return (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            );
          }
          return null;
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <Text style={styles.appNameText}>Charted</Text>
        
        {/* Dropdown button */}
        <TouchableOpacity 
          style={styles.dropdownButton}
          onPress={showFilterSheet}
        >
          <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.searchIconContainer}
          onPress={() => navigation.navigate('SearchStack')}
        >
          <Ionicons name="search-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* Main Feed using FlatList */}
      {renderContent()}

      {/* Filter Bottom Sheet */}
      {showFilterModal && (
        <Modal
          transparent={true}
          animationType="none"
          visible={showFilterModal}
          onRequestClose={hideFilterSheet}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={hideFilterSheet}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <Animated.View 
                style={[styles.filterBottomSheet, { transform: [{ translateY }] }]}
              >
                <View style={styles.filterHeader}>
                  <Text style={styles.filterTitle}>SORT POSTS BY</Text>
                </View>

                <TouchableOpacity 
                  style={[styles.filterOption, selectedFilter === 'New' && styles.selectedOption]}
                  onPress={() => handleFilterChange('New')}
                >
                  <Ionicons name="time-outline" size={24} color={selectedFilter === 'New' ? "#007AFF" : "#FFFFFF"} />
                  <Text style={[styles.filterOptionText, selectedFilter === 'New' && styles.selectedOptionText]}>New</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.filterOption, selectedFilter === 'Hot' && styles.selectedOption]}
                  onPress={() => handleFilterChange('Hot')}
                >
                  <Ionicons name="flame-outline" size={24} color={selectedFilter === 'Hot' ? "#007AFF" : "#FFFFFF"} />
                  <Text style={[styles.filterOptionText, selectedFilter === 'Hot' && styles.selectedOptionText]}>Hot</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.filterOption, selectedFilter === 'Following' && styles.selectedOption]}
                  onPress={() => handleFilterChange('Following')}
                >
                  <Ionicons name="people-outline" size={24} color={selectedFilter === 'Following' ? "#007AFF" : "#FFFFFF"} />
                  <Text style={[styles.filterOptionText, selectedFilter === 'Following' && styles.selectedOptionText]}>Following</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.closeButtonContainer}
                  onPress={hideFilterSheet}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Options Bottom Sheet */}
      {showOptionsModal && (
        <Modal
          transparent={true}
          animationType="none"
          visible={showOptionsModal}
          onRequestClose={hideOptionsSheet}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={hideOptionsSheet}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <Animated.View 
                style={[styles.optionsBottomSheet, { transform: [{ translateY: optionsTranslateY }] }]}
              >
                <View style={styles.handle} />
                {!showReportReasons ? (
                  <>
                    <View style={styles.optionsList}>
                      {isOwnPlaylist ? (
                        <>
                          <TouchableOpacity 
                            style={styles.optionItem}
                            onPress={() => {
                              hideOptionsSheet();
                              navigation.navigate('EditCaption', { 
                                postId: selectedPostId,
                                caption: posts.find(p => p.postId === selectedPostId)?.caption || ''
                              });
                            }}
                          >
                            <Ionicons name="pencil" size={24} color="#FFFFFF" />
                            <Text style={styles.optionText}>Edit caption</Text>
                            <View style={styles.optionRightIcon}>
                              <Ionicons name="chevron-forward" size={20} color="#777777" />
                            </View>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={styles.optionItem}
                            onPress={() => {
                              hideOptionsSheet();
                              navigation.navigate('ChangeCategories', { 
                                postId: selectedPostId,
                                categories: posts.find(p => p.postId === selectedPostId)?.categories || []
                              });
                            }}
                          >
                            <Ionicons name="pricetag" size={24} color="#FFFFFF" />
                            <Text style={styles.optionText}>Change categories</Text>
                            <View style={styles.optionRightIcon}>
                              <Ionicons name="chevron-forward" size={20} color="#777777" />
                            </View>
                          </TouchableOpacity>

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
                        </>
                      ) : (
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
                    </View>
                    <TouchableOpacity 
                      style={styles.closeButtonContainer}
                      onPress={hideOptionsSheet}
                    >
                      <Text style={styles.closeButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.reportReasonsHeader}>
                      <TouchableOpacity 
                        style={styles.backToOptionsButton}
                        onPress={handleBackToOptions}
                      >
                        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.reportReasonsTitle}>Why are you reporting this?</Text>
                      <View style={styles.headerSpacer} />
                    </View>
                    <View style={styles.reportReasonsList}>
                      <TouchableOpacity style={styles.reportReasonItem} onPress={() => handleReportReason('Inappropriate content')}>
                        <Text style={styles.reportReasonText}>Inappropriate content</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.reportReasonItem} onPress={() => handleReportReason('Spam')}>
                        <Text style={styles.reportReasonText}>Spam</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.reportReasonItem} onPress={() => handleReportReason('Hate speech')}>
                        <Text style={styles.reportReasonText}>Hate speech</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.reportReasonItem} onPress={() => handleReportReason('Other')}>
                        <Text style={styles.reportReasonText}>Other</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </Animated.View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
};

// Add these new styles
const styles = StyleSheet.create({
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
  appNameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    // Add fontFamily here if you have custom fonts
  },
  dropdownButton: {
    padding: 8,
    marginLeft: 4,
  },
  searchIconContainer: {
    padding: 8,
    marginLeft: 'auto', // This pushes the search icon to the right
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 0, // Add this line to prevent double padding
  },
  feedScrollView: {
    flex: 1,
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
  playButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 80, // Increased from 60 to 80 for taller navigation bar
    borderTopWidth: 1,
    borderTopColor: '#333333',
    backgroundColor: '#121212',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingBottom: 10, // Added padding to account for home indicator area
  },
  activeNavButton: {
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    marginBottom: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  voteCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 20, // Ensure consistent width
    textAlign: 'center',
  },
  upvotedText: {
    color: '#4CAF50', // Green color for upvoted
  },
  downvotedText: {
    color: '#F44336', // Red color for downvoted
  },
  neutralVoteText: {
    color: '#FFFFFF', // White color for neutral
  },
  // Filter Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterBottomSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingBottom: 20,
  },
  filterHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#AAAAAA',
    textAlign: 'center',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  selectedOption: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 15,
  },
  selectedOptionText: {
    color: '#007AFF',
    fontWeight: '500',
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
  rotatedIcon: {
    transform: [{ rotate: '90deg' }],
  },

  // Options Bottom Sheet Styles
  optionsBottomSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingBottom: 20,
  },
  optionsList: {
    paddingTop: 10, // Added some padding to replace the header spacing
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

export default HomeScreen;