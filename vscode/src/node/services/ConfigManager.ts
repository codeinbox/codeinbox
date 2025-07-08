import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

interface CodeInboxConfig {
  email: string
  jwt: string
}

export class CodeInboxConfigManager {
  private configPath: string
  private config: CodeInboxConfig | null = null

  constructor() {
    this.configPath = path.join(os.homedir(), ".codeinbox", "config.json")
  }

  /**
   * Load configuration from the CLI config file
   */
  async loadConfig(): Promise<CodeInboxConfig | null> {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.config = null
        return null
      }

      const configData = await fs.promises.readFile(this.configPath, "utf8")
      const config = JSON.parse(configData)
      this.config = config
      return config
    } catch (error) {
      this.config = null
      throw new Error(
        `Failed to load config: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /**
   * Check if user is authenticated (has valid JWT)
   */
  isAuthenticated(): boolean {
    return this.config !== null && !!this.config.jwt && !!this.config.email
  }

  /**
   * Get the JWT token
   */
  getToken(): string | null {
    return this.config?.jwt || null
  }

  /**
   * Get the user email
   */
  getEmail(): string | null {
    return this.config?.email || null
  }

  /**
   * Watch for changes to the config file
   * Returns a callback that will be called when config changes
   */
  watchConfig(
    callback: (config: CodeInboxConfig | null, error?: Error) => void
  ): vscode.Disposable {
    const watcher = fs.watchFile(
      this.configPath,
      { interval: 1000 },
      async () => {
        try {
          const config = await this.loadConfig()
          callback(config)
        } catch (error) {
          callback(
            null,
            error instanceof Error ? error : new Error("Unknown error")
          )
        }
      }
    )

    return new vscode.Disposable(() => {
      fs.unwatchFile(this.configPath)
    })
  }

  /**
   * Prompt user to login via CLI if not authenticated
   */
  async promptLogin(): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      "CodeInbox: Please login using the CLI tool first.",
      "Open Terminal"
    )

    if (action === "Open Terminal") {
      const terminal = vscode.window.createTerminal("CodeInbox")
      terminal.sendText("codeinbox login your-email@example.com")
      terminal.show()
    }
  }
}
