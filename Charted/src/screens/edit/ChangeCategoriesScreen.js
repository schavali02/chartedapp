import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const BASE_URL = 'http://10.0.0.107:8080';

// Get screen dimensions for responsive layout
const { width } = Dimensions.get('window');
const itemSize = (width - 48) / 2; // 2 columns with padding

// Predefined categories organized by type (matches PostCategoryScreen)
const genreCategories = [
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
];

// Activities
const activityCategories = [
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
];

// Moods
const moodCategories = [
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
];

// Combined categories
const categorySections = [
  { title: "Genre", items: genreCategories },
  { title: "Activity", items: activityCategories },
  { title: "Mood", items: moodCategories },
];

const ChangeCategoriesScreen = ({ route, navigation }) => {
  // Get post ID and current categories from route params
  const { postId, categories: initialCategories = [] } = route.params || {};
  
  // State for categories, post data and loading status
  const [selectedCategories, setSelectedCategories] = useState(
    Array.isArray(initialCategories) ? initialCategories : []
  );
  const [postData, setPostData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Maximum number of categories that can be selected
  const MAX_SELECTIONS = 3;
  
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
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const headers = await getAuthHeaders();
        
        // Fetch post data
        const response = await axios.get(`${BASE_URL}/api/posts/${postId}`, {
          headers
        });
        
        if (response.data) {
          setPostData(response.data);
          
          // Parse and set categories if they exist
          if (response.data.category) {
            try {
              const categoryObj = JSON.parse(response.data.category);
              const postCategories = categoryObj.categories || [];
              setSelectedCategories(postCategories);
              console.log('Loaded categories:', postCategories);
            } catch (e) {
              console.error('Error parsing categories:', e);
              // If initial categories were provided in route params, use those instead
              if (Array.isArray(initialCategories) && initialCategories.length > 0) {
                setSelectedCategories(initialCategories);
              } else {
                setSelectedCategories([]);
              }
            }
          } else if (Array.isArray(initialCategories) && initialCategories.length > 0) {
            // Fallback to route params if no categories in post data
            setSelectedCategories(initialCategories);
          }
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('Error fetching post details:', error);
        setError('Failed to load post details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPostDetails();
  }, [postId, initialCategories]);
  
  // Toggle category selection
  const toggleCategory = (categoryName) => {
    if (selectedCategories.includes(categoryName)) {
      // Deselect if already selected
      setSelectedCategories(selectedCategories.filter(name => name !== categoryName));
    } else if (selectedCategories.length < MAX_SELECTIONS) {
      // Select if under the maximum
      setSelectedCategories([...selectedCategories, categoryName]);
    } else {
      Alert.alert(
        'Maximum Categories',
        `You can select up to ${MAX_SELECTIONS} categories for a playlist.`,
        [{ text: 'OK', onPress: () => console.log('OK Pressed') }]
      );
    }
  };
  
  // Save the updated categories
  const saveCategories = async () => {
    if (!postId) {
      Alert.alert('Error', 'Post ID not found');
      return;
    }
    
    // Validate category count
    if (selectedCategories.length === 0) {
      Alert.alert('Error', 'Please select at least one category');
      return;
    }
    
    if (selectedCategories.length > MAX_SELECTIONS) {
      Alert.alert('Error', `You can select up to ${MAX_SELECTIONS} categories for a playlist`);
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      
      // Prepare the categories object exactly as expected by the backend
      const categoryData = {
        categories: selectedCategories
      };
      
      console.log('Saving categories:', categoryData);
      
      // Make API call to update the categories
      await axios.put(`${BASE_URL}/api/posts/${postId}/category`, 
        categoryData, 
        { headers }
      );
      
      // Reset navigation stack to Home
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Home', params: { refreshData: true } } }],
      });

    } catch (error) {
      console.error('Error updating categories:', error);
      let errorMessage = 'Failed to update categories. Please try again.';
      
      // Check for specific error responses from the backend
      if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      }
      
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Render a category item
  const renderCategoryItem = (item) => (
    <TouchableOpacity 
      style={[
        styles.categoryItem,
        selectedCategories.includes(item.name) && styles.selectedCategoryItem
      ]}
      onPress={() => toggleCategory(item.name)}
    >
      <View style={styles.categoryImageContainer}>
        <View style={styles.categoryImagePlaceholder} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.categoryGradient}
        >
          <Text style={styles.categoryName}>{item.name}</Text>
          {selectedCategories.includes(item.name) && (
            <View style={styles.checkmarkContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
            </View>
          )}
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Change Categories</Text>
        <TouchableOpacity 
          style={[
            styles.saveButton, 
            (isSaving || selectedCategories.length === 0) && styles.disabledButton
          ]}
          disabled={isSaving || selectedCategories.length === 0}
          onPress={saveCategories}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading playlist...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Playlist preview */}
          <View style={styles.playlistPreview}>
            <View style={styles.playlistImageContainer}>
                      {postData?.playlistImageUrl ? (
          <Image 
            source={{ uri: postData.playlistImageUrl }}
                  style={styles.playlistImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.playlistImagePlaceholder} />
              )}
            </View>
            <Text style={styles.playlistName}>{postData?.playlistName || 'Playlist'}</Text>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>
              Select up to {MAX_SELECTIONS} categories:
            </Text>
            <Text style={styles.instructionsText}>
              This helps others discover your playlist
            </Text>
            <View style={styles.selectedCountContainer}>
              <Text style={styles.selectedCountText}>
                {selectedCategories.length}/{MAX_SELECTIONS} selected
              </Text>
            </View>
            {selectedCategories.length > 0 && (
              <View style={styles.selectedGenresContainer}>
                {selectedCategories.map((genre) => (
                  <View key={genre} style={styles.selectedGenreBadge}>
                    <Text style={styles.selectedGenreText}>{genre}</Text>
                    <TouchableOpacity
                      style={styles.removeGenreButton}
                      onPress={() => toggleCategory(genre)}
                    >
                      <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Categories */}
          <ScrollView style={styles.scrollView}>
            {categorySections.map((section) => (
              <View key={section.title} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{section.title}</Text>
                <View style={styles.categoryGrid}>
                  {section.items.map((item, idx) => (
                    <View key={`${section.title}-${idx}`}>
                      {renderCategoryItem(item)}
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {/* Extra space at bottom for comfortable scrolling */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </>
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
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: '#007AFF',
    fontWeight: '500',
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
  playlistPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  playlistImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 16,
  },
  playlistImage: {
    width: '100%',
    height: '100%',
  },
  playlistImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  playlistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  instructionsContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#AAAAAA',
    marginBottom: 16,
  },
  selectedCountContainer: {
    marginBottom: 12,
  },
  selectedCountText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  selectedGenresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  selectedGenreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedGenreText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 4,
  },
  removeGenreButton: {
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    padding: 16,
    paddingBottom: 0,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: itemSize,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCategoryItem: {
    borderColor: '#007AFF',
  },
  categoryImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  categoryImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333',
  },
  categoryGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});

export default ChangeCategoriesScreen;
