import { useEffect } from 'react';
import { useChatList } from '@/hooks/useChatList'; // Adjust path as needed
import { authManager } from '@/lib/auth'; // Adjust path as needed
import { useLocation } from 'wouter'; // To react to user presence

export function GlobalStateUpdater() {
  const { hasUnreadChats, isLoading: chatsLoading, currentUserUid } = useChatList();
  const [location] = useLocation(); // Reruns on navigation, useful if user state changes with route

  // This effect updates the global authManager state when hasUnreadChats changes
  // or when the user logs in/out (signalled by currentUserUid changing).
  useEffect(() => {
    if (currentUserUid && !chatsLoading) {
      authManager.setHasUnreadMessages(hasUnreadChats);
    } else if (!currentUserUid) {
      // Ensure it's cleared if user logs out or is not present
      if (authManager.getAuthState().hasUnreadMessages) { // Only update if it's currently true
        authManager.setHasUnreadMessages(false);
      }
    }
  }, [hasUnreadChats, currentUserUid, chatsLoading, location]); // location helps re-evaluate if auth state changes on nav

  // This component does not render anything itself
  return null;
}
