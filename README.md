# CodeInbox

[CodeInbox](https://codeinbox.com) sends notifications from AI tools like Claude (using hooks) to Slack and other channels.

It's built by and uses [MagicBell](https://www.magicbell.com) to deliver notifications.

## Installation

Install it with Homebrew.

```
brew install codeinbox/homebrew-tap/codeinbox
```

## Setup

1. Login with your email to receive an auth token and enter it in the prompt.

```
codeinbox login {email}
```

2. Setup Slack by generating your setup URL

```
codeinbox channels setup
```

3. Follow the link and click "Enable" on the page to authenticate with Slack.

## Install the Claude hook

Open Claude and enter the /hooks prompt to add the notification hook.

```
claude
> /hooks
│ ❯ 3. Notification - When notifications are sent
❯ 1. + Add new hook…
codeinbox hook claude notification
```

The command you want to register is `codeinbox hook claude notification`

## Troubleshooting

- Check Claude's transcript with `CTRL+r`
- Try a manual trigger `echo '{"session_id":"test","transcript_path":"/tmp/test.md","message":"Test message"}' |  codeinbox hook claude notification`

## Want another hook, tool, or channel?

Please create an issue if you'd like to see a different Claude hook, AI tool, or channel.
