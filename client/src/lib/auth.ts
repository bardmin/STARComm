// TODO: This authManager will be refactored to integrate with Firebase Authentication.
// The current implementation uses JWTs and localStorage for a custom auth system.
// Future steps will involve using `firebase/auth` for user management, sign-in, sign-up,
// and token handling (Firebase ID tokens).
import { apiRequest } from "./queryClient"; // For making API calls

export interface User {
  id: string; // Changed to string to accommodate Firebase UID
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Additional fields from Firestore 'users' schema for profile page
  bio?: string | null;
  location?: { lat?: number; lng?: number; address?: string; city?: string; country?: string; postalCode?: string; } | null; // Allow null for clearing
  address?: string | null; // Simplified address field if used directly
  areaId?: string | null;
  preferences?: Record<string, any> | null; // e.g., { notifications: { email: true } }
  // SP-specific fields might be part of a different interface or fetched conditionally
  // For now, including them as optional if they are part of the main user document
  businessName?: string | null;
  businessDescription?: string | null;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | null;
  operatingHours?: Record<string, any> | null;
  serviceAreas?: string[] | null;
  averageRating?: number;
  ratingCount?: number;
  portfolioImages?: string[] | null;
}

export interface AuthState {
  user: User | null;
  token: string | null; // Will remain null in Firebase direct auth flow
  isAuthenticated: boolean;
  hasUnreadMessages?: boolean; // New field
}

class AuthManager {
  private static instance: AuthManager;
  private authState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    hasUnreadMessages: false, // Initialize
  };
  // Basic listener system for real-time UI updates if not using a full state management library
  private listeners: Array<() => void> = [];

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  private loadFromStorage() {
    // Load only user from storage; token is no longer custom JWT from backend for session
    const userStr = localStorage.getItem('auth_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        // Check if Firebase has an active user, otherwise this stored user is stale.
        // This logic is better handled by onAuthStateChanged in App.tsx which calls setAuth.
        // For now, if a user is in localStorage, we assume they might be authenticated until Firebase confirms.
        // This will be quickly overridden by onAuthStateChanged.
        this.authState = {
          user,
          token: null, // No custom JWT stored for session
          isAuthenticated: true, // Tentatively true, onAuthStateChanged will confirm
        };
      } catch (error) {
        this.clearAuth(); // Clears storage if parsing fails
      }
    } else {
      this.clearAuth(); // Ensure state is clean if no user in storage
    }
  }

  private saveToStorage() {
    if (this.authState.isAuthenticated && this.authState.user) {
      localStorage.setItem('auth_user', JSON.stringify(this.authState.user));
    } else {
      localStorage.removeItem('auth_user');
    }
    localStorage.removeItem('auth_token'); // Always remove old token
  }

  private clearAuth() {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    this.authState = {
      user: null,
      token: null, // Explicitly null
      isAuthenticated: false,
      hasUnreadMessages: false, // Reset on clear
    };
    this.notifyListeners(); // Notify about auth state change
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { // Unsubscribe function
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getAuthState(): AuthState {
    return this.authState;
  }

  // getAuthHeaders might be deprecated if all authenticated API calls use Firebase ID tokens
  // or are callable functions (which handle auth context automatically).
  // If custom backend routes still use this JWT, it would need to be managed differently.
  // For now, it returns empty as we are phasing out the custom session JWT.
  getAuthHeaders(): Record<string, string> {
    // if (this.authState.token) { // This was for custom JWT
    //   return { 'Authorization': `Bearer ${this.authState.token}` };
    // }
    return {};
  }

  // setAuth is now primarily driven by Firebase onAuthStateChanged
  // It receives the Firebase User object. The custom 'token' is no longer relevant for session.
  setAuth(firebaseUser: import('firebase/auth').User | null) {
    if (firebaseUser) {
      // Initial mapping. Detailed profile comes from Firestore listener via setDetailedUserProfile.
      const nameParts = firebaseUser.displayName?.split(" ") || [];
      const mappedUser: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        role: "resident", // Default role, to be updated by Firestore data via setDetailedUserProfile
        profileImageUrl: firebaseUser.photoURL || undefined,
        phoneNumber: firebaseUser.phoneNumber || undefined,
        isVerified: firebaseUser.emailVerified,
        isActive: true, // Firebase auth users are active by default. Firestore profile might override.
      };
      this.authState = {
        user: mappedUser,
        token: null, // No custom JWT for session
        isAuthenticated: true,
      };
    } else {
      this.authState = {
        user: null,
        token: null,
        isAuthenticated: false,
      };
    }
    this.saveToStorage(); // Save updated user (or clear if null)
    this.notifyListeners();
  }

  updateUser(updatedFields: Partial<User>) {
    if (this.authState.isAuthenticated && this.authState.user) {
      this.authState.user = { ...this.authState.user, ...updatedFields };
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // New method to set/update detailed user profile, typically from Firestore listener
  setDetailedUserProfile(profileData: Partial<User>) {
    if (this.authState.isAuthenticated && this.authState.user) {
      // Merge new profile data with existing auth user data, prioritizing new data
      // Ensure essential fields like id, email, role from initial auth are not overwritten if not in profileData
      const existingUser = this.authState.user;
      this.authState.user = {
        ...existingUser, // Keep existing id, email, role from session login
        ...profileData,  // Override/add fields from Firestore profile
        id: existingUser.id, // Ensure original ID (UID) from session login is preserved
        email: existingUser.email, // Ensure original email from session login is preserved
      };
      this.saveToStorage();
      // TODO: Consider emitting an event here if other parts of the app need to react instantly
      // without relying on component re-renders from context/prop changes alone.
      console.log("AuthManager: Detailed user profile updated/merged.", this.authState.user);
    } else if (this.authState.isAuthenticated && !this.authState.user && profileData.id && profileData.email) {
      // Case where initial sessionLogin might not have returned full user, but listener provides it
      this.authState.user = profileData as User;
      this.saveToStorage();
       console.log("AuthManager: Detailed user profile set for the first time.", this.authState.user);
       this.notifyListeners();
    }
  }

  public setHasUnreadMessages(status: boolean) {
    if (this.authState.hasUnreadMessages !== status) {
      this.authState = { ...this.authState, hasUnreadMessages: status };
      // Note: saveToStorage() here would persist this UI state.
      // This might not be desired if it's purely a session-based indicator.
      // For now, not saving it to localStorage to keep it session-specific.
      // If persistence across sessions is needed, uncomment saveToStorage().
      // this.saveToStorage();
      this.notifyListeners();
      console.log("AuthManager: hasUnreadMessages updated to", status);
    }
  }

  async logout() { // Make logout async
    try {
      // Dynamically import to avoid circular dependencies if firebase.ts imports authManager
      // Or ensure firebase services are initialized before authManager is constructed.
      const firebaseModule = await import('@/firebase');
      if (firebaseModule && firebaseModule.auth) {
        await firebaseModule.auth.signOut();
        console.log("Firebase client signed out successfully.");
      } else {
        console.warn("Firebase auth instance not available for client signOut.");
      }
    } catch (error) {
      console.error("Error signing out from Firebase client:", error);
      // Proceed with clearing local auth state even if Firebase signout fails,
      // as the custom session token is the primary concern for the backend.
    }
    this.clearAuth(); // This will also call notifyListeners
    // Typically, redirection or UI updates are handled by the component calling logout
    // or by an auth state listener.
  }

  isRole(role: string): boolean {
    return this.authState.user?.role === role;
  }

  hasRole(roles: string[]): boolean {
    return roles.includes(this.authState.user?.role || '');
  }
}

export const authManager = AuthManager.getInstance();

// establishServerSession is removed as it's no longer part of the Firebase direct auth flow.
