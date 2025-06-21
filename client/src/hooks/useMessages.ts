import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
  startAfter,
  doc,
  getDoc,
  getDocs, // Added for getDocs
  Timestamp as FirestoreTimestamp, // Renamed to avoid conflict with global Timestamp if any
  endBefore, // Not used in current loadOlder, but good for future prev-page pagination
  limitToLast // Not used in current loadOlder, but good for future
} from 'firebase/firestore';
import { firestore, auth } from '../firebase'; // Adjust path
import type { Message, ChatParticipant, ClientTimestamp } from '../types/messaging'; // Adjust path
// Assuming User type from lib/auth is the one stored in Firestore 'users' collection
import type { User as AppUser } from '../lib/auth';

const MESSAGES_PER_PAGE = 20;

const formatTimestamp = (timestamp: FirestoreTimestamp | undefined): ClientTimestamp | undefined => {
  return timestamp ? timestamp.toDate() : undefined;
};

const userProfileCache = new Map<string, ChatParticipant>();

const getSenderProfile = async (senderId: string): Promise<ChatParticipant> => {
  if (userProfileCache.has(senderId)) {
    return userProfileCache.get(senderId)!;
  }
  try {
    const userDocRef = doc(firestore, "users", senderId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as AppUser;
      const profile: ChatParticipant = {
        uid: userSnap.id,
        displayName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User',
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
      };
      userProfileCache.set(senderId, profile);
      return profile;
    }
  } catch (e) { console.error("Error fetching sender profile for ID " + senderId + ":", e); }
  const unknownProfile = { uid: senderId, displayName: 'Unknown User', firstName: 'Unknown', lastName: 'User' };
  userProfileCache.set(senderId, unknownProfile);
  return unknownProfile;
};


export function useMessages(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  // Refs to store the actual Firestore Timestamps for cursors
  const oldestMessageTimestampCursorRef = useRef<FirestoreTimestamp | null>(null);
  const newestMessageTimestampRef = useRef<FirestoreTimestamp | null>(null); // For new messages after initial load
  const initialFetchDoneRef = useRef(false);
  const currentChatIdRef = useRef<string | null>(null); // To handle chatId changes

  useEffect(() => {
    if (!chatId || !auth.currentUser) {
      setMessages([]);
      setIsLoading(false);
      initialFetchDoneRef.current = false;
      oldestMessageTimestampCursorRef.current = null;
      newestMessageTimestampRef.current = null;
      currentChatIdRef.current = chatId;
      return;
    }

    // If chatId changes, reset state for the new chat
    if (currentChatIdRef.current !== chatId) {
        setMessages([]);
        setIsLoading(true);
        initialFetchDoneRef.current = false;
        oldestMessageTimestampCursorRef.current = null;
        newestMessageTimestampRef.current = null;
        setHasMoreOlder(true);
        currentChatIdRef.current = chatId;
    }


    const messagesQuery = query(
      collection(firestore, "chats", chatId, "messages"),
      orderBy("timestamp", "desc"),
      limit(MESSAGES_PER_PAGE)
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      const newMessagesData: Message[] = [];
      for (const messageDoc of snapshot.docs) {
        const data = messageDoc.data();
        const senderProfile = await getSenderProfile(data.senderId);
        newMessagesData.push({
          id: messageDoc.id,
          senderId: data.senderId,
          text: data.text,
          imageUrl: data.imageUrl,
          timestamp: formatTimestamp(data.timestamp as FirestoreTimestamp)!,
          readBy: data.readBy || [],
          sender: senderProfile,
        });
      }

      const sortedNewMessages = newMessagesData.reverse(); // Show oldest at top, newest at bottom

      if (!initialFetchDoneRef.current) {
        setMessages(sortedNewMessages);
        if (sortedNewMessages.length > 0) {
            oldestMessageTimestampCursorRef.current = snapshot.docs[snapshot.docs.length - 1]?.data().timestamp as FirestoreTimestamp; // Last doc because of desc query
            newestMessageTimestampRef.current = snapshot.docs[0]?.data().timestamp as FirestoreTimestamp; // First doc
        }
        setHasMoreOlder(sortedNewMessages.length === MESSAGES_PER_PAGE);
        initialFetchDoneRef.current = true;
      } else {
        // Handle real-time new messages: add to bottom if newer
        setMessages(prevMessages => {
          const combined = [...prevMessages];
          let newMessagesAdded = false;
          sortedNewMessages.forEach(nm => {
            if (!combined.find(m => m.id === nm.id) &&
                newestMessageTimestampRef.current &&
                (nm.timestamp instanceof Date && new Date(nm.timestamp) > new Date(newestMessageTimestampRef.current!))) {
              combined.push(nm);
              newMessagesAdded = true;
            } else if (!combined.find(m => m.id === nm.id) && !newestMessageTimestampRef.current) {
              // Case where prevMessages was empty
              combined.push(nm);
              newMessagesAdded = true;
            }
          });
          if (newMessagesAdded) {
            combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            if (combined.length > 0) {
                newestMessageTimestampRef.current = snapshot.docs[0]?.data().timestamp as FirestoreTimestamp;
            }
          }
          return newMessagesAdded ? combined : prevMessages;
        });
      }
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error in messages listener (useMessages):", err);
      setError(err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]); // Re-run effect if chatId changes

  const loadOlderMessages = useCallback(async () => {
    if (!chatId || !auth.currentUser || !oldestMessageTimestampCursorRef.current || !hasMoreOlder) {
        if (!oldestMessageTimestampCursorRef.current && initialFetchDoneRef.current && messages.length > 0) {
            // This might mean initial load had less than MESSAGES_PER_PAGE, so no more older.
            setHasMoreOlder(false);
        }
        return;
    }

    setIsLoadingOlder(true);
    setError(null);
    try {
      const q = query(
        collection(firestore, "chats", chatId, "messages"),
        orderBy("timestamp", "desc"),
        startAfter(oldestMessageTimestampCursorRef.current), // Use the actual Firestore Timestamp object
        limit(MESSAGES_PER_PAGE)
      );

      const snapshot = await getDocs(q); // Corrected: use getDocs for a query
      const olderMessagesDocs = snapshot.docs;

      const olderMessages: Message[] = [];
       for (const messageDoc of olderMessagesDocs) {
        const data = messageDoc.data();
        const senderProfile = await getSenderProfile(data.senderId);
        olderMessages.push({
          id: messageDoc.id,
          senderId: data.senderId,
          text: data.text,
          imageUrl: data.imageUrl,
          timestamp: formatTimestamp(data.timestamp as FirestoreTimestamp)!,
          readBy: data.readBy || [],
          sender: senderProfile,
        });
      }

      const sortedOlderMessages = olderMessages.reverse(); // Reverse to prepend correctly

      setMessages((prevMessages) => [...sortedOlderMessages, ...prevMessages]);
      if (olderMessagesDocs.length > 0) {
        oldestMessageTimestampCursorRef.current = olderMessagesDocs[olderMessagesDocs.length - 1].data().timestamp as FirestoreTimestamp;
      }
      setHasMoreOlder(olderMessages.length === MESSAGES_PER_PAGE);
    } catch (err: any) {
      console.error("Error loading older messages:", err);
      setError(err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [chatId, hasMoreOlder, messages.length]); // Added messages.length to deps of loadOlderMessages

  return { messages, isLoading, isLoadingOlder, error, hasMoreOlder, loadOlderMessages, currentUserUid: auth.currentUser?.uid };
}
