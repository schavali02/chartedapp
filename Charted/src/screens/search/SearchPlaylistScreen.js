import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView,
  TextInput,
  Image,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Base URL for API calls
const BASE_URL = 'http://10.0.0.107:8080';

const SearchPlaylistScreen = ({ route, navigation }) => {
  // Get search query from route params if available
  const { query } = route.params || { query: '' };
  
  // State for filter modal
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('Best');
  
  // State for playlists data
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Animation value for bottom sheet
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  
  // Get screen dimensions for more accurate animation
  const screenHeight = Dimensions.get('window').height;
  
  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const token = await SecureStore.getItemAsync('jwtToken');
    if (!token) throw new Error('Authentication token not found');
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };
  
  // Fetch playlists from API when component mounts or query changes
  useEffect(() => {
    const fetchPlaylists = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const headers = await getAuthHeaders();
        const response = await axios.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, { headers });
        
        // Validate the response structure
        if (response.data && Array.isArray(response.data.playlists)) {
          setPlaylists(response.data.playlists);
        } else {
          setError('Invalid response format from server.');
          setPlaylists([]);
        }
      } catch (error) {
        console.error('Search playlists error:', error);
        setError('Failed to fetch playlists. Please try again.');
        setPlaylists([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPlaylists();
  }, [query]);
  
  // Apply selected filter to playlists
  const applyFilter = (filterType) => {
    setSelectedFilter(filterType);
    setIsLoading(true);
    
    // This would ideally be an API call with filter parameters
    // For now, we'll simulate filtering by sorting the current data
    setTimeout(() => {
      let filteredPlaylists = [...playlists];
      
      switch (filterType) {
        case 'Hot':
          // In a real implementation, this would be server-side
          // For now, just randomize to simulate
          filteredPlaylists.sort(() => Math.random() - 0.5);
          break;
        case 'New':
          // Normally this would sort by creation date
          // For mockup purposes, just shuffle
          filteredPlaylists.sort(() => Math.random() - 0.5);
          break;
        case 'Top':
          // Normally sort by votes/rating
          // For mockup purposes, just shuffle
          filteredPlaylists.sort(() => Math.random() - 0.5);
          break;
        case 'Controversial':
          // Normally this would be determined by server algorithm
          // For mockup purposes, just shuffle
          filteredPlaylists.sort(() => Math.random() - 0.5);
          break;
        default:
          // Default behavior, no sort
          break;
      }
      
      setPlaylists(filteredPlaylists);
      setIsLoading(false);
    }, 500); // Simulate network delay
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
  
  // Calculate the translation Y based on animation value
  const translateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  // Render a playlist item
  const renderPlaylistItem = (item) => (
    <TouchableOpacity 
      key={item.postId || item.id}
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
        <Text style={styles.mediaSubtitle}>{item.username || item.author}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#777777" />
    </TouchableOpacity>
  );

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
        <Text style={styles.appNameText}>Playlists{query ? ': ' + query : ''}</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={showFilterSheet}
        >
          <Ionicons name="filter" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Playlists List */}
      <FlatList
        data={playlists}
        keyExtractor={(item) => (item.postId || item.id).toString()}
        renderItem={({ item }) => renderPlaylistItem(item)}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={() => {
          if (isLoading) {
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
                  onPress={() => {
                    setIsLoading(true);
                    // Re-trigger the useEffect
                    const fetchPlaylists = async () => {
                      try {
                        const headers = await getAuthHeaders();
                        const response = await axios.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, { headers });
                        
                        if (response.data && Array.isArray(response.data.playlists)) {
                          setPlaylists(response.data.playlists);
                          setError(null);
                        } else {
                          setError('Invalid response format from server.');
                          setPlaylists([]);
                        }
                      } catch (error) {
                        console.error('Search playlists error:', error);
                        setError('Failed to fetch playlists. Please try again.');
                        setPlaylists([]);
                      } finally {
                        setIsLoading(false);
                      }
                    };
                    
                    fetchPlaylists();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            );
          }
          if (playlists.length === 0) {
            return (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{query ? `No playlists found for "${query}"` : "No playlists found"}</Text>
              </View>
            );
          }
          return null;
        }}
        showsVerticalScrollIndicator={true}
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
                  applyFilter('Hot');
                  hideFilterSheet();
                }}
              >
                <Ionicons name="flame-outline" size={24} color={selectedFilter === 'Hot' ? "#007AFF" : "#FFFFFF"} />
                <Text style={[styles.filterOptionText, selectedFilter === 'Hot' && styles.selectedOptionText]}>Hot</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterOption, selectedFilter === 'New' && styles.selectedOption]}
                onPress={() => {
                  applyFilter('New');
                  hideFilterSheet();
                }}
              >
                <Ionicons name="time-outline" size={24} color={selectedFilter === 'New' ? "#007AFF" : "#FFFFFF"} />
                <Text style={[styles.filterOptionText, selectedFilter === 'New' && styles.selectedOptionText]}>New</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterOption, selectedFilter === 'Top' && styles.selectedOption]}
                onPress={() => {
                  applyFilter('Top');
                  hideFilterSheet();
                }}
              >
                <Ionicons name="arrow-up-outline" size={24} color={selectedFilter === 'Top' ? "#007AFF" : "#FFFFFF"} />
                <Text style={[styles.filterOptionText, selectedFilter === 'Top' && styles.selectedOptionText]}>Top</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterOption, selectedFilter === 'Controversial' && styles.selectedOption]}
                onPress={() => {
                  applyFilter('Controversial');
                  hideFilterSheet();
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
  // Loading, Error, and Empty states
  loadingContainer: {
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
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    marginBottom: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
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
});

export default SearchPlaylistScreen; 