import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Get screen dimensions for responsive layout
const { width } = Dimensions.get('window');
const itemSize = (width - 48) / 2; // 2 columns with padding

const PostCategoryScreen = ({ navigation, route }) => {
  // Get playlist data from route params
  const { playlistId, playlistName, playlistImageUrl } = route.params || {};
  
  // State for selected genres
  const [selectedGenres, setSelectedGenres] = useState([]);

  // Maximum number of genres that can be selected
  const MAX_SELECTIONS = 3;

  // Genres data from SearchScreen
  const genres = [
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
  const activities = [
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
  const moods = [
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
  const categories = [
    { title: "Genre", items: genres },
    { title: "Activity", items: activities },
    { title: "Mood", items: moods },
  ];

  // Handle genre selection/deselection
  const toggleGenre = (genreName) => {
    if (selectedGenres.includes(genreName)) {
      // Deselect if already selected
      setSelectedGenres(selectedGenres.filter(name => name !== genreName));
    } else if (selectedGenres.length < MAX_SELECTIONS) {
      // Select if under the maximum
      setSelectedGenres([...selectedGenres, genreName]);
    }
  };

  // Proceed to next screen
  const handleNext = () => {
    // Navigate to PostDetails screen, passing along the original params plus selected genres
    navigation.navigate('PostDetails', {
      playlistId,
      playlistName,
      playlistImageUrl,
      genres: selectedGenres
    });
  };

  // Render a category item
  const renderCategoryItem = (item) => (
    <TouchableOpacity 
      style={[
        styles.categoryItem,
        selectedGenres.includes(item.name) && styles.selectedCategoryItem
      ]}
      onPress={() => toggleGenre(item.name)}
    >
      <View style={styles.categoryImageContainer}>
        <View style={styles.categoryImagePlaceholder} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.categoryGradient}
        >
          <Text style={styles.categoryName}>{item.name}</Text>
          {selectedGenres.includes(item.name) && (
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
        <Text style={styles.headerTitle}>Select Categories</Text>
        <TouchableOpacity 
          style={[
            styles.nextButton, 
            selectedGenres.length === 0 && styles.disabledButton
          ]}
          disabled={selectedGenres.length === 0}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Playlist preview */}
      <View style={styles.playlistPreview}>
        <View style={styles.playlistImageContainer}>
          {playlistImageUrl ? (
            <Image
              source={{ uri: playlistImageUrl }}
              style={styles.playlistImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.playlistImagePlaceholder} />
          )}
        </View>
        <Text style={styles.playlistName}>{playlistName}</Text>
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
            {selectedGenres.length}/{MAX_SELECTIONS} selected
          </Text>
        </View>
        {selectedGenres.length > 0 && (
          <View style={styles.selectedGenresContainer}>
            {selectedGenres.map((genre) => (
              <View key={genre} style={styles.selectedGenreBadge}>
                <Text style={styles.selectedGenreText}>{genre}</Text>
                <TouchableOpacity
                  style={styles.removeGenreButton}
                  onPress={() => toggleGenre(genre)}
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
        {categories.map((category, index) => (
          <View key={category.title} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <View style={styles.categoryGrid}>
              {category.items.map((item, idx) => (
                <View key={`${category.title}-${idx}`}>
                  {renderCategoryItem(item)}
                </View>
              ))}
            </View>
          </View>
        ))}
        {/* Extra space at bottom for comfortable scrolling */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  nextButton: {
    padding: 8,
  },
  nextButtonText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
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

export default PostCategoryScreen; 