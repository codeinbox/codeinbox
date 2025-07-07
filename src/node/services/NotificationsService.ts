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
   * Manually trigger a fetch (only if authenticated)
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

    await this.performFetch(token)
  }

  private async startFetching(): Promise<void> {
    console.log("NotificationsService: Starting notification fetching")

    // Fetch immediately
    await this.fetchNow()

    // Set up polling every 30 seconds
    this.pollInterval = setInterval(() => {
      this.fetchNow()
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

  private async performFetch(jwt: string): Promise<void> {
    if (this.isLoading) {
      console.log("NotificationsService: Fetch already in progress, skipping")
      return
    }

    this.isLoading = true

    // Set loading state
    this.store.getState().setNotificationsLoading(true)

    try {
      console.log("NotificationsService: Fetching notifications...")
      const notifications = await this.fetcher.fetchNotifications(jwt)

      console.log(
        `NotificationsService: Fetched ${notifications.length} notifications`
      )
      this.store.getState().setNotifications(notifications)
    } catch (error) {
      console.error(
        "NotificationsService: Failed to fetch notifications:",
        error
      )
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch notifications"
      this.store.getState().setNotificationsError(errorMessage)
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Change the fetcher implementation (useful for testing or switching APIs)
   */
  setFetcher(fetcher: NotificationsFetcher): void {
    this.fetcher = fetcher
  }
}
