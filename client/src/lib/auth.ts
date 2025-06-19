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
  profileImageUrl?: string; // Changed from profileImage to align with server response
  isVerified: boolean;
  isActive: boolean;
  createdAt?: string; // Added
  updatedAt?: string; // Added
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

class AuthManager {
  private static instance: AuthManager;
  private authState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
  };

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
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.authState = {
          user,
          token,
          isAuthenticated: true,
        };
      } catch (error) {
        this.clearAuth();
      }
    }
  }

  private saveToStorage() {
    if (this.authState.token && this.authState.user) {
      localStorage.setItem('auth_token', this.authState.token);
      localStorage.setItem('auth_user', JSON.stringify(this.authState.user));
    }
  }

  private clearAuth() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.authState = {
      user: null,
      token: null,
      isAuthenticated: false,
    };
  }

  getAuthState(): AuthState {
    return this.authState;
  }

  getAuthHeaders(): Record<string, string> {
    if (this.authState.token) {
      return {
        'Authorization': `Bearer ${this.authState.token}`,
      };
    }
    return {};
  }

  setAuth(user: User, token: string) {
    this.authState = {
      user,
      token,
      isAuthenticated: true,
    };
    this.saveToStorage();
  }

  updateUser(updatedFields: Partial<User>) { // Accept partial updates
    if (this.authState.isAuthenticated && this.authState.user) {
      this.authState.user = { ...this.authState.user, ...updatedFields };
      this.saveToStorage();
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
    this.clearAuth(); // Clears custom JWT from local storage and local auth state
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

// New function to establish server session using Firebase ID token
export const establishServerSession = async (idToken: string): Promise<void> => {
  try {
    const response = await apiRequest("POST", "/api/auth/sessionLogin", { token: idToken });
    const data = await response.json(); // Expects { token: customJwt, user: { uid, email, role, ... } }

    if (!data.token || !data.user) {
      throw new Error("Failed to establish server session: Invalid response from server.");
    }

    // Map Firebase UID from data.user.uid or data.user.userId to authManager's user.id
    const serverUser = {
      ...data.user,
      id: data.user.uid || data.user.userId || data.user.id, // Ensure 'id' is set, preferably as string UID
    };

    authManager.setAuth(serverUser, data.token); // Store custom JWT and user profile

    // Optionally, trigger a refetch of user-specific data or redirect
    // This part might be handled by the calling component's onSuccess callback
    console.log("Server session established. Custom JWT and user profile stored.");

  } catch (error) {
    console.error("Error establishing server session:", error);
    // authManager.logout(); // Caller should handle UI, logout is now more comprehensive
    // Re-throw the error so the calling component (e.g., AuthForm) can handle it (e.g., show error message)
    throw error;
  }
};
