import type { Store } from "../../state"
import { Client, Notification } from "magicbell-js/user-client"
import { Socket } from "magicbell-js/socket"

export interface NotificationsFetcher {
  fetchNotifications(jwt: string): Promise<Notification[]>
}

export class MagicBellNotificationsFetcher implements NotificationsFetcher {
  private limit: number

  constructor(limit: number = 8) {
    this.limit = limit
  }

  async fetchNotifications(jwt: string): Promise<Notification[]> {
    try {
      const client = new Client({
        token: jwt,
      })

      const { data } = await client.notifications.listNotifications({
        limit: this.limit,
      })

      return data?.data || []
    } catch (error) {
      console.error(
        "MagicBellNotificationsFetcher: Failed to fetch notifications:",
        error
      )
      throw new Error(
        `Failed to fetch notifications: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }
}

export class NotificationsService {
  private fetcher: NotificationsFetcher
  private store: Store
  private isLoading = false
  private pollInterval: NodeJS.Timeout | null = null
  private socketClient: Socket | null = null
  private client: Client | null = null

  constructor(
    store: Store,
    fetcher: NotificationsFetcher = new MagicBellNotificationsFetcher()
  ) {
    this.store = store
    this.fetcher = fetcher
  }

  /**
   * Start the service - will automatically fetch when authenticated
   */
  start(): () => void {
    // Subscribe to auth status changes
    const unsubscribe = this.store.subscribe((state, prevState) => {
      // Start fetching when user becomes authenticated
      if (
        state.authStatus === "authenticated" &&
        prevState.authStatus !== "authenticated"
      ) {
        this.startFetching()
      }

      // Stop fetching when user loses authentication
      if (
        state.authStatus !== "authenticated" &&
        prevState.authStatus === "authenticated"
      ) {
        this.stopFetching()
      }
    })

    // If already authenticated, start immediately
    const currentState = this.store.getState()
    if (currentState.authStatus === "authenticated") {
      this.startFetching()
    }

    return () => {
      unsubscribe()
      this.stopFetching()
    }
  }

  /**
   * Manually trigger a fetch (only if authenticated) - shows loading state
   */
  async fetchNow(): Promise<void> {
    const { authStatus, getAuthToken } = this.store.getState()

    if (authStatus !== "authenticated") {
      console.log("NotificationsService: Cannot fetch - not authenticated")
      return
    }

    const token = getAuthToken()
    if (!token) {
      console.log("NotificationsService: Cannot fetch - no token")
      return
    }

    await this.performFetch(token, true) // true = show loading state
  }

  private async startFetching(): Promise<void> {
    console.log("NotificationsService: Starting notification fetching")

    const { getAuthToken } = this.store.getState()
    const token = getAuthToken()

    if (!token) {
      console.log("NotificationsService: Cannot start - no token")
      return
    }

    // Initialize client
    this.client = new Client({
      token: token,
    })

    // Fetch initial notifications with loading state
    await this.fetchNow()

    // Set up socket connection for real-time updates
    await this.setupSocketConnection()

    // Fallback: Set up polling every 5 minutes as backup
    // This ensures we don't miss notifications if socket connection fails
    this.pollInterval = setInterval(() => {
      this.pollInBackground()
    }, 300000) // 5 minutes
  }

  private async setupSocketConnection(): Promise<void> {
    if (!this.client) {
      console.error("NotificationsService: Cannot setup socket - no client")
      return
    }

    try {
      console.log("NotificationsService: Setting up socket connection")

      this.socketClient = new Socket(this.client)

      // Listen for new notifications
      this.socketClient.listen((notification: Notification) => {
        console.log(
          "NotificationsService: New notification received:",
          notification.title
        )
        this.handleNewNotification(notification)
      })

      console.log("NotificationsService: Socket connection established")
    } catch (error) {
      console.error(
        "NotificationsService: Failed to setup socket connection:",
        error
      )
      // If socket setup fails, we'll rely on the polling fallback
    }
  }

  private handleNewNotification(newNotification: Notification): void {
    const currentNotifications = this.store.getState().notifications

    // Check if this notification already exists (by ID)
    const existingIndex = currentNotifications.findIndex(
      (n) => n.id === newNotification.id
    )

    if (existingIndex >= 0) {
      // Update existing notification (e.g., read status changed)
      const updatedNotifications = [...currentNotifications]
      updatedNotifications[existingIndex] = newNotification
      this.store.getState().setNotifications(updatedNotifications)
    } else {
      // Add new notification to the beginning of the list
      this.store
        .getState()
        .setNotifications([newNotification, ...currentNotifications])
    }
  }

  private stopFetching(): void {
    console.log("NotificationsService: Stopping notification fetching")

    // Close socket connection
    if (this.socketClient) {
      try {
        this.socketClient.disconnect()
        this.socketClient = null
        console.log("NotificationsService: Socket connection closed")
      } catch (error) {
        console.error("NotificationsService: Error closing socket:", error)
      }
    }

    // Clear polling interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    // Clear client
    this.client = null

    // Clear notifications when stopping (user logged out)
    this.store.getState().setNotifications([])
  }

  /**
   * Background polling - now used as fallback only
   * Runs every 5 minutes instead of 30 seconds since socket handles real-time updates
   */
  private async pollInBackground(): Promise<void> {
    const { authStatus, getAuthToken } = this.store.getState()

    if (authStatus !== "authenticated") {
      return
    }

    const token = getAuthToken()
    if (!token) {
      return
    }

    // Only poll if socket connection is not active
    if (this.socketClient && this.socketClient.isListening()) {
      return // Socket is working fine, no need to poll
    }

    console.log(
      "NotificationsService: Running background poll (socket not active)"
    )
    await this.performFetch(token, false) // false = no loading state
  }

  /**
   * Core fetch logic
   * @param jwt - JWT token
   * @param showLoading - Whether to show loading state
   */
  private async performFetch(jwt: string, showLoading: boolean): Promise<void> {
    if (this.isLoading) {
      console.log("NotificationsService: Fetch already in progress, skipping")
      return
    }

    this.isLoading = true

    // Only set loading state for manual/initial fetches
    if (showLoading) {
      this.store.getState().setNotificationsLoading(true)
    }

    try {
      const newNotifications = await this.fetcher.fetchNotifications(jwt)

      // Check if notifications have actually changed
      const currentNotifications = this.store.getState().notifications
      const hasChanged = this.notificationsChanged(
        currentNotifications,
        newNotifications
      )

      if (hasChanged) {
        console.log(
          `NotificationsService: Fetched ${newNotifications.length} notifications (${showLoading ? "manual" : "background"})`
        )
        this.store.getState().setNotifications(newNotifications)
      } else if (showLoading) {
        // For manual fetches, still update to clear loading state
        this.store.getState().setNotifications(newNotifications)
      }
    } catch (error) {
      console.error(
        "NotificationsService: Failed to fetch notifications:",
        error
      )

      // Only show errors for manual fetches, fail silently for background polls
      if (showLoading) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to fetch notifications"
        this.store.getState().setNotificationsError(errorMessage)
      }
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Compare two notification arrays to see if they've changed
   */
  private notificationsChanged(
    current: Notification[],
    incoming: Notification[]
  ): boolean {
    if (current.length !== incoming.length) {
      return true
    }

    // Compare by ID and read status (most common changes)
    for (let i = 0; i < current.length; i++) {
      const currentItem = current[i]
      const incomingItem = incoming[i]

      if (
        currentItem.id !== incomingItem.id ||
        currentItem.readAt !== incomingItem.readAt ||
        currentItem.seenAt !== incomingItem.seenAt
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Change the fetcher implementation (useful for testing or switching APIs)
   */
  setFetcher(fetcher: NotificationsFetcher): void {
    this.fetcher = fetcher
  }

  /**
   * Get connection status for debugging
   */
  getConnectionStatus(): { socket: boolean; polling: boolean } {
    return {
      socket: this.socketClient?.isListening() || false,
      polling: this.pollInterval !== null,
    }
  }
}
