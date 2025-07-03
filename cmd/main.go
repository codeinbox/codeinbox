package main

import (
	"bufio"
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"os"

	"github.com/urfave/cli/v3"
)

type Config struct {
	Email string `json:"email"`
	JWT   string `json:"jwt"`
}

func saveConfig(cfg Config) error {

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	cfgFile, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(home+"/.codeinbox/config.json", cfgFile, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

func main() {
	mgc := &cli.Command{
		Name:     "codeinbox",
		Usage:    "Notifications from AI tools (codeinbox.com)",
		Commands: make([]*cli.Command, 0),
	}

	home, err := os.UserHomeDir()
	if err != nil {
		panic(fmt.Errorf("failed to get your home directory: %w", err))
	}

	if err := os.MkdirAll(home+"/.codeinbox", 0755); err != nil {
		panic(fmt.Errorf("failed to create config directory: %w", err))
	}

	cfgFile, err := os.ReadFile(home + "/.codeinbox/config.json")
	if err != nil {
		switch os.IsNotExist(err) {
		case true:
			// Create a default config file if it doesn't exist
			dft := Config{
				Email: "",
				JWT:   "",
			}

			if err := saveConfig(dft); err != nil {
				panic(fmt.Errorf("failed to create default config file: %w", err))
			}

			cfgFile, err = json.Marshal(dft)
			if err != nil {
				panic(fmt.Errorf("failed to marshal default config: %w", err))
			}
		default:
			panic(fmt.Errorf("failed to read config file: %w", err))
		}
	}

	var usr Config
	if err := json.Unmarshal(cfgFile, &usr); err != nil {
		panic(fmt.Errorf("failed to unmarshal config file: %w", err))
	}

	apiHost := "https://api.magicbell.com"
	if host := os.Getenv("API_HOST"); host != "" {
		apiHost = host
	}

	lgnCmd := &cli.Command{
		Name:     "login",
		Usage:    "login {email}",
		Commands: make([]*cli.Command, 0),
		Arguments: []cli.Argument{
			&cli.StringArg{
				Name:        "email",
				UsageText:   "Email address to send the login code to.",
				Destination: &usr.Email,
			},
		},
		Action: cli.ActionFunc(func(ctx context.Context, c *cli.Command) error {
			if usr.Email == "" {
				return fmt.Errorf("usage: login {email}\nPlease provide an email address to send the login link to.")
			}

			eml, err := mail.ParseAddress(usr.Email)
			if err != nil {
				return fmt.Errorf("invalid email address: %s", usr.Email)
			}
			usr.Email = eml.Address

			inp := Config{
				Email: usr.Email,
			}

			b, err := json.Marshal(inp)
			if err != nil {
				return fmt.Errorf("failed to marshal input: %w", err)
			}

			req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiHost+"/v2/codeinbox/tokens", bytes.NewBuffer(b))
			if err != nil {
				return fmt.Errorf("failed to create request: %w", err)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return fmt.Errorf("failed to send request: %w", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusCreated {
				return fmt.Errorf("failed to create token, status code: %d", resp.StatusCode)
			}

			fmt.Printf("Enter Auth Code (sent to %s):\n", usr.Email)

			// scan one line of input
			scanner := bufio.NewScanner(os.Stdin)
			scanner.Split(bufio.ScanLines)
			if !scanner.Scan() {
				return fmt.Errorf("failed to read input")
			}

			authCode := scanner.Text()
			if authCode == "" {
				return fmt.Errorf("auth code cannot be empty")
			}

			cfg := Config{
				Email: usr.Email,
				JWT:   authCode,
			}
			if err := saveConfig(cfg); err != nil {
				return fmt.Errorf("failed to save config: %w", err)
			}

			fmt.Println("Login successful! Use the 'channels setup' command to configure your notification channels.")
			return nil
		}),
	}
	mgc.Commands = append(mgc.Commands, lgnCmd)

	chnsCmd := &cli.Command{
		Name:     "channels",
		Usage:    "setup notification channels",
		Commands: make([]*cli.Command, 0),
	}
	mgc.Commands = append(mgc.Commands, chnsCmd)

	chnsSetupCmd := &cli.Command{
		Name:  "setup",
		Usage: "setup channels",
		Action: cli.ActionFunc(func(ctx context.Context, c *cli.Command) error {
			if usr.Email == "" || usr.JWT == "" {
				return fmt.Errorf("please login first using the 'login' command")
			}

			pagesHost := "https://app.magicbell.com"
			if host := os.Getenv("PAGES_HOST"); host != "" {
				pagesHost = host
			}

			fmt.Printf("Please manage your notification channels at %s/codeinbox/channels?token=%s\n", pagesHost, usr.JWT)

			return nil
		}),
	}
	chnsCmd.Commands = append(chnsCmd.Commands, chnsSetupCmd)

	hookCmd := &cli.Command{
		Name:     "hook",
		Usage:    "hook {provider} {event}",
		Commands: make([]*cli.Command, 0),
	}
	mgc.Commands = append(mgc.Commands, hookCmd)

	cldHookCmd := &cli.Command{
		Name:     "claude",
		Usage:    "hook claude {hook} {event}",
		Commands: make([]*cli.Command, 0),
	}
	hookCmd.Commands = append(hookCmd.Commands, cldHookCmd)

	cldHookNtfCmd := &cli.Command{
		Name:  "notification",
		Usage: "Send a notification to Claude",
		Action: cli.ActionFunc(func(ctx context.Context, c *cli.Command) error {
			if usr.Email == "" || usr.JWT == "" {
				return fmt.Errorf("please login first using the 'login' command")
			}

			scanner := bufio.NewScanner(os.Stdin)
			scanner.Split(bufio.ScanLines)

			var lines string
			for scanner.Scan() {
				line := scanner.Text()
				if line == "" {
					break
				}
				lines += line + "\n"
			}

			if err := scanner.Err(); err != nil {
				return fmt.Errorf("failed to read input: %w", err)
			}

			req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiHost+"/v2/codeinbox/hooks/claude", bytes.NewBuffer([]byte(lines)))
			if err != nil {
				return fmt.Errorf("failed to create request: %w", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+usr.JWT)

			rsp, err := http.DefaultClient.Do(req)
			if err != nil {
				return fmt.Errorf("failed to send request: %w", err)
			}
			defer rsp.Body.Close()

			if rsp.StatusCode != http.StatusCreated {
				b, err := io.ReadAll(rsp.Body)
				if err != nil {
					return fmt.Errorf("failed to read response body: %w", err)
				}

				return fmt.Errorf("failed to trigger Claude hook, code[%d] body[%s]", rsp.StatusCode, string(b))
			}

			return nil
		}),
	}
	cldHookCmd.Commands = append(cldHookCmd.Commands, cldHookNtfCmd)

	if err := mgc.Run(context.Background(), os.Args); err != nil {
		fmt.Println(err)
	}
}
