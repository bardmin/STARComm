import React from 'react';
import { Link } from 'wouter';
import type { Chat } from '../../types/messaging';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatDistanceToNowStrict } from 'date-fns';

interface ChatListItemProps {
  chat: Chat;
  currentUserId?: string;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({ chat, currentUserId }) => {
  // Determine display name and avatar for 1-on-1 chats
  // For group chats, this logic would need to be different (e.g., use chat.groupName, chat.groupImageUrl)
  const otherParticipant = chat.otherParticipants && chat.otherParticipants.length > 0
                           ? chat.otherParticipants[0]
                           : null;

  const displayName = chat.displayName || (otherParticipant?.displayName || 'Chat');
  const avatarUrl = chat.displayImage || otherParticipant?.profileImageUrl;
  const avatarFallback = displayName.substring(0, 1).toUpperCase() + (displayName.split(' ')[1]?.substring(0,1).toUpperCase() || '');


  const lastMessageText = chat.lastMessage?.text || 'No messages yet.';
  const lastMessageTimestamp = chat.lastMessage?.timestamp
    ? formatDistanceToNowStrict(new Date(chat.lastMessage.timestamp), { addSuffix: true })
    : '';

  // Use the unreadIndicator from the chat object, which is populated by the hook
  const isUnread = chat.unreadIndicator;

  return (
    <Link href={`/messages/chat/${chat.id}`} className="block hover:bg-gray-100 dark:hover:bg-gray-700 p-3 rounded-lg transition-colors">
      <div className="flex items-center space-x-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback>{avatarFallback || '?'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <p className={`font-semibold truncate ${isUnread ? 'text-primary dark:text-primary-foreground' : 'text-gray-900 dark:text-gray-100'}`}>
              {displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{lastMessageTimestamp}</p>
          </div>
          <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
            {chat.lastMessage?.senderId === currentUserId && !isUnread && "You: "}
            {/* Add "You: " only if read and sender is current user */}
            {chat.lastMessage?.senderId !== currentUserId && isUnread && `${otherParticipant?.firstName || 'User'}: `}
            {/* Add sender name if unread and not current user */}
            {lastMessageText}
          </p>
        </div>
        {isUnread && (
          <div className="w-3 h-3 bg-primary rounded-full ml-2 self-center flex-shrink-0 animate-pulse"></div>
        )}
      </div>
    </Link>
  );
};
