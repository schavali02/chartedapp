import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Share,
  Alert,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

const UserScreen = ({ navigation, route }) => {
  // Get the username from route params
  const { username: usernameParam } = route.params || {};
  
  const [activeTab, setActiveTab] = useState('playlists');
  const [loading, setLoading] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userProfileData, setUserProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  
  // New state variables for follow functionality
  const [profileUserId, setProfileUserId] = useState(null);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followError, setFollowError] = useState(null);
  
  // Base URL for API calls
  const baseUrl = 'http://10.0.0.107:8080';
  
  // Sample user profile data (will be replaced with actual data from API)
  const userProfile = {
    username: usernameParam || "user",
    displayName: usernameParam || "User",
    avatar: null,
    bio: "",
    stats: {
      posts: 0,
      followers: 0,
      following: 0,
    },
  };

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('jwtToken');
    if (!token) throw new Error('Authentication token not found');
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };
  
  // Helper function to get user ID
  const getUserId = async () => {
    const userId = await SecureStore.getItemAsync('userId');
    if (!userId) throw new Error('User ID not found');
    return userId;
  };

  // Add a ref to track component mounted state
  const isMounted = React.useRef(true);

  useFocusEffect(
    React.useCallback(() => {
      const refreshRequired = route.params?.refreshData === true;
      if (refreshRequired) {
        console.log('UserScreen focused with refresh required, refetching data.');
        if (profileUserId) {
          fetchUserPosts(); // Re-fetch user posts
        }
        // Also refresh the user data like follower/following status
        fetchUserProfile();
        // Reset the param to avoid re-fetching on subsequent focus events
        navigation.setParams({ refreshData: false });
      }
    }, [route.params?.refreshData, profileUserId])
  );

  // Fetch user posts when component mounts
  useEffect(() => {
    isMounted.current = true;
    
    if (usernameParam) {
      // First fetch the profile to get the user ID, then fetch posts
      fetchUserProfile();
    }
    
    // The focus listener for refreshing has been replaced by useFocusEffect above.
    // This reduces redundant data fetching on every focus event.
    
    return () => {
      isMounted.current = false;
      // Cancel any pending state updates or animations
      setLoading(false);
    };
  }, [navigation, usernameParam]);

  // Fetch posts when profileUserId becomes available
  useEffect(() => {
    if (profileUserId) {
      fetchUserPosts();
    }
  }, [profileUserId]);

  // Check initial follow status when profileUserId is available
  useEffect(() => {
    if (!profileUserId) return;
    
    const checkInitialFollow = async () => {
      try {
        const currentUserId = await getUserId();
        const headers = await getAuthHeaders();
        
        // Get users that the current user is following
        const response = await axios.get(`${baseUrl}/api/follows/following/${currentUserId}`, { headers });
        
        // Check if the profile user is in the list of followed users
        const isMatchFound = response.data.some(follow => follow.followedId === profileUserId);
        
        if (isMounted.current) {
          setIsFollowing(isMatchFound);
        }
      } catch (error) {
        if (isMounted.current) {
          // Silent failure, don't show error to user for this background check
        }
      }
    };
    
    checkInitialFollow();
  }, [profileUserId]);

  // Function to fetch user posts from backend
  const fetchUserPosts = async () => {
    try {
      setLoadingPosts(true);
      setError(null);
      
      const headers = await getAuthHeaders();
      
      // We need the user ID for the paginated endpoint
      if (!profileUserId) {
        // If we don't have the profile user ID yet, we can't fetch posts
        // This should not happen since fetchUserProfile runs first
        throw new Error('Profile user ID not available');
      }
      
      // Use the new paginated endpoint that returns enriched data
      const response = await axios.get(`${baseUrl}/api/posts/user/${profileUserId}/paginated`, {
        timeout: 10000,
        headers,
        params: {
          limit: 50 // Fetch up to 50 posts at once
          // No 'after' parameter for initial load
        }
      });
      
      // Process the response data from the new paginated format
      if (response.data && response.data.data && response.data.data.length > 0) {
        // The new endpoint returns enriched data directly
        const enrichedPosts = response.data.data.map(post => ({
          ...post,
          votes: post.netVotes || 0, // Map netVotes to votes for consistency
          // userVote and isSaved are already included in the response
        }));
        
        // Only update state if component is still mounted
        if (isMounted.current) {
          setUserPosts(enrichedPosts);
          // Update user profile stats with actual post count
          if (userProfileData) {
            setUserProfileData({
              ...userProfileData,
              stats: {
                ...userProfileData.stats,
                posts: enrichedPosts.length
              }
            });
          }
        }
      } else {
        if (isMounted.current) {
          setUserPosts([]);
        }
      }
    } catch (error) {
      if (isMounted.current) {
        let errorMessage = 'Failed to load posts. ';
        if (error.code === 'ECONNABORTED') {
          errorMessage += 'Request timed out. Please check your connection.';
        } else if (!error.response) {
          errorMessage += 'Cannot reach the server.';
        } else {
          errorMessage += error.message || 'Please try again.';
        }
        setError(errorMessage);
        setUserPosts([]);
      }
    } finally {
      if (isMounted.current) {
        setLoadingPosts(false);
      }
    }
  };
  
  // Function to handle follow/unfollow
  const handleFollow = async () => {
    // Set loading state and clear any previous errors
    setIsFollowLoading(true);
    setFollowError(null);
    
    // Check if we have the profile user ID
    if (!profileUserId) {
      setFollowError('Cannot follow/unfollow: Profile user ID not loaded.');
      setIsFollowLoading(false);
      return;
    }
    
    try {
      const currentUserId = await getUserId();
      const headers = await getAuthHeaders();
      
      if (isFollowing) {
        // Unfollow: DELETE request
        await axios.delete(`${baseUrl}/api/follows`, {
          params: {
            followerId: parseInt(currentUserId),
            followedId: profileUserId
          },
          headers
        });
        
        // Update state after successful API call
        if (isMounted.current) {
          setIsFollowing(false);
          
          // Update follower count
          try {
            // Get updated followers count
            const followersResponse = await axios.get(`${baseUrl}/api/follows/followers/${profileUserId}/total`, { headers });
            
            // Update the userProfileData with the new count
            if (userProfileData && userProfileData.stats) {
              const updatedStats = {
                ...userProfileData.stats,
                followers: followersResponse.data || Math.max(0, userProfileData.stats.followers - 1)
              };
              setUserProfileData({
                ...userProfileData,
                stats: updatedStats
              });
            }
          } catch (countError) {
            // Fallback to decrementing existing count if API call fails
            if (userProfileData && userProfileData.stats) {
              const updatedStats = {
                ...userProfileData.stats,
                followers: Math.max(0, userProfileData.stats.followers - 1)
              };
              setUserProfileData({
                ...userProfileData,
                stats: updatedStats
              });
            }
          }
        }
      } else {
        // Follow: POST request
        const body = {
          followerId: parseInt(currentUserId),
          followedId: profileUserId
        };
        
        await axios.post(`${baseUrl}/api/follows`, body, { headers });
        
        // Update state after successful API call
        if (isMounted.current) {
          setIsFollowing(true);
          
          // Update follower count
          try {
            // Get updated followers count
            const followersResponse = await axios.get(`${baseUrl}/api/follows/followers/${profileUserId}/total`, { headers });
            
            // Update the userProfileData with the new count
            if (userProfileData && userProfileData.stats) {
              const updatedStats = {
                ...userProfileData.stats,
                followers: followersResponse.data || userProfileData.stats.followers + 1
              };
              setUserProfileData({
                ...userProfileData,
                stats: updatedStats
              });
            }
          } catch (countError) {
            // Fallback to incrementing existing count if API call fails
            if (userProfileData && userProfileData.stats) {
              const updatedStats = {
                ...userProfileData.stats,
                followers: userProfileData.stats.followers + 1
              };
              setUserProfileData({
                ...userProfileData,
                stats: updatedStats
              });
            }
          }
        }
      }
    } catch (error) {
      if (isMounted.current) {
        let errorMessage = 'Failed to update follow status. ';
        if (error.code === 'ECONNABORTED') {
          errorMessage += 'Request timed out.';
        } else if (!error.response) {
          errorMessage += 'Cannot reach the server.';
        } else {
          errorMessage += error.message || 'Please try again.';
        }
        setFollowError(errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setIsFollowLoading(false);
      }
    }
  };
  
  // PlaylistCard component - full implementation
  const PlaylistCard = ({ post }) => {
    // Parse the tracks JSON string into an array of track objects
    const parsedTracks = React.useMemo(() => {
      try {
        return JSON.parse(post.tracks || '[]');
      } catch (error) {
        return []; // Return empty array on parsing error
      }
    }, [post.tracks]);

    // Add state for tracking upvote/downvote status
    const [voteStatus, setVoteStatus] = useState(
      post.userVote > 0 ? 'upvote' : post.userVote < 0 ? 'downvote' : null
    );
    // Add state for tracking net votes count
    const [netVotes, setNetVotes] = useState(post.netVotes || post.votes || 0);
    // Add state for tracking saved status
    const [isSaved, setIsSaved] = useState(post.isSaved || false);

    // Handle saving a playlist
    const handleSave = async () => {
      try {
        const userId = await getUserId();
        const headers = await getAuthHeaders();
        
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
          }, {
            headers: {
              ...headers
            }
          });
        }
        setIsSaved(!isSaved);
      } catch (error) {
        // Revert UI state if there's an error
        setIsSaved(prev => !prev);
      }
    };

    // Handle upvote action
    const handleUpvote = async () => {
      try {
        const userId = await getUserId();
        const headers = await getAuthHeaders();
        
        if (voteStatus === 'upvote') {
          // If already upvoted, remove the upvote
          await axios.delete(`${baseUrl}/api/votes`, {
            params: {
              postId: post.postId,
              userId: parseInt(userId)
            },
            headers
          });
          
          setVoteStatus(null);
          setNetVotes(netVotes - 1); // Decrease net votes by 1
        } else {
          // Prepare vote data
          const voteData = {
            postId: post.postId,
            userId: parseInt(userId),
            voteValue: 1 // 1 for upvote
          };
          
          // Make API call to cast vote
          await axios.post(`${baseUrl}/api/votes`, voteData, {
            headers
          });
          
          if (voteStatus === 'downvote') {
            // If previously downvoted, change to upvote
            setVoteStatus('upvote');
            setNetVotes(netVotes + 2); // Increase net votes by 2 (remove -1 and add +1)
          } else {
            // Set to upvoted
            setVoteStatus('upvote');
            setNetVotes(netVotes + 1); // Increase net votes by 1
          }
        }
      } catch (error) {
        // Handle error silently - could implement a more user-friendly approach
      }
    };

    // Handle downvote action
    const handleDownvote = async () => {
      try {
        const userId = await getUserId();
        const headers = await getAuthHeaders();
        
        if (voteStatus === 'downvote') {
          // If already downvoted, remove the downvote
          await axios.delete(`${baseUrl}/api/votes`, {
            params: {
              postId: post.postId,
              userId: parseInt(userId)
            },
            headers
          });
          
          setVoteStatus(null);
          setNetVotes(netVotes + 1); // Increase net votes by 1
        } else {
          // Prepare vote data
          const voteData = {
            postId: post.postId,
            userId: parseInt(userId),
            voteValue: -1 // -1 for downvote
          };
          
          // Make API call to cast vote
          await axios.post(`${baseUrl}/api/votes`, voteData, {
            headers
          });
          
          if (voteStatus === 'upvote') {
            // If previously upvoted, change to downvote
            setVoteStatus('downvote');
            setNetVotes(netVotes - 2); // Decrease net votes by 2 (remove +1 and add -1)
          } else {
            // Set to downvoted
            setVoteStatus('downvote');
            setNetVotes(netVotes - 1); // Decrease net votes by 1
          }
        }
      } catch (error) {
        // Handle error silently - could implement a more user-friendly approach
      }
    };

    // Handle sharing a playlist
    const handleShare = async () => {
      try {
        const shareTitle = `${post.playlistName} by @${post.username}`;
        const shareMessage = `Check out ${post.playlistName} by @${post.username} on Charted!!!`;
        
        // Use HTTPS URL for universal links
        const shareUrl = `https://www.chartedapp.org/playlist/${post.postId}`;
        
        const shareOptions = {
          title: shareTitle,
          message: shareMessage,
          url: shareUrl,
        };
        
        await Share.share(shareOptions);
      } catch (error) {
        console.error('Error sharing playlist:', error);
        Alert.alert("Error", "Could not share this playlist.");
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
                // No need to navigate to self
              }}
            >
              <Text style={styles.playlistUser}>@{post.username}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Play button */}
          <TouchableOpacity 
            style={styles.playButton}
            onPress={() => {
              // You can add your own player here
            }}
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
              onPress={handleUpvote}
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
              onPress={handleDownvote}
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
                  postId: post.postId,
                  postUsername: post.username 
                });
              }}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
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
        </View>
        
        {/* Username and caption section */}
        <View style={styles.captionContainer}>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity 
              onPress={() => {
                // No need to navigate to self
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
  
  // Modify the navigation methods
  const handleBackPress = () => {
    navigation.goBack();
  };
  
  // Add new function to fetch user profile data
  const fetchUserProfile = async () => {
    try {
      setLoadingProfile(true);
      setProfileError(null);
      
      const headers = await getAuthHeaders();
      
      // First fetch the user ID from the username
      try {
        const userIdResponse = await axios.get(`${baseUrl}/api/users/username/${usernameParam}/id`, { headers });
        
        if (userIdResponse.data) {
          const userId = userIdResponse.data;
          setProfileUserId(userId);
          
          // Now fetch the follower and following counts
          try {
            // Get total followers count
            const followersResponse = await axios.get(`${baseUrl}/api/follows/followers/${userId}/total`, { headers });
            
            // Get total following count
            const followingResponse = await axios.get(`${baseUrl}/api/follows/following/${userId}/total`, { headers });
            
            // Get user profile data (in a real app, this would be a dedicated endpoint)
            // For now, we'll create a placeholder profile with the username and actual counts
            const profileData = {
              username: usernameParam,
              displayName: usernameParam, // In a real app, you'd get the actual display name
              bio: "",
              avatar: null,
              stats: {
                posts: 0, // This will be updated when posts are loaded
                followers: followersResponse.data || 0,
                following: followingResponse.data || 0
              }
            };
            
            if (isMounted.current) {
              setUserProfileData(profileData);
            }
          } catch (countError) {
            // If we can't get counts, still create the profile but with zero counts
            const profileData = {
              username: usernameParam,
              displayName: usernameParam,
              bio: "",
              avatar: null,
              stats: {
                posts: 0,
                followers: 0,
                following: 0
              }
            };
            
            if (isMounted.current) {
              setUserProfileData(profileData);
              setProfileError('Failed to load follower information');
            }
          }
        } else {
          throw new Error('User ID not found');
        }
      } catch (idError) {
        // Handle the error but continue with other profile data
        setProfileError('Failed to fetch user ID. Some features may be limited.');
        
        // Use default profile data with empty stats
        const profileData = {
          username: usernameParam,
          displayName: usernameParam,
          bio: "",
          avatar: null,
          stats: {
            posts: 0,
            followers: 0,
            following: 0
          }
        };
        
        if (isMounted.current) {
          setUserProfileData(profileData);
        }
      }
    } catch (error) {
      if (isMounted.current) {
        setProfileError('Failed to load user profile.');
      }
    } finally {
      if (isMounted.current) {
        setLoadingProfile(false);
      }
    }
  };
  
  // Add this function to fetch followers with usernames
  const fetchFollowersWithUsernames = async () => {
    try {
      const headers = await getAuthHeaders();
      
      if (!profileUserId) {
        throw new Error('Profile user ID not found');
      }
      
      // Get followers for this profile (user IDs)
      const followersResponse = await axios.get(`${baseUrl}/api/follows/followers/${profileUserId}`, { headers });
      
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
      const headers = await getAuthHeaders();
      
      if (!profileUserId) {
        throw new Error('Profile user ID not found');
      }
      
      // Get following for this profile (user IDs)
      const followingResponse = await axios.get(`${baseUrl}/api/follows/following/${profileUserId}`, { headers });
      
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
        <Text style={styles.headerTitle}>@{usernameParam}</Text>
        <View style={styles.spacer} />
      </View>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      
      {/* Main Content using FlatList */}
      <FlatList
        data={userPosts}
        keyExtractor={(item) => item.postId.toString()}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <PlaylistCard post={item} />
          </View>
        )}
        ListHeaderComponent={
          <>
            {/* Profile Section */}
            <View style={styles.profileInfo}>
              <View style={styles.profileHeader}>
                <View style={styles.avatarContainer}>
                  {userProfileData?.avatar ? (
                    <Image 
                      source={{ uri: userProfileData.avatar }} 
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
                      if (!profileUserId) {
                        console.error('Cannot fetch followers: Profile user ID not loaded');
                        return;
                      }
                      
                      setLoading(true);
                      try {
                        const followers = await fetchFollowersWithUsernames();
                        navigation.navigate('Follow', { 
                          username: usernameParam,
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
                    <Text style={styles.statNumber}>{userProfileData?.stats.followers || userProfile.stats.followers}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.statItem}
                    onPress={async () => {
                      if (!profileUserId) {
                        console.error('Cannot fetch following: Profile user ID not loaded');
                        return;
                      }
                      
                      setLoading(true);
                      try {
                        const following = await fetchFollowingWithUsernames();
                        navigation.navigate('Follow', { 
                          username: usernameParam,
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
                    <Text style={styles.statNumber}>{userProfileData?.stats.following || userProfile.stats.following}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <Text style={styles.displayName}>{userProfileData?.displayName || userProfile.displayName}</Text>
              <Text style={styles.bio}>{userProfileData?.bio || userProfile.bio}</Text>
              
              {/* Follow Button */}
              <TouchableOpacity 
                style={[
                  styles.followButton,
                  isFollowing ? styles.followingButton : null
                ]}
                onPress={handleFollow}
                disabled={isFollowLoading}
              >
                {isFollowLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.followButtonText,
                    isFollowing ? styles.followingButtonText : null
                  ]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
              
              {/* Follow Error Message */}
              {followError ? (
                <Text style={styles.errorText}>{followError}</Text>
              ) : null}
              
              {/* Tabs */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'playlists' && styles.activeTab]}
                  onPress={() => setActiveTab('playlists')}
                >
                  <Ionicons 
                    name="musical-notes" 
                    size={24} 
                    color={activeTab === 'playlists' ? "#FFFFFF" : "#AAAAAA"} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={() => {
          if (loadingPosts) {
            return (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            );
          }
          if (error) {
            return (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={fetchUserPosts}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes" size={48} color="#333333" />
              <Text style={styles.emptyStateText}>No playlists posted yet</Text>
            </View>
          );
        }}
        contentContainerStyle={styles.feedContainer}
        showsVerticalScrollIndicator={true}
      />
    </SafeAreaView>
  );
};

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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: 28,
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
  followButton: {
    backgroundColor: '#007AFF',
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  followingButton: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#333333',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  followingButtonText: {
    color: '#FFFFFF',
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
    paddingBottom: 80,
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
  playButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songsContainer: {
    height: 250,
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
    gap: 16,
    alignItems: 'center',
  },
  footerButton: {
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
  captionContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  captionUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  captionText: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default UserScreen; 