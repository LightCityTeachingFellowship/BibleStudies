# Service countdown

`/Welcome/` is a dedicated viewer screen. `/Welcome/?display=obs` is the same screen with Nigeria time fixed and the screen controls hidden, suitable for a 1920 × 1080 OBS Browser Source. No OBS settings or scene changes are automated. An OBS broadcast contains one rendered image, so its clock cannot vary per viewer; the direct website screen shows each viewer's device timezone.

Studio > Service countdown controls weekly days/times, welcome wording and a one-time changed service. All saved service times use Africa/Lagos (WAT), independent of the admin device's timezone. Initial times come from the existing Meeting Days page: Sunday 08:00, Monday 18:00 and Wednesday 17:30. Confirm these in Studio before using the screen for a service. This feature does not modify the existing Meeting Days page.

A one-time service temporarily takes precedence over the regular countdown, then the weekly schedule resumes. After zero the screen keeps the starting message for the configured period (30 minutes initially), then selects the next scheduled service. Disabling all weekly entries and clearing the one-time service shows an announcement placeholder, not an invented time. Overlapping services select the earliest service still in its starting-message period.

The countdown targets a single absolute instant for everyone. Local service date/time is primary, Nigeria time secondary. Nigeria is omitted when the viewer's zone has Nigeria's UTC offset **at that service's start**, including zones that match only seasonally. Device timezone rules account for daylight-saving changes and date boundaries. The viewer must use the timezone they want on their device; location permission is not requested.

The public GET function exposes only the schedule and server time. Admin changes require the existing verified Studio admin account. Revision checks reject conflicting edits from another device. The public screen checks every 20 seconds while visible, updates digits without reloading, compensates for device clock differences using server time, and refreshes on return from background. Offline cached schedules are labelled and retained for at most 24 hours; they are never invented from defaults if first loading fails.

Deploy `tools/members/deploy-service-countdown.ps1`, then commit/sync the website files. No new secret, API key or Windows installer is needed. Tests: `node tools/test-service-countdown.mjs`.
