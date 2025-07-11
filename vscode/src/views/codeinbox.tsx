import React from "react"
import { useStore } from "zustand"
import { getChromiumStore } from "vscode-scripts"

import { State } from "../state"

import styles from "./box.module.css"

const [_store, vscode] = getChromiumStore<State>()

export default function Box() {
  const store = useStore(_store)

  const formatTimeAgo = (sentAt: string | Date | null): string => {
    if (!sentAt) return "Unknown time"

    const now = new Date()
    const sent = new Date(sentAt)
    const diffMs = now.getTime() - sent.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return sent.toLocaleDateString()
  }

  const getCategoryColor = (category: string | undefined): string => {
    const colors: Record<string, string> = {
      "claude-code": "#8B5CF6",
      git: "#F97316",
      security: "#EF4444",
      build: "#10B981",
      deploy: "#3B82F6",
      default: "#6B7280",
    }
    return colors[category || "default"] || colors.default
  }

  const getCategoryIcon = (
    title: string | undefined,
    category: string | undefined
  ): string => {
    if (title?.toLowerCase().includes("claude")) return "🤖"
    if (title?.toLowerCase().includes("git")) return "🔄"
    if (title?.toLowerCase().includes("security")) return "🔒"
    if (title?.toLowerCase().includes("build")) return "🔨"
    if (title?.toLowerCase().includes("deploy")) return "🚀"
    return "📋"
  }

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  // Auth loading state
  if (store.authStatus === "loading") {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.logoSection}>
              <div className={styles.logo}>📨</div>
              <h1 className={styles.title}>CodeInbox</h1>
            </div>
          </div>
          <div className={styles.headerGradient}></div>
        </div>
        <div className={styles.content}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⏳</div>
            <h3>Loading...</h3>
            <p>Checking authentication status</p>
          </div>
        </div>
      </div>
    )
  }

  // Auth error state
  if (store.authStatus === "error") {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.logoSection}>
              <div className={styles.logo}>📨</div>
              <h1 className={styles.title}>CodeInbox</h1>
            </div>
          </div>
          <div className={styles.headerGradient}></div>
        </div>
        <div className={styles.content}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>❌</div>
            <h3>Authentication Error</h3>
            <p>{store.authError || "Failed to load authentication"}</p>
            <div style={{ marginTop: "16px" }}>
              <button
                onClick={() =>
                  copyToClipboard(
                    "brew install codeinbox/homebrew-tap/codeinbox"
                  )
                }
                style={{
                  background: "#007ACC",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                Copy install command
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Not authenticated - show CLI installation prompt
  if (store.authStatus === "unauthenticated") {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.logoSection}>
              <div className={styles.logo}>📨</div>
              <h1 className={styles.title}>CodeInbox</h1>
            </div>
          </div>
          <div className={styles.headerGradient}></div>
        </div>
        <div className={styles.content}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🚀</div>
            <h3>Get Started with CodeInbox</h3>
            <p>
              Install the CodeInbox CLI tool to receive notifications from AI
              tools
            </p>

            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                backgroundColor: "#1e1e1e",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "14px",
                color: "#d4d4d4",
                position: "relative",
              }}
            >
              <div style={{ marginBottom: "8px", color: "#6B7280" }}>
                Install via Homebrew:
              </div>
              <code>brew install codeinbox/homebrew-tap/codeinbox</code>
              <button
                onClick={() =>
                  copyToClipboard(
                    "brew install codeinbox/homebrew-tap/codeinbox"
                  )
                }
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "8px",
                  background: "transparent",
                  border: "1px solid #404040",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: "#d4d4d4",
                  fontSize: "12px",
                }}
              >
                Copy
              </button>
            </div>

            <div
              style={{ marginTop: "16px", fontSize: "14px", color: "#6B7280" }}
            >
              After installation, run:
            </div>
            <div
              style={{
                marginTop: "8px",
                padding: "12px",
                backgroundColor: "#1e1e1e",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "14px",
                color: "#d4d4d4",
                position: "relative",
              }}
            >
              <code>codeinbox login your-email@example.com</code>
              <button
                onClick={() =>
                  copyToClipboard("codeinbox login your-email@example.com")
                }
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "8px",
                  background: "transparent",
                  border: "1px solid #404040",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  color: "#d4d4d4",
                  fontSize: "12px",
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Authenticated - show the main notifications UI
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logoSection}>
            <div className={styles.logo}>📨</div>
            <h1 className={styles.title}>CodeInbox</h1>
          </div>
          <div className={styles.badge}>
            {store.notifications.length} notifications
          </div>
        </div>
        {store.authConfig && (
          <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px" }}>
            Logged in as {store.authConfig.email}
          </div>
        )}
        <div className={styles.headerGradient}></div>
      </div>

      <div className={styles.content}>
        {store.notificationsLoading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔄</div>
            <h3>Loading notifications...</h3>
            <p>Fetching your latest updates</p>
          </div>
        ) : store.notificationsError ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>❌</div>
            <h3>Failed to load notifications</h3>
            <p>{store.notificationsError}</p>
            <button
              onClick={() => {
                // Trigger manual refresh
                vscode("refreshNotifications", [])
              }}
              style={{
                marginTop: "16px",
                background: "#007ACC",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        ) : store.notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>✨</div>
            <h3>All caught up!</h3>
            <p>No new notifications to show</p>
          </div>
        ) : (
          <div className={styles.notificationsList}>
            {store.notifications.map((n) => {
              const sent_at = n.sentAt ? new Date(n.sentAt) : null
              const isUnread = !n.readAt
              const categoryColor = getCategoryColor(n.category || undefined)
              const icon = getCategoryIcon(n.title, n.category || undefined)

              return (
                <div
                  key={n.id}
                  className={`${styles.notification} ${isUnread ? styles.unread : styles.read}`}
                  onClick={() => {
                    vscode("window.showInformationMessage", [
                      `Notification clicked: ${n.title}`,
                    ])
                  }}
                >
                  <div className={styles.notificationHeader}>
                    <div className={styles.notificationMeta}>
                      <span className={styles.icon}>{icon}</span>
                      <div className={styles.titleSection}>
                        <span className={styles.notificationTitle}>
                          {n.title}
                        </span>
                        {n.category && (
                          <span
                            className={styles.category}
                            style={{
                              backgroundColor: `${categoryColor}20`,
                              color: categoryColor,
                            }}
                          >
                            {n.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.timestamp}>
                      {formatTimeAgo(sent_at)}
                    </div>
                  </div>

                  <div className={styles.notificationContent}>{n.content}</div>

                  <div
                    className={styles.categoryStripe}
                    style={{ backgroundColor: categoryColor }}
                  ></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
