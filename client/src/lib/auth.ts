export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phoneNumber?: string;
  profileImage?: string;
  isVerified: boolean;
  isActive: boolean;
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

  updateUser(user: User) {
    if (this.authState.isAuthenticated) {
      this.authState.user = user;
      this.saveToStorage();
    }
  }

  logout() {
    this.clearAuth();
  }

  isRole(role: string): boolean {
    return this.authState.user?.role === role;
  }

  hasRole(roles: string[]): boolean {
    return roles.includes(this.authState.user?.role || '');
  }
}

export const authManager = AuthManager.getInstance();
