import { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../config/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
  updateEmail,
  sendEmailVerification
} from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { messageKeys } from '../services/messageQueries';
import { ApiService } from '../services/apiService';

// essentially all firebase auth functions are here

const AuthContext = createContext(); // create auth context

export function useAuth() {
  const context = useContext(AuthContext); // get context
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider'); // throw error if not used within auth provider
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();


  async function signup(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Update the user's display name if provided
    if (displayName) {
      await updateProfile(result.user, {
        displayName: displayName
      });
    }

    // Send email verification
    await sendEmailVerification(result.user);

    // Sign out immediately - user must verify email before they can use the app
    await signOut(auth);

    return result;
  }

  async function resendVerificationEmail(email, password) {
    // Sign in temporarily to resend verification email
    const result = await signInWithEmailAndPassword(auth, email, password);

    if (result.user.emailVerified) {
      // Already verified, keep them signed in
      return;
    }

    // Send verification email and sign out
    await sendEmailVerification(result.user);
    await signOut(auth);
  }

  async function checkEmailVerification(email, password) {
    // Sign in temporarily to check if email is now verified
    const result = await signInWithEmailAndPassword(auth, email, password);
    await result.user.reload(); // Fetch fresh data from Firebase

    if (result.user.emailVerified) {
      // Verified — stay signed in, onAuthStateChanged will update state
      return true;
    }

    // Not yet verified — sign back out
    await signOut(auth);
    return false;
  }

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);

    // Check if email is verified
    if (!result.user.emailVerified) {
      await signOut(auth);
      throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
    }

    return result;
  }

  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  function logout() {
    setCurrentUser(null);
    queryClient.clear();
    return signOut(auth);
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  async function updateUserProfile(profileData) {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }

    const isNameUpdating = profileData.name && profileData.name !== currentUser.displayName;
    const isPictureUpdating = profileData.photoURL && profileData.photoURL !== currentUser.photoURL;

    const firebaseUpdateData = {};
    if (isNameUpdating) {
      firebaseUpdateData.displayName = profileData.name;
    }
    if (isPictureUpdating) {
      firebaseUpdateData.photoURL = profileData.photoURL;
    }

    if (Object.keys(firebaseUpdateData).length > 0) {
      await updateProfile(currentUser, firebaseUpdateData);
    }

    // Update email if it has changed
    if (profileData.email && profileData.email !== currentUser.email) {
      await updateEmail(currentUser, profileData.email);
    }

    // Try to update backend database (optional, won't fail if backend is down)
    try {
      const backendUpdateData = {
        name: profileData.name,
        email: profileData.email,
        profilePictureUrl: profileData.photoURL
      };

      await ApiService.put('/user', backendUpdateData);
    } catch {
      // Don't throw error for backend failures - Firebase is the source of truth
    }

    // Force a refresh of the current user data
    await currentUser.reload();

    // Force update the currentUser state to trigger re-renders
    // Use auth.currentUser to get the refreshed user object with all methods intact
    setCurrentUser(auth.currentUser);

    // Smart cache update when profile name or picture changes
    // Instead of refetching everything, surgically update cached data where this user appears
    if (isNameUpdating || isPictureUpdating) {

      const newName = profileData.name;
      const newPhotoURL = profileData.photoURL;
      const userFirebaseUid = currentUser.uid;

      // Update all listing details where this user is the poster
      queryClient.setQueriesData(
        { queryKey: ['listings', 'details'] },
        (oldData) => {
          if (!oldData || !oldData.isOwner) return oldData;
          return {
            ...oldData,
            poster: {
              ...oldData.poster,
              name: newName || oldData.poster.name,
              profilePictureUrl: newPhotoURL !== undefined ? newPhotoURL : oldData.poster.profilePictureUrl,
            }
          };
        }
      );

      // Update conversations where this user is a participant
      queryClient.setQueriesData(
        { queryKey: messageKeys.conversations(userFirebaseUid) },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(conversation => {
            const updates = {};

            // Check if current user is the requester
            if (conversation.requesterFirebaseUid === userFirebaseUid ||
                conversation.requesterName === currentUser.displayName) {
              updates.requesterName = newName || conversation.requesterName;
              updates.requesterProfilePictureUrl = newPhotoURL !== undefined ? newPhotoURL : conversation.requesterProfilePictureUrl;
            }

            // Check if current user is the lister
            if (conversation.listerFirebaseUid === userFirebaseUid ||
                conversation.listerName === currentUser.displayName) {
              updates.listerName = newName || conversation.listerName;
              updates.listerProfilePictureUrl = newPhotoURL !== undefined ? newPhotoURL : conversation.listerProfilePictureUrl;
            }

            return Object.keys(updates).length > 0 ? { ...conversation, ...updates } : conversation;
          });
        }
      );

      // Update messages where this user is the sender
      queryClient.setQueriesData(
        { queryKey: ['messages'] },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(message => {
            // Check if current user is the sender (by name matching since we don't have firebaseUid in messages)
            if (message.senderName === currentUser.displayName) {
              return {
                ...message,
                senderName: newName || message.senderName,
                senderProfilePictureUrl: newPhotoURL !== undefined ? newPhotoURL : message.senderProfilePictureUrl,
              };
            }
            return message;
          });
        }
      );

    }

    return { success: true, message: 'Profile updated successfully' };
  }

  useEffect(() => {
    // Use a ref to track previous user without causing re-renders
    let previousUserUid = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // If user changed (logged out or different user logged in), clear previous user's cache
      if (previousUserUid && (!user || previousUserUid !== user.uid)) {
        queryClient.clear();
      }
      
      previousUserUid = user?.uid || null;
      
      if (user) {
        // CRITICAL: Wait for the token to be ready before allowing API calls
        // This prevents 401 errors when Firebase restores a session
        try {
          await user.getIdToken(); // Use cached token if valid; SDK refreshes automatically when expired
        } catch {
          // If token refresh fails, user will need to sign in again
          // Token might be expired - user will be prompted to sign in again on next API call
        }
      }
      
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, [queryClient]); // Remove currentUser from dependencies to prevent re-subscription loop

  const value = {
    currentUser,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    resendVerificationEmail,
    checkEmailVerification,
    updateUserProfile,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 