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
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const CommentScreen = ({ route, navigation }) => {
  const { postId, postUsername } = route.params || {};
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const textInputRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  
  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [showReportReasons, setShowReportReasons] = useState(false);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isOwnComment, setIsOwnComment] = useState(false);
  
  // Animation for report bottom sheet
  const reportSheetAnim = useRef(new Animated.Value(0)).current;
  
  // Animation for delete bottom sheet
  const deleteSheetAnim = useRef(new Animated.Value(0)).current;
  
  // Get screen dimensions for animation
  const screenHeight = Dimensions.get('window').height;
  
  // Base URL for API calls
  const baseUrl = 'http://10.0.0.107:8080';
  
  // Fetch comments when component mounts
  useEffect(() => {
    if (postId) {
      fetchComments();
    } else {
      setLoading(false);
      setError('No post ID provided');
    }
  }, [postId]);
  
  // Function to fetch comments from backend
  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Make API call to get comments for this post
      const response = await axios.get(`${baseUrl}/api/comments/post/${postId}`, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Process the response data
      if (response.data) {
        // Transform backend comments to match our UI format
        const formattedComments = await processCommentsData(response.data);
        setComments(formattedComments);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to load comments. Please try again.');
      // Set empty comments array on error
      setComments([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Process comments data from backend to match UI format
  const processCommentsData = async (commentsData) => {
    try {
      // Get username mapping for user IDs
      const usernames = await fetchUsernames(commentsData.map(comment => comment.userId));
      
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Get current user's ID
      const currentUserId = await SecureStore.getItemAsync('userId');
      if (!currentUserId) {
        throw new Error('User ID not found');
      }
      
      // Fetch vote information for all comments
      const votePromises = commentsData.map(async (comment) => {
        try {
          // Get all votes for this comment
          const votesResponse = await axios.get(`${baseUrl}/api/comment-votes/comment/${comment.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Get total votes for this comment
          const totalResponse = await axios.get(`${baseUrl}/api/comment-votes/comment/${comment.id}/total`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Find the current user's vote
          const userVote = votesResponse.data.find(vote => vote.userId === parseInt(currentUserId));
          
          return {
            commentId: comment.id,
            votes: totalResponse.data || 0,
            userVote: userVote ? userVote.voteValue : 0
          };
        } catch (error) {
          console.error(`Error fetching votes for comment ${comment.id}:`, error);
          return {
            commentId: comment.id,
            votes: 0,
            userVote: 0
          };
        }
      });
      
      // Wait for all vote information to be fetched
      const voteInfo = await Promise.all(votePromises);
      
      // Create a map for easy lookup
      const voteMap = voteInfo.reduce((acc, info) => {
        acc[info.commentId] = { votes: info.votes, userVote: info.userVote };
        return acc;
      }, {});
      
      // Group comments by parent/child relationship
      const parentComments = commentsData.filter(comment => !comment.parentCommentId);
      const childComments = commentsData.filter(comment => comment.parentCommentId);
      
      // Format parent comments with their replies
      return parentComments.map(comment => {
        const replies = childComments
          .filter(reply => reply.parentCommentId === comment.id)
          .map(reply => ({
            id: reply.id.toString(),
            username: usernames[reply.userId] || 'unknown_user',
            text: reply.commentText,
            timestamp: formatTimestamp(reply.createdAt),
            votes: voteMap[reply.id]?.votes || 0,
            userVote: voteMap[reply.id]?.userVote || 0
          }));
        
        return {
          id: comment.id.toString(),
          username: usernames[comment.userId] || 'unknown_user',
          text: comment.commentText,
          timestamp: formatTimestamp(comment.createdAt),
          votes: voteMap[comment.id]?.votes || 0,
          userVote: voteMap[comment.id]?.userVote || 0,
          replies: replies
        };
      });
    } catch (error) {
      console.error('Error processing comments data:', error);
      return [];
    }
  };
  
  // Helper function to fetch usernames for a list of user IDs
  const fetchUsernames = async (userIds) => {
    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Get current user's ID and username
      const currentUserId = await SecureStore.getItemAsync('userId');
      const currentUsername = await SecureStore.getItemAsync('username');
      
      // Create mapping with current user's actual username
      return userIds.reduce((acc, userId) => {
        // If this is the current user, use their actual username
        if (userId.toString() === currentUserId) {
          acc[userId] = currentUsername;
        } else {
          // For other users, use placeholder (this should be replaced with API call)
          acc[userId] = `user_${userId}`;
        }
        return acc;
      }, {});
    } catch (error) {
      console.error('Error fetching usernames:', error);
      return {};
    }
  };

  // Format timestamp from backend to UI format
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    // Handle array format [year, month, day, hour, minute, second, nanosecond]
    const date = Array.isArray(timestamp)
      ? new Date(
          timestamp[0], // year
          timestamp[1] - 1, // month (0-based in JS)
          timestamp[2], // day
          timestamp[3], // hours
          timestamp[4], // minutes
          timestamp[5] // seconds
        )
      : new Date(timestamp);
    
    const now = new Date();
    const diffMs = now - date;
    
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    let formattedValue;
    if (diffDay > 0) {
      formattedValue = `${diffDay}d ago`;
    } else if (diffHour > 0) {
      formattedValue = `${diffHour}h ago`;
    } else if (diffMin > 0) {
      formattedValue = `${diffMin}m ago`;
    } else {
      formattedValue = 'Just now';
    }
    
    return formattedValue;
  };

  // Handle voting on comments
  const handleVote = async (commentId, voteType, isReply = false, parentId = null) => {
    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Get userId from SecureStore
      const userId = await SecureStore.getItemAsync('userId');
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      const baseUrl = 'http://10.0.0.107:8080';
      
      // First update UI optimistically
      setComments(prevComments => {
        return prevComments.map(comment => {
          if (!isReply && comment.id === commentId) {
            // Calculate new vote value
            const prevVote = comment.userVote;
            const newVote = prevVote === voteType ? 0 : voteType; // Toggle off if same vote
            
            // Calculate vote difference
            const voteDiff = newVote - prevVote;
            
            return {
              ...comment,
              votes: comment.votes + voteDiff,
              userVote: newVote
            };
          } else if (isReply && comment.id === parentId) {
            // Handle votes on replies
            const updatedReplies = comment.replies.map(reply => {
              if (reply.id === commentId) {
                const prevVote = reply.userVote;
                const newVote = prevVote === voteType ? 0 : voteType;
                const voteDiff = newVote - prevVote;
                
                return {
                  ...reply,
                  votes: reply.votes + voteDiff,
                  userVote: newVote
                };
              }
              return reply;
            });
            
            return {
              ...comment,
              replies: updatedReplies
            };
          }
          return comment;
        });
      });
      
      // Then make API call to persist the vote
      const targetCommentId = parseInt(isReply ? commentId : commentId);
      const userIdInt = parseInt(userId);
      
      // Check if we're toggling off a vote
      const commentToUpdate = isReply 
        ? comments.find(c => c.id === parentId)?.replies.find(r => r.id === commentId)
        : comments.find(c => c.id === commentId);
      
      if (commentToUpdate && commentToUpdate.userVote === voteType) {
        // If already voted with this type, delete the vote (toggle off)
        await axios.delete(`${baseUrl}/api/comment-votes`, {
          params: {
            commentId: targetCommentId,
            userId: userIdInt
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } else {
        // Otherwise create or update the vote
        const voteData = {
          commentId: targetCommentId,
          userId: userIdInt,
          voteValue: voteType,
          createdAt: new Date().toISOString()
        };
        
        await axios.post(`${baseUrl}/api/comment-votes`, voteData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Error handling comment vote:', error);
      // Revert the optimistic update if the API call fails
      fetchComments();
    }
  };

  const handleAddComment = async () => {
    if (commentText.trim() === '') return;
    
    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Get userId from SecureStore
      const userId = await SecureStore.getItemAsync('userId');
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Get username for display - ensure we have the correct username
      const username = await SecureStore.getItemAsync('username');
      if (!username) {
        throw new Error('Username not found');
      }
      
      // Format the comment text - add @username mention for replies
      let formattedCommentText = commentText;
      if (replyingTo) {
        // Only add the @username if it's not already there
        if (!formattedCommentText.trim().startsWith(`@${replyingTo.username}`)) {
          formattedCommentText = `@${replyingTo.username} ${formattedCommentText}`;
        }
      }
      
      // Prepare comment data
      const commentData = {
        userId: parseInt(userId),
        postId: parseInt(postId),
        commentText: formattedCommentText,
        parentCommentId: replyingTo ? parseInt(replyingTo.commentId) : null,
        createdAt: new Date().toISOString()
      };
      
      // Make API call to create comment
      const response = await axios.post(`${baseUrl}/api/comments`, commentData, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (replyingTo) {
        // This is a reply to an existing comment
        setComments(prevComments => {
          return prevComments.map(comment => {
            if (comment.id === replyingTo.commentId) {
              const newReply = {
                id: response.data.id.toString(),
                username: username, // Use actual username from SecureStore
                text: formattedCommentText,
                timestamp: 'Just now',
                votes: 0,
                userVote: 0
              };
              
              return {
                ...comment,
                replies: [...comment.replies, newReply]
              };
            }
            return comment;
          });
        });
      } else {
        // This is a new top-level comment
        const newComment = {
          id: response.data.id.toString(),
          username: username, // Use actual username from SecureStore
          text: formattedCommentText,
          timestamp: 'Just now',
          votes: 0,
          userVote: 0,
          replies: []
        };
        
        setComments([newComment, ...comments]);
      }
      
      setCommentText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    }
  };

  const handleReplyPress = (username, commentId) => {
    setReplyingTo({ username, commentId });
    
    // Use setTimeout to ensure state updates before focusing
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }, 100);
  };
  
  const toggleExpandReplies = (commentId) => {
    setExpandedComments(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  // Function to show the report modal with animation
  const showReportSheet = async (comment) => {
    setSelectedComment(comment);
    
    // Check if this comment belongs to the current user
    const currentUsername = await SecureStore.getItemAsync('username');
    const isOwn = comment.username === currentUsername;
    setIsOwnComment(isOwn);
    
    if (isOwn) {
      // Show delete modal for own comments
      setShowDeleteModal(true);
      Animated.timing(deleteSheetAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Show report modal for other users' comments
      setShowReportModal(true);
      Animated.timing(reportSheetAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };
  
  // Function to hide the report modal with animation
  const hideReportSheet = () => {
    Animated.timing(reportSheetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setShowReportModal(false);
        setSelectedComment(null);
        setShowReportReasons(false);
      }
    });
  };

  // Handle report comment action
  const handleReportComment = () => {
    // Show the report reasons list
    setShowReportReasons(true);
  };

  // Handle specific report reason selection
  const handleReportReason = async (reason) => {
    hideReportSheet();
    
    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        Alert.alert("Authentication Error", "Please log in to report content.");
        return;
      }

      const baseUrl = 'http://10.0.0.107:8080';
      
      const response = await axios.post(
        `${baseUrl}/api/reports/comment`,
        {
          commentId: parseInt(selectedComment.id),
          reason: reason
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 201) {
        // SUCCESS!
        Alert.alert(
          "Report Submitted",
          "Thank you for your feedback. We will review your report shortly."
        );
      }
    } catch (error) {
      if (error.response) {
        // Handle backend errors
        const status = error.response.status;
        let errorMessage = error.response.data?.message || 'An unknown error occurred.';
        
        if (status === 404) {
          errorMessage = "This comment no longer exists.";
        } else if (status === 401) {
          errorMessage = "Your session has expired. Please log in again.";
        }
        
        Alert.alert("Error", `Could not submit report: ${errorMessage}`);
      } else {
        // Handle network or other errors
        console.error("Report submission failed:", error);
        Alert.alert("Network Error", "Unable to connect to the server. Please try again later.");
      }
    }
  };

  // Handle going back from report reasons to main report screen
  const handleBackToReport = () => {
    setShowReportReasons(false);
  };

  // Function to hide the delete modal with animation
  const hideDeleteSheet = () => {
    Animated.timing(deleteSheetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setShowDeleteModal(false);
        setSelectedComment(null);
        setIsOwnComment(false);
      }
    });
  };

  // Handle delete comment action
  const handleDeleteComment = () => {
    hideDeleteSheet();
    
    // Show confirmation dialog before deleting
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          onPress: () => deleteComment(),
          style: 'destructive'
        }
      ]
    );
  };

  // Function to actually delete the comment via API
  const deleteComment = async () => {
    if (!selectedComment) return;

    try {
      // Get JWT token from SecureStore
      const token = await SecureStore.getItemAsync('jwtToken');
      if (!token) {
        Alert.alert('Error', 'You must be logged in to delete comments.');
        return;
      }

      // Make API call to delete comment
      const response = await axios.delete(`${baseUrl}/api/comments/${selectedComment.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Success - update the UI by removing the comment from state
      setComments(prevComments => {
        // Check if this is a parent comment or a reply
        const isParentComment = prevComments.some(comment => comment.id === selectedComment.id);
        
        if (isParentComment) {
          // Remove parent comment (and all its replies are automatically deleted by backend)
          return prevComments.filter(comment => comment.id !== selectedComment.id);
        } else {
          // This is a reply - find the parent and remove the reply from its replies array
          return prevComments.map(comment => {
            const updatedReplies = comment.replies.filter(reply => reply.id !== selectedComment.id);
            if (updatedReplies.length !== comment.replies.length) {
              // This parent had the reply we're deleting
              return {
                ...comment,
                replies: updatedReplies
              };
            }
            return comment;
          });
        }
      });

      Alert.alert('Success', 'Comment deleted successfully.');
    } catch (error) {
      console.error('Error deleting comment:', error);
      
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          Alert.alert('Error', 'Comment not found. It may have already been deleted.');
        } else if (status === 403) {
          Alert.alert('Error', 'You do not have permission to delete this comment.');
        } else if (status === 401) {
          Alert.alert('Error', 'You must be logged in to delete comments.');
        } else {
          Alert.alert('Error', 'Failed to delete comment. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Failed to delete comment. Please check your connection and try again.');
      }
    }
  };

  // Calculate the translation Y for delete sheet
  const deleteTranslateY = deleteSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  // Calculate the translation Y based on animation value
  const translateY = reportSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Comments</Text>
          <View style={styles.headerRight} />
        </View>
        
        {/* Comments List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchComments}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.commentsList}>
            {comments.length === 0 ? (
              <View style={styles.noCommentsContainer}>
                <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
              </View>
            ) : (
              comments.map((comment, index) => (
                <View key={comment.id}>
                  {index > 0 && <View style={styles.commentDivider} />}
                  <View style={styles.commentContainer}>
                    {/* Main comment */}
                    <TouchableOpacity 
                      style={styles.comment}
                      onLongPress={() => showReportSheet(comment)}
                      delayLongPress={500}
                      activeOpacity={0.7}
                    >
                      <View style={styles.commentContent}>
                        <Text style={styles.username}>@{comment.username}</Text>
                        <Text style={styles.commentText}>{comment.text}</Text>
                        
                        {/* Voting UI */}
                        <View style={styles.votingContainer}>
                          <TouchableOpacity 
                            style={styles.voteButton} 
                            onPress={() => handleVote(comment.id, 1)}
                          >
                            <Ionicons 
                              name="arrow-up" 
                              size={16} 
                              color={comment.userVote === 1 ? '#4CAF50' : '#777777'} 
                            />
                          </TouchableOpacity>
                          
                          <Text style={[
                            styles.voteCount, 
                            comment.userVote === 1 ? styles.upvoted : 
                            comment.userVote === -1 ? styles.downvoted : null
                          ]}>
                            {comment.votes}
                          </Text>
                          
                          <TouchableOpacity 
                            style={styles.voteButton} 
                            onPress={() => handleVote(comment.id, -1)}
                          >
                            <Ionicons 
                              name="arrow-down" 
                              size={16} 
                              color={comment.userVote === -1 ? '#FF5252' : '#777777'} 
                            />
                          </TouchableOpacity>
                          
                          <Text style={styles.timestamp}>{comment.timestamp}</Text>
                          
                          <TouchableOpacity 
                            style={styles.replyButton}
                            onPress={() => handleReplyPress(comment.username, comment.id)}
                          >
                            <Text style={styles.actionText}>Reply</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Replies */}
                    {comment.replies.length > 0 && (
                      <View style={styles.repliesContainer}>
                        {/* Show only the first reply if not expanded */}
                        {!expandedComments[comment.id] && comment.replies.length > 0 && (
                          <TouchableOpacity 
                            key={comment.replies[0].id} 
                            style={styles.reply}
                            onLongPress={() => showReportSheet(comment.replies[0])}
                            delayLongPress={500}
                            activeOpacity={0.7}
                          >
                            <View style={styles.commentContent}>
                              <Text style={styles.username}>@{comment.replies[0].username}</Text>
                              <Text style={styles.commentText}>{comment.replies[0].text}</Text>
                              
                              {/* Reply Voting UI */}
                              <View style={styles.votingContainer}>
                                <TouchableOpacity 
                                  style={styles.voteButton} 
                                  onPress={() => handleVote(comment.replies[0].id, 1, true, comment.id)}
                                >
                                  <Ionicons 
                                    name="arrow-up" 
                                    size={16} 
                                    color={comment.replies[0].userVote === 1 ? '#4CAF50' : '#777777'} 
                                  />
                                </TouchableOpacity>
                                
                                <Text style={[
                                  styles.voteCount, 
                                  comment.replies[0].userVote === 1 ? styles.upvoted : 
                                  comment.replies[0].userVote === -1 ? styles.downvoted : null
                                ]}>
                                  {comment.replies[0].votes}
                                </Text>
                                
                                <TouchableOpacity 
                                  style={styles.voteButton} 
                                  onPress={() => handleVote(comment.replies[0].id, -1, true, comment.id)}
                                >
                                  <Ionicons 
                                    name="arrow-down" 
                                    size={16} 
                                    color={comment.replies[0].userVote === -1 ? '#FF5252' : '#777777'} 
                                  />
                                </TouchableOpacity>
                                
                                <Text style={styles.timestamp}>{comment.replies[0].timestamp}</Text>
                                
                                <TouchableOpacity 
                                  style={styles.replyButton}
                                  onPress={() => handleReplyPress(comment.replies[0].username, comment.id)}
                                >
                                  <Text style={styles.actionText}>Reply</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </TouchableOpacity>
                        )}
                        
                        {/* Show all replies if expanded */}
                        {expandedComments[comment.id] && comment.replies.map(reply => (
                          <TouchableOpacity 
                            key={reply.id} 
                            style={styles.reply}
                            onLongPress={() => showReportSheet(reply)}
                            delayLongPress={500}
                            activeOpacity={0.7}
                          >
                            <View style={styles.commentContent}>
                              <Text style={styles.username}>@{reply.username}</Text>
                              <Text style={styles.commentText}>{reply.text}</Text>
                              
                              {/* Reply Voting UI */}
                              <View style={styles.votingContainer}>
                                <TouchableOpacity 
                                  style={styles.voteButton} 
                                  onPress={() => handleVote(reply.id, 1, true, comment.id)}
                                >
                                  <Ionicons 
                                    name="arrow-up" 
                                    size={16} 
                                    color={reply.userVote === 1 ? '#4CAF50' : '#777777'} 
                                  />
                                </TouchableOpacity>
                                
                                <Text style={[
                                  styles.voteCount, 
                                  reply.userVote === 1 ? styles.upvoted : 
                                  reply.userVote === -1 ? styles.downvoted : null
                                ]}>
                                  {reply.votes}
                                </Text>
                                
                                <TouchableOpacity 
                                  style={styles.voteButton} 
                                  onPress={() => handleVote(reply.id, -1, true, comment.id)}
                                >
                                  <Ionicons 
                                    name="arrow-down" 
                                    size={16} 
                                    color={reply.userVote === -1 ? '#FF5252' : '#777777'} 
                                  />
                                </TouchableOpacity>
                                
                                <Text style={styles.timestamp}>{reply.timestamp}</Text>
                                
                                <TouchableOpacity 
                                  style={styles.replyButton}
                                  onPress={() => handleReplyPress(reply.username, comment.id)}
                                >
                                  <Text style={styles.actionText}>Reply</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                        
                        {/* Show "View more replies" button if there are more than 1 reply */}
                        {comment.replies.length > 1 && (
                          <TouchableOpacity 
                            style={styles.viewMoreReplies}
                            onPress={() => toggleExpandReplies(comment.id)}
                          >
                            <Text style={styles.viewMoreRepliesText}>
                              {expandedComments[comment.id] 
                                ? "Hide replies" 
                                : `View ${comment.replies.length - 1} more ${comment.replies.length - 1 === 1 ? 'reply' : 'replies'}`
                              }
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
        
        {/* Comment Input */}
        <View style={styles.inputContainer}>
          {replyingTo ? (
            <View style={styles.replyInputWrapper}>
              <View style={styles.replyingToIndicator}>
                <Text style={styles.replyingToText}>
                  Replying to <Text style={styles.replyingToUsername}>@{replyingTo.username}</Text>
                </Text>
                <TouchableOpacity onPress={() => {
                  setReplyingTo(null);
                  setCommentText('');
                }}>
                  <Ionicons name="close" size={20} color="#999999" />
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={textInputRef}
                  style={styles.input}
                  placeholder={`Reply...`}
                  placeholderTextColor="#999"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity 
                  style={[styles.postButton, !commentText.trim() && styles.disabledButton]}
                  onPress={handleAddComment}
                  disabled={!commentText.trim()}
                >
                  <Text style={styles.postButtonText}>Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.inputWrapper}>
              <TextInput
                ref={textInputRef}
                style={styles.input}
                placeholder="Add a comment..."
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity 
                style={[styles.postButton, !commentText.trim() && styles.disabledButton]}
                onPress={handleAddComment}
                disabled={!commentText.trim()}
              >
                <Text style={styles.postButtonText}>Post</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Report Comment Bottom Sheet */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="none"
        onRequestClose={hideReportSheet}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={hideReportSheet}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View 
              style={[
                styles.reportBottomSheet,
                { transform: [{ translateY }] }
              ]}
            >
              {!showReportReasons ? (
                // Initial report screen
                <>
                  {/* Report options */}
                  <View style={styles.reportOptionsList}>
                    <TouchableOpacity 
                      style={styles.reportOptionItem}
                      onPress={handleReportComment}
                    >
                      <Ionicons name="flag-outline" size={24} color="#FFA500" />
                      <Text style={[styles.reportOptionText, styles.reportText]}>Report comment</Text>
                      <View style={styles.optionRightIcon}>
                        <Ionicons name="chevron-forward" size={20} color="#777777" />
                      </View>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Cancel button */}
                  <TouchableOpacity 
                    style={styles.cancelButtonContainer}
                    onPress={hideReportSheet}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Report reasons screen
                <>
                  {/* Header with back button */}
                  <View style={styles.reportReasonsHeader}>
                    <TouchableOpacity 
                      style={styles.backToReportButton}
                      onPress={handleBackToReport}
                    >
                      <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.reportReasonsTitle}>Why are you reporting this comment?</Text>
                    <View style={styles.headerSpacer} />
                  </View>

                  {/* Report reasons list */}
                  <View style={styles.reportReasonsList}>
                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Harassment or bullying')}
                    >
                      <Text style={styles.reportReasonText}>Harassment or bullying</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Hate speech or discrimination')}
                    >
                      <Text style={styles.reportReasonText}>Hate speech or discrimination</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Spam or misleading content')}
                    >
                      <Text style={styles.reportReasonText}>Spam or misleading content</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Inappropriate or offensive language')}
                    >
                      <Text style={styles.reportReasonText}>Inappropriate or offensive language</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Threats or violence')}
                    >
                      <Text style={styles.reportReasonText}>Threats or violence</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.reportReasonItem}
                      onPress={() => handleReportReason('Privacy violation')}
                    >
                      <Text style={styles.reportReasonText}>Privacy violation</Text>
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

      {/* Delete Comment Bottom Sheet */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="none"
        onRequestClose={hideDeleteSheet}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={hideDeleteSheet}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View 
              style={[
                styles.deleteBottomSheet,
                { transform: [{ translateY: deleteTranslateY }] }
              ]}
            >
              {/* Delete option */}
              <View style={styles.deleteOptionsList}>
                <TouchableOpacity 
                  style={styles.deleteOptionItem}
                  onPress={handleDeleteComment}
                >
                  <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                  <Text style={[styles.deleteOptionText, styles.deleteText]}>Delete comment</Text>
                </TouchableOpacity>
              </View>
              
              {/* Cancel button */}
              <TouchableOpacity 
                style={styles.cancelButtonContainer}
                onPress={hideDeleteSheet}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
  headerRight: {
    width: 32, // Balance the header
  },
  commentsList: {
    flex: 1,
  },
  commentDivider: {
    height: 1,
    backgroundColor: '#333333',
    marginHorizontal: 16,
  },
  commentContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  comment: {
    flexDirection: 'row',
  },
  commentContent: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  votingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  voteButton: {
    padding: 4,
  },
  voteCount: {
    fontSize: 12,
    color: '#999999',
    marginHorizontal: 4,
    fontWeight: 'bold',
  },
  upvoted: {
    color: '#4CAF50', // Green for upvotes
  },
  downvoted: {
    color: '#FF5252', // Red for downvotes
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 12,
    marginRight: 16,
  },
  replyButton: {
    marginRight: 16,
  },
  actionText: {
    fontSize: 12,
    color: '#999999',
  },
  repliesContainer: {
    marginLeft: 16,
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#333333',
  },
  reply: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  replyInputWrapper: {
    width: '100%',
  },
  replyingToIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111111',
  },
  replyingToText: {
    color: '#999999',
    fontSize: 14,
  },
  replyingToUsername: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#222222',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#FFFFFF',
    maxHeight: 100,
  },
  postButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  postButtonText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  viewMoreReplies: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 6,
  },
  viewMoreRepliesText: {
    fontSize: 13,
    color: '#8E8E8E',
    fontWeight: '500',
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
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  noCommentsContainer: {
    padding: 24,
    alignItems: 'center',
  },
  noCommentsText: {
    color: '#999999',
    fontSize: 16,
    textAlign: 'center',
  },
  // Report Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  reportBottomSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingBottom: 20,
  },
  reportOptionsList: {
    paddingTop: 10,
  },
  reportOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  reportOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 15,
    flex: 1,
  },
  reportText: {
    color: '#FFA500',
  },
  cancelButtonContainer: {
    marginTop: 10,
    marginHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  optionRightIcon: {
    marginLeft: 10,
  },
  reportReasonsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backToReportButton: {
    padding: 4,
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
  deleteBottomSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingBottom: 20,
  },
  deleteOptionsList: {
    paddingTop: 10,
  },
  deleteOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  deleteOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 15,
    flex: 1,
  },
  deleteText: {
    color: '#FF3B30',
  },
});

export default CommentScreen;