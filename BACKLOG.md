# Backlog

## To confirm
- [ ] `TURSO_DATABASE_URL` is actually set in Vercel and the production 500 error is resolved
- [ ] Trello integration env vars set (`TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_LIST_ID`) and sync confirmed working
- [ ] Sheets integration env var set (`SHEETS_CSV_URL`), Slack/email -> Sheets automation built on the work side, sync confirmed working
- [ ] Check Vercel plan tier for cron throttling (Hobby = once/day max) and adjust schedule or add a manual "Sync Now" button if needed
- [ ] Glass redesign patch applied/pushed, checked in both light and dark OS mode

## To do
- [ ] Swap PWA icon (`pwa-192.png` / `pwa-512.png`) for the new calendar/checkmark logo provided by the user — needs the source image as a URL or committed to the repo, since it can't be pulled from a chat attachment directly

## Possible later
- [ ] Direct Slack/email integration (skipped in favor of the Sheets workaround due to OAuth/admin approval friction on work tenant)
