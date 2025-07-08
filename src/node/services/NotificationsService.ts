import type { Store } from "../../state"
import { Client, Notification } from "magicbell-js/user-client"

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

    // Fetch immediately with loading state
    await this.fetchNow()

    // Set up polling every 30 seconds (silent updates)
    this.pollInterval = setInterval(() => {
      this.pollInBackground()
    }, 30000)
  }

  private stopFetching(): void {
    console.log("NotificationsService: Stopping notification fetching")

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    // Clear notifications when stopping (user logged out)
    this.store.getState().setNotifications([])
  }

  /**
   * Background polling - silent, no loading state, only update if changed
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
}
