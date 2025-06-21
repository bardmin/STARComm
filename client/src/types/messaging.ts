// Messaging related type definitions

// Represents Firestore Timestamps after potential client-side conversion
// (e.g., to JS Date objects or ISO strings)
export type ClientTimestamp = Date | string;

// Attempt to import User type. Path might need adjustment based on actual project structure.
// Assuming User type has at least: id (string UID), firstName?, lastName?, profileImageUrl?
import type { User } from '../lib/auth'; // Common location for User type after Firebase refactor

export interface ChatParticipant {
  uid: string; // Firebase UID
  // Denormalized fields from the User profile for quick display in chat UIs
  firstName?: string;
  lastName?: string;
  displayName?: string; // Could be firstName + " " + lastName
  profileImageUrl?: string;
  // Consider adding 'isActive' or 'onlineStatus' if relevant for chat participant lists
}

export interface LastMessagePreview {
  text?: string;       // Preview text of the last message
  senderId?: string;   // UID of the sender of the last message
  timestamp?: ClientTimestamp; // Timestamp of the last message
  // isReadByCurrentUser?: boolean; // Optional: client-side flag for UI
}

export interface Message {
  id: string;          // Firestore document ID of the message
  chatId?: string;      // Optional: if messages are ever fetched outside of a chat context directly
  senderId: string;    // UID of the sender
  text?: string;       // Text content, optional if imageUrl is present
  imageUrl?: string;   // URL of an image, optional if text is present
  timestamp: ClientTimestamp; // Sending time (Firestore server timestamp on create, converted on client)
  readBy?: string[];   // Array of UIDs who have read this message

  // Optional client-side only fields for optimistic UI updates
  optimisticId?: string;
  status?: 'sending' | 'sent' | 'failed' | 'read';

  // Client-side enriched data
  sender?: ChatParticipant; // Populated by client logic after fetching message if needed
}

export interface Chat {
  id: string;                // Firestore document ID for the chat (e.g., uid1_uid2 or group_id)
  participantUids: string[];   // Array of UIDs of all participants in the chat

  // Denormalized fields from the 'chats' document in Firestore
  lastMessage?: LastMessagePreview | null;
  createdAt: ClientTimestamp;  // Firestore server timestamp on create
  updatedAt: ClientTimestamp;  // Firestore server timestamp on new message or other updates
  type?: 'one_on_one' | 'group'; // Type of chat, from Firestore
  // groupName?: string; // If it's a group chat
  // groupImageUrl?: string; // If it's a group chat

  // Client-side enriched/derived data (not directly in the basic Firestore 'chats' doc,
  // but calculated or fetched separately by the client for UI purposes)
  otherParticipants?: ChatParticipant[]; // Details of other participants, populated by client logic
  unreadCount?: number;                // Calculated by client logic based on messages' readBy status
  unreadIndicator?: boolean;           // Simple flag for UI, populated by hook
  displayImage?: string;               // e.g., other user's image for 1-on-1, or group image
  displayName?: string;                // e.g., other user's name for 1-on-1, or group name
  // type?: 'one_on_one' | 'group'; // This was already in your definition, ensure it's kept if server provides it
}

// Example usage for a list of chats, where participant details might be enriched client-side
export interface ChatListItem extends Chat {
  // otherParticipants and unreadCount would be populated by client-side logic
  // before rendering the chat list.
}
