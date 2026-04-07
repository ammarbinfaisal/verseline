import { create } from "zustand";
import { api } from "@/lib/api";
import { getToken, setToken, clearToken } from "@/lib/auth";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  loading: false,

  async login(email, password) {
    set({ loading: true });
    try {
      const res = await api.auth.login(email, password);
      setToken(res.token);
      set({ user: res.user, token: res.token, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  async signup(email, password) {
    set({ loading: true });
    try {
      const res = await api.auth.signup(email, password);
      setToken(res.token);
      set({ user: res.user, token: res.token, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout() {
    clearToken();
    set({ user: null, token: null });
  },

  async loadUser() {
    const token = getToken();
    if (!token) {
      set({ user: null, token: null, loading: false });
      return;
    }
    set({ loading: true });
    try {
      const user = await api.auth.me();
      set({ user, token, loading: false });
    } catch {
      clearToken();
      set({ user: null, token: null, loading: false });
    }
  },
}));
