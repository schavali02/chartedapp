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
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { handleApiError, getAuthHeaders, getUserId } from '../../utils/errorUtils';

const CategoryResultsScreen = ({ route, navigation }) => {
  // Get the category name from route params
  const { categoryName } = route.params || { categoryName: 'Category' };
  
  // Simplified state - no need for separate allPlaylists array
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Keyset pagination state - updated for cursor-based pagination
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMorePlaylists, setHasMorePlaylists] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PLAYLISTS_PER_PAGE = 5;
  
  // Add state for filter modal
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('New');
  
  // Add state for options modal
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  
  // Animation value for bottom sheet
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  // Animation value for options sheet
  const optionsSheetAnim = useRef(new Animated.Value(0)).current;
  
  // Get screen dimensions for more accurate animation
  const screenHeight = Dimensions.get('window').height;
  
  // Reference to the scroll view
  const scrollViewRef = useRef(null);
  
  // Add state for report reasons
  const [showReportReasons, setShowReportReasons] = useState(false);
  
  // Add useFocusEffect to refresh the screen when returning from other screens
  useFocusEffect(
    React.useCallback(() => {
      fetchPlaylists(selectedFilter, true);
      return () => {
        // Cleanup function when screen loses focus
      };
    }, [categoryName, selectedFilter])
  );
  
  // Base URL for API calls
  const baseUrl = 'http://10.0.0.107:8080';

  // UPDATED: Single request function to fetch playlists with keyset pagination
  const fetchPlaylists = async (filter = selectedFilter, resetPagination = false) => {
    try {
      if (resetPagination) {
        setLoading(true);
        setNextCursor(null);
        setHasMorePlaylists(true);
      } else {
        setLoadingMore(true);
      }
      
      setError(null);
      
      // Get auth headers
      const headers = await getAuthHeaders();
      
      // Use the single paginated endpoint for all category filters
      const apiUrl = `${baseUrl}/api/posts/category/paginated`;
      
      console.log(`Fetching playlists with filter: ${filter}, URL: ${apiUrl}`);
      
      // Build parameters for keyset pagination
      const params = {
        category: categoryName,
        limit: PLAYLISTS_PER_PAGE,
        filter: filter
      };
      
      // Add cursor for subsequent pages
      if (!resetPagination && nextCursor) {
        params.after = nextCursor;
      }
      
      // SINGLE OPTIMIZED REQUEST - includes netVotes, userVote, and isSaved
      const response = await axios.get(apiUrl, {
        timeout: 10000,
        params,
        headers
      });
      
      // Process the enriched response data with new keyset pagination format
      if (response.data && response.data.data && response.data.data.length > 0) {
        console.log(`Optimized playlists fetch successful - ${filter} Posts retrieved:`, response.data.data.length);
        
        // Transform backend data to UI format with enriched fields
        const processedPlaylists = response.data.data.map(post => {
          // Parse tracks from JSON string to array
          let parsedTracks = [];
          try {
            parsedTracks = JSON.parse(post.tracks || '[]');
          } catch (e) {
            console.error('Error parsing tracks JSON:', e);
          }
          
          // Parse category JSON string to get categories array
          let categories = [];
          try {
            const categoryObj = JSON.parse(post.category || '{}');
            categories = categoryObj.categories || [];
          } catch (e) {
            console.error('Error parsing category JSON:', e);
          }

          return {
            postId: post.postId,
            name: post.playlistName,
            user: `@${post.username}`,
            coverImage: post.playlistImageUrl,
            songs: parsedTracks.map(track => ({
              title: track.songTitle,
              artist: track.songArtist,
              albumCover: track.albumImageUrl
            })),
            description: post.caption,
            length: `${parsedTracks.length} songs`,
            categories: categories,
            // Use enriched fields from optimized backend
            votes: post.netVotes || 0,
            userVote: post.userVote || 0,
            isSaved: post.isSaved || false,
            // Preserve URL fields for play functionality
      
            playlistUrl: post.playlistUrl
          };
        });
        
        if (resetPagination) {
          // Fresh start - replace all playlists
          setPlaylists(processedPlaylists);
        } else {
          // Pagination - append new playlists and deduplicate to prevent key errors
          setPlaylists(prev => {
            const allPlaylists = [...prev, ...processedPlaylists];
            const uniquePlaylists = Array.from(new Map(allPlaylists.map(p => [p.postId, p])).values());
            return uniquePlaylists;
          });
        }
        
        // Update pagination state from response
        setNextCursor(response.data.nextCursor);
        setHasMorePlaylists(response.data.hasMore);
      } else {
        // No playlists returned
        if (resetPagination) {
          setPlaylists([]);
        }
        setHasMorePlaylists(false);
        setNextCursor(null);
      }
    } catch (error) {
      console.log('Error fetching playlists by category:', error);
      
      // Handle invalid cursor errors specifically
      if (error.response?.status === 400 && error.response?.data?.message?.includes('cursor')) {
        console.log('Invalid cursor detected, resetting category playlists');
        setPlaylists([]);
        setNextCursor(null);
        setError('Category data has been updated. Please refresh to see the latest playlists.');
      } else {
        handleApiError(error, navigation);
        setError('Failed to load playlists. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
    
  // SIMPLIFIED: Handle loading more playlists when reaching the end of the list
  const loadMorePlaylists = () => {
    if (!loadingMore && hasMorePlaylists && !loading && nextCursor) {
      console.log('Loading more playlists...');
      fetchPlaylists(selectedFilter, false);
    }
  };
  
  // Handle scroll events to detect when user reaches bottom
  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20; // How far from the bottom to trigger loading more
    
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom && !loadingMore && hasMorePlaylists) {
      loadMorePlaylists();
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
  
  // Add a state to track if the selected post belongs to the current user
  const [isOwnPlaylist, setIsOwnPlaylist] = useState(false);
  
  // Function to show the options modal with animation
  const showOptionsSheet = async (postId) => {
    setSelectedPostId(postId);
    
    // Check if this playlist belongs to the current user
    const currentUsername = await SecureStore.getItemAsync('username');
    const playlist = playlists.find(p => p.postId === postId);
    const postOwner = playlist ? playlist.user.substring(1) : null; // Remove @ symbol
    
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
  // Use a larger value to ensure complete offscreen movement
  const translateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });
  
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

  // Function to handle deleting a playlist after confirmation
  const handleDeletePlaylist = async (postId) => {
    console.log(`Confirmed deletion for playlist ID: ${postId}`);
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
        setPlaylists(currentPlaylists => 
          currentPlaylists.filter(playlist => playlist.postId !== postId)
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
        
        // Update the post in the playlists array
        setPlaylists(prevPlaylists => 
          prevPlaylists.map(playlist => 
            playlist.postId === postId ? { ...playlist, ...updatedPost } : playlist
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

  // Render a single playlist card
  const PlaylistCard = ({ playlist }) => {
    // Parse the tracks JSON string into an array of track objects
    const parsedTracks = React.useMemo(() => {
      try {
        return playlist.songs || [];
      } catch (error) {
        console.error('Error parsing tracks:', error);
        return [];
      }
    }, [playlist.songs]);

    // Add state for tracking upvote/downvote status
    const [voteStatus, setVoteStatus] = useState(playlist.userVote > 0 ? 'upvote' : playlist.userVote < 0 ? 'downvote' : null);
    // Add state for tracking net votes count
    const [netVotes, setNetVotes] = useState(playlist.votes || 0);
    // Add state for tracking saved status
    const [isSaved, setIsSaved] = useState(playlist.isSaved || false);

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
              postId: playlist.postId
            },
            headers
          });
        } else {
          // Save the post
          await axios.post(`${baseUrl}/api/saved-posts`, {
            userId: parseInt(userId),
            postId: playlist.postId
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
              postId: playlist.postId,
              userId: parseInt(userId)
            },
            headers
          });
        } else {
          // Create or update vote
          const voteData = {
            postId: playlist.postId,
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
    const playlistUrl = playlist.playlistUrl;
        
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
            await axios.post(`${baseUrl}/api/posts/${playlist.postId}/play`, {}, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            console.log('Play recorded successfully for post:', playlist.postId);
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
        const shareTitle = `${playlist.name} by ${playlist.user}`;
        const shareMessage = `Check out ${playlist.name} by ${playlist.user} on Charted!!!`;
        
        // Use HTTPS URL for universal links
        const shareUrl = `https://www.chartedapp.org/playlist/${playlist.postId}`;
        
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
    
    // Add a helper function to check if username matches current user and navigate
    const navigateToUserOrProfile = async (targetUsername) => {
      try {
        // Get the current user's username from SecureStore
        const currentUsername = await SecureStore.getItemAsync('username');
        
        // If the username clicked matches the current user, go to Profile
        // Otherwise go to the User screen for that username
        if (targetUsername === currentUsername) {
          navigation.navigate('ProfileStack');
        } else {
          navigation.navigate('User', { username: targetUsername });
        }
      } catch (error) {
        console.error('Error in navigateToUserOrProfile:', error);
        // Default to User screen if there's an error
        navigation.navigate('User', { username: targetUsername });
      }
    };
    
    return (
      <View style={styles.playlistCard}>
        {/* Card Header with playlist info */}
        <View style={styles.playlistHeader}>
          <View style={styles.coverImageContainer}>
            {playlist.coverImage ? (
            <Image
                source={{ uri: playlist.coverImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            ) : (
              <View style={styles.whitePlaceholder} />
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.playlistName}>{playlist.name}</Text>
            <TouchableOpacity 
              onPress={() => {
                navigateToUserOrProfile(playlist.user.substring(1)); // Remove @ symbol
              }}
            >
            <Text style={styles.playlistUser}>{playlist.user}</Text>
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
            {parsedTracks && parsedTracks.length > 0 ? (
              parsedTracks.map((song, idx) => (
              <View key={idx} style={styles.songItem}>
                <View style={styles.albumCoverContainer}>
                    {song.albumCover ? (
                  <Image
                        source={{ uri: song.albumCover }}
                    style={{ width: '100%', height: '100%' }}
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
              ))
            ) : (
              <Text style={styles.noSongsText}>No songs available</Text>
            )}
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
            
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => {
                navigation.navigate('Comments', {
                  postId: playlist.postId,
                  postUsername: playlist.user.substring(1) // Remove @ symbol
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
                showOptionsSheet(playlist.postId);
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
                navigateToUserOrProfile(playlist.user.substring(1)); // Remove @ symbol
              }}
            >
            <Text style={styles.captionUsername}>{playlist.user}</Text>
            </TouchableOpacity>
            {playlist.description ? <Text style={styles.captionText}> {playlist.description}</Text> : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.appNameText}>{categoryName}</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={showFilterSheet}
        >
          <Ionicons name="filter" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* Main Content */}
      <FlatList
        data={playlists}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <PlaylistCard playlist={item} />
          </View>
        )}
        keyExtractor={(item) => item.postId.toString()}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        onEndReached={loadMorePlaylists}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={() => {
          if (loading && !loadingMore) {
            return (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Loading playlists...</Text>
              </View>
            );
          }
          if (error) {
            return (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => fetchPlaylists(selectedFilter, true)}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            );
          }
          if (playlists.length === 0) {
            return (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No playlists found for {categoryName}</Text>
              </View>
            );
          }
          return null;
        }}
        ListFooterComponent={() => {
          if (loadingMore) {
            return (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            );
          }
          if (!hasMorePlaylists && playlists.length > 0) {
            return (
              <View style={styles.noMorePlaylistsContainer}>
                <Text style={styles.noMorePlaylistsText}>No more playlists to load</Text>
              </View>
            );
          }
          return null;
        }}
      />
      
      {/* Filter Bottom Sheet */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="none"
        onRequestClose={hideFilterSheet}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={hideFilterSheet}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View 
              style={[
                styles.filterBottomSheet,
                { transform: [{ translateY }] }
              ]}
            >
              <View style={styles.filterHeader}>
                <Text style={styles.filterTitle}>SORT PLAYLISTS BY</Text>
              </View>
              
              {/* Filter Options */}
              <TouchableOpacity 
                style={[styles.filterOption, selectedFilter === 'Hot' && styles.selectedOption]}
                onPress={() => {
                  setSelectedFilter('Hot');
                  hideFilterSheet();
                  fetchPlaylists('Hot');
                }}
              >
                <Ionicons name="flame-outline" size={24} color={selectedFilter === 'Hot' ? "#007AFF" : "#FFFFFF"} />
                <Text style={[styles.filterOptionText, selectedFilter === 'Hot' && styles.selectedOptionText]}>Hot</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterOption, selectedFilter === 'New' && styles.selectedOption]}
                onPress={() => {
                  setSelectedFilter('New');
                  hideFilterSheet();
                  fetchPlaylists('New');
                }}
              >
                <Ionicons name="time-outline" size={24} color={selectedFilter === 'New' ? "#007AFF" : "#FFFFFF"} />
                <Text style={[styles.filterOptionText, selectedFilter === 'New' && styles.selectedOptionText]}>New</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterOption, selectedFilter === 'Top' && styles.selectedOption]}
                onPress={() => {
                  setSelectedFilter('Top');
                  hideFilterSheet();
                  fetchPlaylists('Top');
                }}
              >
                <Ionicons name="arrow-up-outline" size={24} color={selectedFilter === 'Top' ? "#007AFF" : "#FFFFFF"} />
                <Text style={[styles.filterOptionText, selectedFilter === 'Top' && styles.selectedOptionText]}>Top</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterOption, selectedFilter === 'Controversial' && styles.selectedOption]}
                onPress={() => {
                  setSelectedFilter('Controversial');
                  hideFilterSheet();
                  fetchPlaylists('Controversial');
                }}
              >
                <Ionicons name="flash-outline" size={24} color={selectedFilter === 'Controversial' ? "#007AFF" : "#FFFFFF"} />
                <Text style={[styles.filterOptionText, selectedFilter === 'Controversial' && styles.selectedOptionText]}>Controversial</Text>
              </TouchableOpacity>
              
              {/* Close button at bottom */}
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
                            // Handle edit caption action
                            console.log('Edit caption pressed');
                            // Navigate to Edit Caption screen
                            navigation.navigate('EditCaption', { 
                              postId: selectedPostId,
                              caption: playlists.find(playlist => playlist.postId === selectedPostId)?.description || ''
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
                            // Handle change categories action
                            console.log('Change categories pressed');
                            // Navigate to Change Categories screen
                            navigation.navigate('ChangeCategories', { 
                              postId: selectedPostId,
                              categories: playlists.find(playlist => playlist.postId === selectedPostId)?.categories || []
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
                            // Handle update playlist action
                            console.log('Update playlist pressed');
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
                          // Show confirmation dialog before deleting
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
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
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appNameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
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
  playButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  noSongsText: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
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
  noMorePlaylistsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMorePlaylistsText: {
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

export default CategoryResultsScreen;