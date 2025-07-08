import type { StateCreator, StoreApi } from "zustand/vanilla"
import { Notification } from "magicbell-js/user-client"

/**
 * This is where we define the state of our extension.
 * vscode-scripts will look for this module and automatically generate the store and the hooks for us, and ensure that state is synced across all views / processes.
 */

interface CodeInboxConfig {
  email: string
  jwt: string
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error"

export type State = {
  // Existing notification state
  notifications: Notification[]
  notificationsLoading: boolean
  notificationsError: string | null
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  setNotificationsLoading: (loading: boolean) => void
  setNotificationsError: (error: string | null) => void

  // New authentication state
  authStatus: AuthStatus
  authConfig: CodeInboxConfig | null
  authError: string | null

  // Authentication actions
  setAuthLoading: () => void
  setAuthAuthenticated: (config: CodeInboxConfig) => void
  setAuthUnauthenticated: () => void
  setAuthError: (error: string) => void
  clearAuthError: () => void

  // Authentication getters
  isAuthenticated: () => boolean
  isAuthLoading: () => boolean
  getAuthToken: () => string | null
  getAuthEmail: () => string | null
}

export type Store = StoreApi<State>

const stateCreator: StateCreator<State, [], []> = (set, get) => ({
  // Existing notification state
  addNotification: (notification: Notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
  setNotifications: (notifications: Notification[]) =>
    set({ notifications, notificationsLoading: false }),
  setNotificationsLoading: (loading: boolean) =>
    set({ notificationsLoading: loading }),
  setNotificationsError: (error: string | null) =>
    set({ notificationsError: error, notificationsLoading: false }),
  notifications: [],
  notificationsLoading: false,
  notificationsError: null,

  // New authentication state
  authStatus: "loading",
  authConfig: null,
  authError: null,

  // Authentication actions
  setAuthLoading: () =>
    set({
      authStatus: "loading",
      authError: null,
    }),

  setAuthAuthenticated: (config: CodeInboxConfig) =>
    set({
      authStatus: "authenticated",
      authConfig: config,
      authError: null,
    }),

  setAuthUnauthenticated: () =>
    set({
      authStatus: "unauthenticated",
      authConfig: null,
      authError: null,
    }),

  setAuthError: (error: string) =>
    set({
      authStatus: "error",
      authError: error,
    }),

  clearAuthError: () =>
    set({
      authError: null,
    }),

  // Authentication getters
  isAuthenticated: () => {
    const state = get()
    return (
      state.authStatus === "authenticated" &&
      state.authConfig !== null &&
      state.authConfig.jwt !== "" &&
      state.authConfig.email !== ""
    )
  },

  isAuthLoading: () => get().authStatus === "loading",

  getAuthToken: () => get().authConfig?.jwt || null,

  getAuthEmail: () => get().authConfig?.email || null,
})

export default stateCreator
