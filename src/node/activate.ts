import { getNodeStore } from "vscode-scripts"
import * as vscode from "vscode"
import { NotificationsService } from "./services/NotificationsService"
import type { State } from "../state"
import { CodeInboxConfigManager } from "./services/ConfigManager"

/**
 * Any code defined in the default export function will be executed when the extension is activated.
 * The zustand store is accessible, as well as all the vscode apis.
 */

const [store] = getNodeStore<State>()

export default function () {
  store.subscribe((state, prevState) => {
    if (state.authStatus !== prevState.authStatus) {
      const { authStatus, authConfig, authError } = state

      switch (authStatus) {
        case "loading":
          console.log("CodeInbox: Loading authentication config...")
          break

        case "authenticated":
          console.log(`CodeInbox: User authenticated as ${authConfig?.email}`)
          break

        case "unauthenticated":
          console.log("CodeInbox: User not authenticated")
          break

        case "error":
          console.log(`CodeInbox: Auth error - ${authError}`)
          break
      }
    }
  })

  const configManager = new CodeInboxConfigManager()
  const notificationsService = new NotificationsService(store)

  // Initial config load
  const loadInitialConfig = async () => {
    const {
      setAuthLoading,
      setAuthAuthenticated,
      setAuthUnauthenticated,
      setAuthError,
    } = store.getState()

    await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate loading delay

    setAuthLoading()

    try {
      const config = await configManager.loadConfig()

      if (config && configManager.isAuthenticated()) {
        console.log("CodeInbox: Initial config loaded successfully", config)
        setAuthAuthenticated(config)
      } else {
        console.log("CodeInbox: No valid config found, user unauthenticated")
        setAuthUnauthenticated()
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      setAuthError(errorMessage)
    }
  }

  // Watch for config file changes
  const configWatcher = configManager.watchConfig((config, error) => {
    const { setAuthAuthenticated, setAuthUnauthenticated, setAuthError } =
      store.getState()

    if (error) {
      setAuthError(error.message)
      return
    }

    if (config && configManager.isAuthenticated()) {
      setAuthAuthenticated(config)
    } else {
      setAuthUnauthenticated()
    }
  })

  const stopNotificationsService = notificationsService.start()

  // Load initial config
  loadInitialConfig()

  // Clean up watcher when extension deactivates
  return {
    dispose: () => {
      configWatcher.dispose()
      stopNotificationsService()
    },
  }
}
