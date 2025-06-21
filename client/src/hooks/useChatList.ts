import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { firestore, auth } from '../firebase'; // Adjust path to your firebase.ts
import type { Chat, ChatParticipant, LastMessagePreview, ClientTimestamp } from '../types/messaging'; // Adjust path
// Assuming User type from lib/auth is the one stored in Firestore 'users' collection by onUserCreate trigger
import type { User as AppUser } from '../lib/auth';

// Helper to convert Firestore timestamp to a common format (e.g., Date object)
const formatTimestamp = (timestamp: FirestoreTimestamp | undefined): ClientTimestamp | undefined => {
  return timestamp ? timestamp.toDate() : undefined;
};

export function useChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasUnreadChats, setHasUnreadChats] = useState(false); // New state
  const currentUser = auth.currentUser; // Get current user from Firebase Auth

  useEffect(() => {
    if (!currentUser) {
      setChats([]); // Clear chats if user logs out or is not logged in
      setHasUnreadChats(false); // Clear unread status
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(firestore, "chats"),
      where("participantUids", "array-contains", currentUser.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      try {
        const fetchedChats: Chat[] = await Promise.all(
          querySnapshot.docs.map(async (chatDoc) => {
            const data = chatDoc.data();
            const otherParticipantUids = data.participantUids.filter((uid: string) => uid !== currentUser.uid);

            const otherParticipantsData: ChatParticipant[] = await Promise.all(
              otherParticipantUids.map(async (uid: string) => {
                const userDocRef = doc(firestore, "users", uid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data() as AppUser; // Cast to your AppUser type
                  return {
                    uid: userSnap.id,
                    displayName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User',
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    profileImageUrl: userData.profileImageUrl,
                  };
                }
                return { uid, displayName: 'Unknown User', firstName: 'Unknown', lastName: 'User' }; // Fallback
              })
            );

            const lastMsgData = data.lastMessage;
            const lastMessagePreview: LastMessagePreview | null = lastMsgData ? {
                text: lastMsgData.text,
                senderId: lastMsgData.senderId,
                timestamp: formatTimestamp(lastMsgData.timestamp as FirestoreTimestamp)
            } : null;

            // Determine unread indicator (simplified: if last message exists and sender is not current user)
            // A more robust unread count would involve checking the 'readBy' array of messages
            // or a dedicated 'unreadCount' field on the chat document per user.
            const unreadIndicator = !!(lastMessagePreview && lastMessagePreview.senderId !== currentUser.uid);

            return {
              id: chatDoc.id,
              participantUids: data.participantUids,
              lastMessage: lastMessagePreview,
              createdAt: formatTimestamp(data.createdAt as FirestoreTimestamp)!, // Assert non-null if always present
              updatedAt: formatTimestamp(data.updatedAt as FirestoreTimestamp)!, // Assert non-null if always present
              otherParticipants: otherParticipantsData,
              unreadIndicator: unreadIndicator,
              type: data.type || 'one_on_one', // Default to one_on_one if type isn't set
              displayName: otherParticipantsData.length > 0 ? otherParticipantsData.map(p => p.displayName).join(', ') : 'Chat',
              displayImage: otherParticipantsData.length > 0 ? otherParticipantsData[0]?.profileImageUrl : undefined,

            } as Chat;
          })
        );
        setChats(fetchedChats);

        // Calculate global unread status
        const anyUnread = fetchedChats.some(chat => chat.unreadIndicator === true);
        setHasUnreadChats(anyUnread);

        setError(null);
      } catch (err: any) {
        console.error("Error fetching or processing chats in useChatList:", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    }, (err) => {
      console.error("Error in chat list listener (useChatList):", err);
      setError(err);
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [currentUser?.uid]); // Re-run effect if currentUser.uid changes

  return { chats, isLoading, error, currentUserUid: currentUser?.uid, hasUnreadChats };
}
