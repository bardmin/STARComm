import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Paperclip, SendHorizonal, Loader2 } from 'lucide-react'; // Added Loader2
import { getFunctions, httpsCallable, HttpsCallableError } from 'firebase/functions';
import { useToast } from '../ui/use-toast';
import { auth } from '../../firebase'; // For current user, if needed for optimistic updates

// Optional: For optimistic updates, import Message type
// import type { Message, ClientTimestamp } from '../../types/messaging';

interface MessageInputProps {
  chatId: string;
  // Optional callback for optimistic updates
  // onMessageSent?: (optimisticMessage: Message) => void;
}

const functionsInstance = getFunctions(); // Initialize Firebase Functions
const sendMessageCallable = httpsCallable(functionsInstance, 'sendMessage');

export const MessageInput: React.FC<MessageInputProps> = ({ chatId /*, onMessageSent */ }) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const messageText = text.trim();
    if (!messageText) return;

    setIsSending(true);

    // Optional: Optimistic UI update
    // const currentFbUser = auth.currentUser;
    // if (onMessageSent && currentFbUser) {
    //   const optimisticMessage: Message = {
    //     id: `optimistic-${Date.now()}`,
    //     optimisticId: `optimistic-${Date.now()}`,
    //     chatId: chatId,
    //     senderId: currentFbUser.uid,
    //     sender: { uid: currentFbUser.uid, displayName: currentFbUser.displayName || "You", firstName: currentFbUser.displayName?.split(" ")[0] || "You" },
    //     text: messageText,
    //     timestamp: new Date() as ClientTimestamp,
    //     status: 'sending',
    //   };
    //   onMessageSent(optimisticMessage);
    // }

    try {
      await sendMessageCallable({ chatId, text: messageText });
      setText('');
      // Listener in useMessages will pick up the new message.
    } catch (error: any) {
      console.error("Error sending message:", error);
      let description = "An unexpected error occurred.";
      if (error instanceof HttpsCallableError) {
        description = error.message;
      } else if (error.message) {
        description = error.message;
      }
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: description,
      });
      // If using optimistic updates, update message status to 'failed'
      // if (onMessageSent && currentFbUser) { /* ... update optimistic message status ... */ }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSendMessage} className="flex items-center space-x-2 p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
      <Button type="button" variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" onClick={() => alert("Image attachment not implemented yet.")}>
        <Paperclip className="h-5 w-5" />
        <span className="sr-only">Attach file</span>
      </Button>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 resize-none min-h-[40px] max-h-[120px] rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-primary-dark"
        rows={1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
          }
        }}
        disabled={isSending}
      />
      <Button type="submit" size="icon" disabled={isSending || text.trim() === ''} className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg">
        {isSending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <SendHorizonal className="h-5 w-5" />
        )}
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
};
