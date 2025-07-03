# CodeInbox

CodeInbox sends notifications from AI tools like Claude (using hooks) to Slack and other channels.

It's built by and uses [MagicBell](https://www.magicbell.com) for delivering notifications.

## Installation

Install it with Homebrew

```
brew install codeinbox/homebrew-tap/codeinbox
```

## Setup

Login with your email to receive an auth token and enter it:

```
codeinbox login {email}
```

Finally, setup Slack by generating your setup URL

```
codeinbox channels setup
```

## Install the Claude hook

Open Claude and enter the /hooks prompt

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
