import React from 'react';
import { useChatList } from '../../hooks/useChatList';
import { ChatListItem } from '../../components/messages/chat-list-item';
import { Button } from '../../components/ui/button';
import { Link } from 'wouter'; // Or your router
import { PlusCircle, MessageSquareText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ChatListPage: React.FC = () => {
  const { chats, isLoading, error, currentUserUid } = useChatList();
  // const [, navigate] = useLocation(); // useLocation from wouter if needed for navigation

  // Placeholder for navigating to a user search/selection page to start a new chat
  const handleStartNewChat = () => {
    // For now, this could navigate to a user list or a dedicated "new chat" page
    // The actual logic to pick a user and call sendMessage with recipientUid will be there.
    // navigate('/messages/new'); // Example navigation using wouter's navigate
    alert("Feature to start a new chat: To be implemented. (This would navigate to a user selection page/modal).");
  };

  if (isLoading) {
    return (
        <div className="container mx-auto p-4 h-screen flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-gray-600 dark:text-gray-400">Loading your conversations...</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="container mx-auto p-4">
            <Alert variant="destructive">
                <AlertDescription className="flex items-center">
                    <MessageSquareText className="h-5 w-5 mr-2"/> Error loading chats: {error.message}
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <div className="container mx-auto max-w-2xl p-4">
        <div className="flex justify-between items-center mb-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Messages</h1>
          <Button onClick={handleStartNewChat} variant="ghost" className="text-primary hover:text-primary-dark dark:text-primary-foreground dark:hover:text-primary-foreground/90">
            <PlusCircle className="mr-2 h-5 w-5" /> Start New Chat
          </Button>
        </div>

        {chats.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-20">
            <MessageSquareText className="h-20 w-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No conversations yet.</h2>
            <p className="mb-4">Start a new chat to begin messaging with others in the STAR community.</p>
            <Button onClick={handleStartNewChat}>
              <PlusCircle className="mr-2 h-4 w-4" /> Start Your First Chat
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {chats.map((chat) => (
              <ChatListItem key={chat.id} chat={chat} currentUserId={currentUserUid} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
