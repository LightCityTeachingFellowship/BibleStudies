# Background helper recovery

The recorded-audio and Studio TXT-list helpers are separate Windows tasks. A stale audio runtime-status or Studio baseline proves that successful work is no longer being recorded, but does not by itself identify why a process exited. Previously, configuration/decryption failures could escape the audio wrapper's retry loop, Studio had no wrapper retry, the Windows tasks had only sign-in triggers plus three failure retries, and early exits were not logged reliably.

Run `tools/repair-background-helpers.ps1` from normal Windows PowerShell under the account used for setup. It validates the existing local Audio Queue configuration, updates both existing tasks, and starts them. It does not prompt for keys, deploy Firebase, download YouTube media, enable backlog downloads, reset queues or change OBS. Active scheduled tasks are not killed; updated code takes effect on the next start. If either registration fails, the command reports that helper as failed rather than claiming both were installed.

Each task now has an at-logon trigger and a repeating three-minute trigger without an expiry duration. IgnoreNew blocks duplicate task launches; a per-work-folder named mutex also blocks duplicate wrapper processes. There is no scheduled execution time limit, and switching to battery does not stop the tasks. The repeating trigger starts a stopped task; it does not kill a running task or a slow upload. The wrappers retry errors during configuration, decryption and worker execution after 30 seconds, including an unexpected clean exit. A one-time audio `-Once` run still fails immediately when appropriate.

`stop-automatic.ps1` deliberately disables audio startup and records `supervisor-disabled.json`; recovery respects that flag. `start-local.ps1` enables it again explicitly. The existing YouTube-download pause remains separate and is ignored only by validated local-file mode, as before. Signing out, switching the computer off or putting it to sleep prevents processing; these helpers do not run as a cloud service or bypass Windows power settings.

`tools/check-background-helpers.ps1` shows task status when accessible, the worker heartbeat age and recovery state. It does not call an old heartbeat 'healthy' just because its saved state says running. Each helper writes:

- `supervisor.log`: bounded, redacted start/exit/error records, with native stderr captured safely by Windows PowerShell.
- `supervisor-status.json`: wrapper state, attempt count and wrapper process ID.
- `process-status.json`: worker process ID and a heartbeat approximately every ten seconds, including while waiting for network or processing media. Studio also reports its current phase and last successful sync time.

These files stay under the ignored `tools/audio-library/work/automatic-recorded` and `tools/audio-library/work/studio-sync` folders. Existing audio receipts, source-cleanup verification, local-list locks and local-removal protections remain in place. There is no blind deletion of lock files or termination of unrelated processes.

Verification: run `tools/test-helper-recovery.ps1` and `tools/test-helper-startup.ps1` with Windows PowerShell, plus `node tools/test-helper-heartbeat.mjs`. Recovery tests inject setup failures, exit errors, unexpected clean exits and deliberate pauses, test two processes against one mutex, and check log redaction. Startup tests mock the scheduler and verify the registration parameters without changing installed tasks. Real registration must be confirmed by the repair and health commands in the normal Windows session.
