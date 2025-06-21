import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { MessageItem } from '../../components/messages/message-item';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Loader2, AlertCircle, Send } from 'lucide-react'; // Added Send icon
import { useLocation, Link } from 'wouter';
import { firestore, auth } from '../../firebase';
import { doc, getDoc, onSnapshot, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import type { ChatParticipant, Chat, ClientTimestamp } from '../../types/messaging';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
// Removed Textarea and Send icon from here as they are in MessageInput
import { MessageInput } from '../../components/messages/message-input'; // Import MessageInput

import { getFunctions, httpsCallable, HttpsCallableError } from 'firebase/functions';
import { useToast } from '@/components/ui/use-toast';

const functionsInstance = getFunctions();
const markMessagesAsReadCallable = httpsCallable(functionsInstance, 'markMessagesAsRead');


// Helper to convert Firestore timestamp (if that's what Chat has)
const formatTimestamp = (timestamp: FirestoreTimestamp | undefined): ClientTimestamp | undefined => {
  return timestamp ? timestamp.toDate() : undefined;
};

export const ChatViewPage: React.FC = () => {
  const [location, navigate] = useLocation();
  const chatId = location.split('/').pop() || null;

  const { messages, isLoading, isLoadingOlder, error, hasMoreOlder, loadOlderMessages, currentUserUid } = useMessages(chatId);
  const [otherParticipant, setOtherParticipant] = useState<ChatParticipant | null>(null);
  const [chatMetadata, setChatMetadata] = useState<Partial<Chat> | null>(null);
  const [chatHeaderLoading, setChatHeaderLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // For scroll position preservation
  const { toast } = useToast(); // Added toast

  // Removed newMessageText and isSending state, now managed by MessageInput component

  useEffect(() => {
    if (chatId && auth.currentUser) {
      setChatHeaderLoading(true);
      const chatDocRef = doc(firestore, "chats", chatId);
      const unsubscribe = onSnapshot(chatDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const chatDataFromSnap = docSnap.data();
          const typedChatData: Chat = { // Cast and format timestamps
            id: docSnap.id,
            participantUids: chatDataFromSnap.participantUids,
            lastMessage: chatDataFromSnap.lastMessage ? {
                ...chatDataFromSnap.lastMessage,
                timestamp: formatTimestamp(chatDataFromSnap.lastMessage.timestamp as FirestoreTimestamp)
            } : null,
            createdAt: formatTimestamp(chatDataFromSnap.createdAt as FirestoreTimestamp)!,
            updatedAt: formatTimestamp(chatDataFromSnap.updatedAt as FirestoreTimestamp)!,
            type: chatDataFromSnap.type,
          };
          setChatMetadata(typedChatData);

          const otherUid = typedChatData.participantUids.find(uid => uid !== auth.currentUser?.uid);
          if (otherUid) {
            const userDocRef = doc(firestore, "users", otherUid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const userData = userSnap.data() as any;
              setOtherParticipant({
                uid: userSnap.id,
                displayName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User',
                profileImageUrl: userData.profileImageUrl,
                firstName: userData.firstName,
                lastName: userData.lastName,
              });
            } else {
              setOtherParticipant({ uid: otherUid, displayName: 'Unknown User' });
            }
          }
        } else {
          console.error("Chat not found in ChatViewPage listener");
          // setError(new Error("Chat not found.")); // This would conflict with useMessages error
        }
        setChatHeaderLoading(false);
      }, (err) => {
        console.error("Error listening to chat metadata:", err);
        setChatHeaderLoading(false);
      });
      return () => unsubscribe();
    }
  }, [chatId]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    // Scroll to bottom when new messages arrive, but only if near the bottom already
    // or if it's the initial load. This prevents auto-scroll when user is reading older messages.
    const container = chatContainerRef.current;
    if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom || messages.length <= MESSAGES_PER_PAGE ) { // Assuming MESSAGES_PER_PAGE is exported or defined
            scrollToBottom();
        }
    }
  }, [messages]);

  // Placeholder for markMessagesAsRead logic
  useEffect(() => {
    if (!chatId || !currentUserUid || isLoading || messages.length === 0) {
      return;
    }

    const unreadMessageIds = messages
      .filter(msg =>
        msg.senderId !== currentUserUid && // Not sent by current user
        (!msg.readBy || !msg.readBy.includes(currentUserUid)) // Current user not in readBy array
      )
      .map(msg => msg.id);

    if (unreadMessageIds.length > 0) {
      // console.log(`Marking ${unreadMessageIds.length} messages as read in chat ${chatId}`);
      markMessagesAsReadCallable({ chatId, messageIds: unreadMessageIds })
        .then(() => {
          // console.log("Successfully marked messages as read on server.");
          // Listener in useMessages SHOULD pick up changes if message doc itself is updated (e.g. readBy array)
          // If not, or for immediate UI feedback for 'seen' status on these messages,
          // one might optimistically update the local 'messages' state here.
        })
        .catch(error => {
          console.error("Error marking messages as read:", error);
          let description = "Could not update read status for some messages.";
          if (error instanceof HttpsCallableError) description = error.message;
          else if (error.message) description = error.message;

          toast({
            variant: "destructive",
            title: "Read Status Update Failed",
            description: description
          });
        });
    }
  }, [messages, chatId, currentUserUid, isLoading, toast]); // Added toast to dependencies


  // handleSendMessage is now part of MessageInput.tsx

  if (!chatId) return <div className="p-4 text-center text-red-500 dark:text-red-300">Invalid chat session.</div>;
  if (chatHeaderLoading && isLoading && messages.length === 0) return <div className="p-4 text-center h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading chat...</span></div>;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center p-3 border-b dark:border-gray-700 sticky top-0 bg-background dark:bg-gray-800 z-10">
        <Link href="/messages">
          <Button variant="ghost" size="icon" className="mr-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        {otherParticipant ? (
          <>
            <Avatar className="w-9 h-9 mr-3">
              <AvatarImage src={otherParticipant.profileImageUrl} alt={otherParticipant.displayName} />
              <AvatarFallback>{otherParticipant.displayName?.substring(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{otherParticipant.displayName}</h2>
          </>
        ) : (
          <div className="w-9 h-9 mr-3 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
        )}
      </header>

      {/* Message List */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {isLoading && messages.length === 0 && <div className="text-center text-gray-500 dark:text-gray-400"><Loader2 className="h-6 w-6 animate-spin mx-auto my-4" />Loading messages...</div>}
        {error && <Alert variant="destructive" className="my-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{error.message}</AlertDescription></Alert>}

        {hasMoreOlder && !isLoading && messages.length > 0 && (
          <div className="text-center my-4">
            <Button onClick={loadOlderMessages} variant="outline" size="sm" disabled={isLoadingOlder} className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
              {isLoadingOlder ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</> : 'Load Older Messages'}
            </Button>
          </div>
        )}

        {!isLoading && messages.length === 0 && !error && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10">No messages yet. Start the conversation!</p>
        )}

        {messages.map(msg => (
          <MessageItem key={msg.optimisticId || msg.id} message={msg} isCurrentUserSender={msg.senderId === currentUserUid} />
        ))}
        <div ref={messagesEndRef} /> {/* For auto-scrolling to new messages */}
      </div>

      {/* Message Input Area */}
      <div className="p-0 border-t dark:border-gray-700 bg-background dark:bg-gray-800">
        {chatId && currentUserUid && <MessageInput chatId={chatId} />}
      </div>
    </div>
  );
};

// MESSAGES_PER_PAGE is defined and used within useMessages.ts, no longer needed here.
