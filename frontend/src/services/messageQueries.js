import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiService } from './apiService';
import { useAuth } from '../context/AuthContext';

// Query keys for React Query caching
export const messageKeys = {
  conversations: (firebaseUid) => ['conversations', firebaseUid || 'anonymous'],
  conversation: (firebaseUid, conversationId) => ['conversation', firebaseUid || 'anonymous', conversationId],
  messagesRoot: (firebaseUid) => ['messages', firebaseUid || 'anonymous'],
  messages: (firebaseUid, conversationId) => ['messages', firebaseUid || 'anonymous', conversationId],
  currentUser: (firebaseUid) => ['currentUser', firebaseUid || 'anonymous'],
  blockedUsers: (firebaseUid) => ['blockedUsers', firebaseUid || 'anonymous'],
};

// Cached hook to get current user's database ID
export const useCurrentUserQuery = (options = {}) => {
  const { currentUser, loading: authLoading } = useAuth();
  const firebaseUid = currentUser?.uid;
  
  return useQuery({
    queryKey: messageKeys.currentUser(firebaseUid),
    queryFn: async () => {
      const user = await ApiService.get('/user');
      return user;
    },
    enabled: !!currentUser && !authLoading,
    staleTime: 10 * 60 * 1000, // 10 minutes - user data rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    ...options,
  });
};

// Fetch user's conversations
export const useConversationsQuery = (options = {}) => {
  const { currentUser, loading: authLoading } = useAuth();
  const firebaseUid = currentUser?.uid;

  return useQuery({
    queryKey: messageKeys.conversations(firebaseUid),
    queryFn: async () => {
      const data = await ApiService.get('/user/conversations');
      return data.map(conversation => ({
        ...conversation,
        id: conversation.conversationID,
        lastMessage: conversation.lastMessageContent,
        lastMessageTime: conversation.lastMessageTime,
        unreadCount: conversation.unreadCount || 0,
      }));
    },
    enabled: !!currentUser && !authLoading,
    staleTime: 30 * 1000, // 30 seconds - shorter stale time to catch unread updates
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when user comes back to the tab
    refetchOnMount: 'always', // Always refetch on mount to get latest unread counts
    ...options, // Allow caller to pass enabled and other options
  });
};

// Fetch messages for a conversation
export const useMessagesQuery = (conversationId, options = {}) => {
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const queryClient = useQueryClient();

  // Extract enabled from options, defaulting to just checking conversationId
  const { enabled: callerEnabled = true, ...restOptions } = options;

  return useQuery({
    queryKey: messageKeys.messages(firebaseUid, conversationId),
    queryFn: async () => {
      const data = await ApiService.get(`/conversations/${conversationId}/messages`);

      // Force refetch conversations to update unread counts after viewing messages
      // Use refetchQueries instead of invalidateQueries to ensure immediate update
      queryClient.refetchQueries({ queryKey: messageKeys.conversations(firebaseUid) });

      return data.map(message => ({
        ...message,
        id: message.messageID,
        timestamp: message.sentAt,
      }));
    },
    enabled: !!conversationId && callerEnabled,
    staleTime: 30 * 1000, // 30 seconds - messages don't change that fast
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache
    refetchInterval: 10 * 1000, // Auto-refresh every 10 seconds when viewing
    refetchOnWindowFocus: true, // Refresh when user comes back to the tab
    refetchOnMount: true, // Refetch on mount to ensure messages are marked as read
    refetchIntervalInBackground: false, // Only poll when tab is active
    ...restOptions,
  });
};

// Send a message
export const useSendMessageMutation = () => {
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ listingId, content }) => {
      return await ApiService.post(`/listings/${listingId}/message`, { content });
    },
    onSuccess: () => {
      // Invalidate conversations to refresh the list
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations(firebaseUid) });
      // Invalidate all message queries to refresh them
      queryClient.invalidateQueries({ queryKey: messageKeys.messagesRoot(firebaseUid) });
    },
  });
};

// Reply to a conversation
export const useReplyMutation = () => {
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conversationId, content }) => {
      return await ApiService.post(`/conversations/${conversationId}/reply`, { content });
    },
    onSuccess: (data, variables) => {
      // Invalidate conversations to refresh the list
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations(firebaseUid) });
      // Invalidate specific conversation messages
      queryClient.invalidateQueries({ queryKey: messageKeys.messages(firebaseUid, variables.conversationId) });
    },
  });
};

// Find or create conversation without sending message
export const useFindOrCreateConversationMutation = () => {
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ listingId }) => {
      return await ApiService.post(`/listings/${listingId}/conversation`);
    },
    onSuccess: () => {
      // Invalidate conversations to refresh the list
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations(firebaseUid) });
    },
  });
};

// Delete conversation for current user only
export const useDeleteConversationMutation = () => {
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }) => {
      return await ApiService.delete(`/conversations/${conversationId}`);
    },
    onSuccess: () => {
      // Invalidate conversations to refresh the list
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations(firebaseUid) });
    },
  });
};

// List users the current user has blocked
export const useBlockedUsersQuery = (options = {}) => {
  const { currentUser, loading: authLoading } = useAuth();
  const firebaseUid = currentUser?.uid;

  return useQuery({
    queryKey: messageKeys.blockedUsers(firebaseUid),
    queryFn: async () => {
      return await ApiService.get('/user/blocked');
    },
    enabled: !!currentUser && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
};

// Block a user
export const useBlockUserMutation = () => {
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }) => {
      return await ApiService.post(`/users/${userId}/block`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations(firebaseUid) });
      queryClient.invalidateQueries({ queryKey: messageKeys.blockedUsers(firebaseUid) });
    },
  });
};

// Report a user
export const useReportUserMutation = () => {
  return useMutation({
    mutationFn: async ({ userId, reason, details }) => {
      return await ApiService.post(`/users/${userId}/report`, { reason, details });
    },
  });
};

// Unblock a user
export const useUnblockUserMutation = () => {
  const { currentUser } = useAuth();
  const firebaseUid = currentUser?.uid;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }) => {
      return await ApiService.delete(`/users/${userId}/block`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.blockedUsers(firebaseUid) });
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations(firebaseUid) });
    },
  });
}; 