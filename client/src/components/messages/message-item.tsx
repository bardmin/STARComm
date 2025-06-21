import React from 'react';
import type { Message } from '../../types/messaging'; // Adjust path if your types are elsewhere
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'; // Assuming shadcn/ui
import { format } from 'date-fns'; // For formatting timestamp

interface MessageItemProps {
  message: Message;
  isCurrentUserSender: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isCurrentUserSender }) => {
  const senderDisplayName = message.sender?.displayName || 'User';
  const senderAvatarUrl = message.sender?.profileImageUrl;
  // Generate a fallback from the first two letters of the display name, or first letter if one word
  const nameParts = senderDisplayName.split(' ');
  const fallbackInitials = (nameParts[0]?.[0] || '') + (nameParts[1]?.[0] || nameParts[0]?.[1] || '');


  return (
    <div className={`flex my-1.5 ${isCurrentUserSender ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-end max-w-[75%] md:max-w-[65%] ${isCurrentUserSender ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isCurrentUserSender && (
          <Avatar className="w-7 h-7 mr-2 self-start flex-shrink-0">
            <AvatarImage src={senderAvatarUrl} alt={senderDisplayName} />
            <AvatarFallback className="text-xs">{fallbackInitials.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
        )}
        <div
          className={`px-3 py-2 rounded-xl ${
            isCurrentUserSender
              ? 'bg-primary text-primary-foreground rounded-br-none'
              : 'bg-muted dark:bg-gray-700 dark:text-gray-100 rounded-bl-none'
          }`}
        >
          {!isCurrentUserSender && message.sender?.displayName && ( // Only show name if not current user and name available
            <p className="text-xs font-semibold mb-0.5 text-primary dark:text-primary-foreground/80">{message.sender.displayName}</p>
          )}
          {message.text && <p className="whitespace-pre-wrap text-sm break-words">{message.text}</p>}
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Sent image"
              className="rounded-md my-1 max-w-xs max-h-60 object-contain cursor-pointer" // Added cursor-pointer for potential lightbox
              onClick={() => window.open(message.imageUrl, '_blank')} // Simple lightbox: open in new tab
            />
          )}
          <p className={`text-xs mt-1 ${isCurrentUserSender ? 'text-right' : 'text-left'} opacity-60`}>
            {message.timestamp ? format(new Date(message.timestamp), 'p') : 'sending...'}
          </p>
        </div>
      </div>
    </div>
  );
};
