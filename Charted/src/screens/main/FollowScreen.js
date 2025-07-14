import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const FollowScreen = ({ navigation, route }) => {
  // Get params from route
  const { username, initialTab = 'followers', followers: followersProp, following: followingProp } = route.params || {};
  
  // State variables
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [profileUserId, setProfileUserId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  
  // Base URL for API calls
  const baseUrl = 'http://10.0.0.107:8080';
  
  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('jwtToken');
    if (!token) throw new Error('Authentication token not found');
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };
  
  // Reference to track mounted state
  const isMounted = React.useRef(true);
  
  // Setup on mount and cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    
    // Load necessary data
    loadUserData();
    
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Load user ID and followers/following data
  const loadUserData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current user ID
      const userId = await SecureStore.getItemAsync('userId');
      if (userId && isMounted.current) {
        setCurrentUserId(parseInt(userId));
      }
      
      // Check if we have followers/following data from props
      if (followersProp && followingProp) {
        // Use the pre-fetched data with usernames
        if (isMounted.current) {
          processFollowData(followersProp, followingProp);
          setLoading(false);
        }
        return;
      }
      
      // If no pre-fetched data, get user ID for the profile we're viewing
      if (username) {
        const headers = await getAuthHeaders();
        try {
          const userIdResponse = await axios.get(`${baseUrl}/api/users/username/${username}/id`, { headers });
          if (userIdResponse.data && isMounted.current) {
            setProfileUserId(userIdResponse.data);
            
            // Now fetch followers and following
            fetchFollowData(userIdResponse.data);
          } 
        } catch (error) {
          if (isMounted.current) {
            setError('Failed to load user data');
            setLoading(false);
          }
        }
      } else {
        // If no username provided, use current user's ID
        if (userId && isMounted.current) {
          setProfileUserId(parseInt(userId));
          fetchFollowData(parseInt(userId));
        }
      }
    } catch (error) {
      if (isMounted.current) {
        setError('Failed to load user data');
        setLoading(false);
      }
    }
  };
  
  // Process pre-fetched followers and following data from props
  const processFollowData = (followersList, followingList) => {
    if (!isMounted.current) return;
    
    // Format pre-fetched followers list
    const formattedFollowers = followersList.map(user => ({
      id: user.id,
      userId: user.id,
      username: user.username,
      isFollowing: false // We'll check this separately
    }));
    
    // Format pre-fetched following list
    const formattedFollowing = followingList.map(user => ({
      id: user.id,
      userId: user.id,
      username: user.username,
      isFollowing: true // By definition, we're following these users
    }));
    
    setFollowers(formattedFollowers);
    setFollowersCount(formattedFollowers.length);
    
    setFollowing(formattedFollowing);
    setFollowingCount(formattedFollowing.length);
    
    // Check which followers you're also following
    checkFollowStatus(formattedFollowers);
  };
  
  // Fetch followers and following data
  const fetchFollowData = async (userId) => {
    try {
      const headers = await getAuthHeaders();
      
      // Fetch followers
      const followersResponse = await axios.get(`${baseUrl}/api/follows/followers/${userId}`, { headers });
      
      // Fetch following
      const followingResponse = await axios.get(`${baseUrl}/api/follows/following/${userId}`, { headers });
      
      if (isMounted.current) {
        // Transform the data
        const followersWithUsernames = await Promise.all(followersResponse.data.map(async (follow) => {
          try {
            // Get username for this follower ID
            const usernameResponse = await axios.get(`${baseUrl}/api/users/${follow.followerId}/username`, { headers });
            return {
              id: follow.id,
              userId: follow.followerId,
              username: usernameResponse.data,
              isFollowing: false // Will be updated in checkFollowStatus
            };
          } catch (error) {
            // If we can't get the username, use ID as fallback
            return {
              id: follow.id,
              userId: follow.followerId,
              username: `User ${follow.followerId}`,
              isFollowing: false
            };
          }
        }));
        
        const followingWithUsernames = await Promise.all(followingResponse.data.map(async (follow) => {
          try {
            // Get username for this following ID
            const usernameResponse = await axios.get(`${baseUrl}/api/users/${follow.followedId}/username`, { headers });
            return {
              id: follow.id,
              userId: follow.followedId,
              username: usernameResponse.data,
              isFollowing: true // Since we are following these users
            };
          } catch (error) {
            // If we can't get the username, use ID as fallback
            return {
              id: follow.id,
              userId: follow.followedId,
              username: `User ${follow.followedId}`,
              isFollowing: true
            };
          }
        }));
        
        setFollowers(followersWithUsernames);
        setFollowersCount(followersWithUsernames.length);
        
        setFollowing(followingWithUsernames);
        setFollowingCount(followingWithUsernames.length);
        
        // Check which followers you're also following (for the Follow Back button)
        checkFollowStatus(followersWithUsernames);
      }
    } catch (error) {
      if (isMounted.current) {
        setError('Failed to load follow data');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };
  
  // Check which users the current user is following
  const checkFollowStatus = async (users) => {
    try {
      const headers = await getAuthHeaders();
      
      // Get list of users that current user is following
      const followingResponse = await axios.get(`${baseUrl}/api/follows/following/${currentUserId}`, { headers });
      
      // Create a Set of user IDs the current user is following for efficient lookup
      const followingSet = new Set(followingResponse.data.map(follow => follow.followedId));
      
      // Update the followers array with isFollowing flag
      const updatedFollowers = users.map(user => ({
        ...user,
        isFollowing: followingSet.has(user.userId)
      }));
      
      if (isMounted.current) {
        setFollowers(updatedFollowers);
      }
    } catch (error) {
      // Silent fail - we'll show all followers with "Follow" button as fallback
    }
  };
  
  // User Item component
  const UserItem = ({ user }) => {
    return (
      <TouchableOpacity 
        style={styles.userItem}
        activeOpacity={0.7}
        onPress={() => {
          // Navigate to the UserScreen passing the username
          navigation.navigate('User', { username: user.username });
        }}
      >
        <View style={styles.userInfoContainer}>
          <Text style={styles.usernameText}>@{user.username}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#777777" />
      </TouchableOpacity>
    );
  };
  
  // We're removing the follow/unfollow functionality from this screen
  // But keeping the function signature for now to avoid breaking other code
  const handleFollowAction = async (userId, isCurrentlyFollowing) => {
    // This function is no longer used
    console.log('Follow/unfollow actions have been removed from this screen');
  };
  
  // Render the screen
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
        <Text style={styles.headerTitle}>{username || 'Your Profile'}</Text>
        <View style={styles.spacer} />
      </View>
      
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
          onPress={() => setActiveTab('followers')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'followers' && styles.activeTabText
          ]}>
            {followersCount} Followers
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'following' && styles.activeTab]}
          onPress={() => setActiveTab('following')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'following' && styles.activeTabText
          ]}>
            {followingCount} Following
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchFollowData(profileUserId)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {activeTab === 'followers' ? (
            followers.length > 0 ? (
              <FlatList
                data={followers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <UserItem 
                    user={item}
                  />
                )}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No followers yet</Text>
              </View>
            )
          ) : (
            following.length > 0 ? (
              <FlatList
                data={following}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <UserItem user={item} />}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Not following anyone yet</Text>
              </View>
            )
          )}
        </View>
      )}
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
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 16,
    color: '#AAAAAA',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  userInfoContainer: {
    flex: 1,
  },
  usernameText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: '#AAAAAA',
    fontSize: 16,
  },
});

export default FollowScreen; 