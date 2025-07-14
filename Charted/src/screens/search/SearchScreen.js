import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Image,
  FlatList,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Base URL for API calls
const BASE_URL = 'http://10.0.0.107:8080';

// Get screen dimensions for responsive layout
const { width } = Dimensions.get('window');
const itemWidth = (width - 48) / 2; // 2 columns with 16px padding on sides and 16px gap

const SearchScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ playlists: [], users: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Updated category data structure with 12 items each
  const categories = [
    {
      title: "Genre",
      items: [
        { name: "Classical", image: null },
        { name: "Hip-Hop/Rap", image: null },
        { name: "Rock", image: null },
        { name: "Pop", image: null },
        { name: "K-Pop", image: null },
        { name: "R&B/Soul", image: null },
        { name: "Latin", image: null },
        { name: "Soundtrack", image: null },
        { name: "Electronic", image: null },
        { name: "Jazz", image: null },
        { name: "Country", image: null },
        { name: "Metal", image: null },
      ],
    },
    {
      title: "Activity",
      items: [
        { name: "Summer", image: null },
        { name: "Fitness", image: null },
        { name: "Travel", image: null },
        { name: "Driving", image: null },
        { name: "Party", image: null },
        { name: "Running", image: null },
        { name: "Yoga", image: null },
        { name: "Focus", image: null },
        { name: "Gaming", image: null },
        { name: "Worship", image: null },
        { name: "Cooking", image: null },
        { name: "Studying", image: null },
      ],
    },
    {
      title: "Mood",
      items: [
        { name: "Happy", image: null },
        { name: "Chill", image: null },
        { name: "Energetic", image: null },
        { name: "Romantic", image: null },
        { name: "Sad", image: null },
        { name: "Inspirational", image: null },
        { name: "Relaxing", image: null },
        { name: "Nostalgic", image: null },
        { name: "Angry", image: null },
        { name: "Dreamy", image: null },
        { name: "Confident", image: null },
        { name: "Melancholic", image: null },
      ],
    },
  ];

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('jwtToken');
    if (!token) throw new Error('Authentication token not found');
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout if query changes quickly
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim() !== '') {
        fetchSearchResults(searchQuery);
      } else {
        // Clear results if query is empty
        setSearchResults({ playlists: [], users: [] });
        setError(null); // Clear any previous error
      }
    }, 300); // 300ms debounce delay

    // Cleanup function to clear timeout on unmount or query change
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]); // Re-run effect when searchQuery changes

  // Function to fetch search results from API
  const fetchSearchResults = async (query) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, { headers });
      
      // Validate the response structure
      if (response.data && 
          (Array.isArray(response.data.playlists) || Array.isArray(response.data.users))) {
        setSearchResults(response.data);
      } else {
        setError('Invalid response format from server.');
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to fetch search results. Please try again.');
      setSearchResults({ playlists: [], users: [] });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle navigation
  const navigateTo = (screenName) => {
    navigation.navigate(screenName);
  };

  // Render a category item
  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.categoryItem}
      onPress={() => console.log(`Selected category: ${item.name}`)}
    >
      <View style={styles.categoryImageContainer}>
        {/* Using a placeholder view instead of an image for simplicity */}
        <View style={styles.categoryImagePlaceholder} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.categoryGradient}
        >
          <Text style={styles.categoryName}>{item.name}</Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  // Render a category section with title and horizontally scrollable grid with two rows that scroll together
  // Update the renderCategorySection function to navigate to CategoryResults
  const renderCategorySection = (category, index) => {
    return (
      <View key={index} style={styles.categorySection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{category.title}</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {/* Single ScrollView containing both rows */}
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalCategoryList}
        >
          <View>
            {/* First row */}
            <View style={styles.categoryRow}>
              {category.items.slice(0, 6).map((item, idx) => (
                <TouchableOpacity 
                  key={`${category.title}-row1-${idx}`}
                  style={styles.categoryItem}
                  onPress={() => navigation.navigate('CategoryResults', { categoryName: item.name })}
                >
                  <View style={styles.categoryImageContainer}>
                    <View style={styles.categoryImagePlaceholder} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={styles.categoryGradient}
                    >
                      <Text style={styles.categoryName}>{item.name}</Text>
                    </LinearGradient>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Second row */}
            <View style={styles.categoryRow}>
              {category.items.slice(6, 12).map((item, idx) => (
                <TouchableOpacity 
                  key={`${category.title}-row2-${idx}`}
                  style={styles.categoryItem}
                  onPress={() => navigation.navigate('CategoryResults', { categoryName: item.name })}
                >
                  <View style={styles.categoryImageContainer}>
                    <View style={styles.categoryImagePlaceholder} />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={styles.categoryGradient}
                    >
                      <Text style={styles.categoryName}>{item.name}</Text>
                    </LinearGradient>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render a search result item for playlists
  const renderMediaItem = (item, type) => (
    <TouchableOpacity 
      style={styles.searchResultItem}
      onPress={() => navigation.navigate('PlaylistDetail', { postId: item.postId })}
    >
      <View style={styles.mediaImageContainer}>
        {item.playlistImageUrl ? (
          <Image 
            source={{ uri: item.playlistImageUrl }} 
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mediaImagePlaceholder} />
        )}
      </View>
      <View style={styles.mediaInfoContainer}>
        <Text style={styles.mediaTitle}>{item.playlistName || item.name}</Text>
        <Text style={styles.mediaSubtitle}>
          {item.username || item.author}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#777777" />
    </TouchableOpacity>
  );

  // Render a search result item for users
  const renderUserItem = (user) => (
    <TouchableOpacity 
      style={styles.searchResultItem}
      onPress={() => navigation.navigate('User', { username: user.username })}
    >
      <View style={styles.userInfoContainer}>
        <Text style={styles.usernameText}>@{user.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#777777" />
    </TouchableOpacity>
  );

  // Determine whether to show search results or categories
  const showSearchResults = searchQuery.length > 0;

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
        <Text style={styles.appNameText}>Search</Text>
        <View style={styles.spacer} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#AAAAAA" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Users, Songs, Artists, and Albums"
          placeholderTextColor="#AAAAAA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#AAAAAA" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results / Categories */}
      {showSearchResults ? (
        <ScrollView style={styles.scrollView}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : searchResults.playlists.length === 0 && searchResults.users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results found for "{searchQuery}"</Text>
            </View>
          ) : (
            <>
              {/* Playlists Section */}
              {searchResults.playlists.length > 0 && (
                <View style={styles.searchResultSection}>
                  <Text style={styles.searchResultSectionTitle}>Playlists</Text>
                  {searchResults.playlists.slice(0, 5).map((item) => (
                    <View key={item.postId || item.id}>
                      {renderMediaItem(item, 'playlists')}
                    </View>
                  ))}
                  {searchResults.playlists.length > 5 && (
                    <TouchableOpacity 
                      style={styles.viewAllButton}
                      onPress={() => navigation.navigate('SearchPlaylist', { query: searchQuery })}
                    >
                      <Text style={styles.viewAllText}>View all playlists</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Users Section */}
              {searchResults.users.length > 0 && (
                <View style={styles.searchResultSection}>
                  <Text style={styles.searchResultSectionTitle}>Users</Text>
                  {searchResults.users.slice(0, 5).map((user) => (
                    <View key={user.userId || user.id}>
                      {renderUserItem(user)}
                    </View>
                  ))}
                  {searchResults.users.length > 5 && (
                    <TouchableOpacity 
                      style={styles.viewAllButton}
                      onPress={() => navigation.navigate('SearchUser', { query: searchQuery })}
                    >
                      <Text style={styles.viewAllText}>View all users</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        /* Categories ScrollView - Show when no search */
        <ScrollView style={styles.scrollView}>
          <View style={styles.categoriesContainer}>
            {categories.map(renderCategorySection)}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 0,
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
  spacer: {
    width: 32, // Same width as back button for balanced spacing
  },
  appNameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1, // This helps center the text
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#FFFFFF',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  categoriesContainer: {
    padding: 16,
    paddingBottom: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  seeAllText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  horizontalCategoryList: {
    paddingRight: 16, // Add padding to the right for the last item
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 16, // Space between rows
  },
  categoryItem: {
    width: itemWidth,
    marginRight: 16, // Add spacing between items
  },
  categoryImageContainer: {
    width: '100%',
    height: itemWidth * 0.75, // 4:3 aspect ratio
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  categoryImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333', // Dark gray placeholder
  },
  categoryGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // Search Results Styles
  searchResultsContainer: {
    flex: 1,
  },
  searchResultSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  searchResultSectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
    height: 74, // Fixed height for all items
  },
  mediaImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 16,
  },
  mediaImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF', // White placeholder as requested
  },
  mediaInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  mediaTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  mediaSubtitle: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  userInfoContainer: {
    flex: 1,
    paddingLeft: 16,
  },
  usernameText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  viewAllButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  // Loading and Error states
  loadingContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#AAAAAA',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SearchScreen;