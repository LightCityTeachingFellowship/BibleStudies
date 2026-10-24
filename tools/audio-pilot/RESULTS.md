# LightCity: measured five-recording audio pilot

**Chosen for the pilot: unchanged 128 kbps stereo AAC in M4A files.** Selection confirmed on 24 October 2026. The lower-bitrate files remain comparison samples only. `selected-audio.json` lists the five chosen files; no upload has occurred.

Input: **12.37 hours across five recordings**, **6.06 GB** of video.
All five downloaded sources use 128 kbps stereo AAC at 44.1 kHz. The original OBS setting was reported as 160 kbps; the original OBS recordings are not the files tested here.

| Audio option | Five recordings | Projected storage for 1,000 similar recordings | Approximate R2 storage/month |
|---|---:|---:|---:|
| 64 kbps AAC, mono | 367.9 MB | 73.6 GB | $0.96 |
| 96 kbps AAC, stereo | 547.2 MB | 109.4 GB | $1.50 |
| 128 kbps AAC reference, copied without re-encoding | 720.0 MB | 144.0 GB | $2.01 |

Full batch elapsed time: **11.1 minutes**, using two parallel jobs on this computer, including reference extraction, comparison clips and validation.
This is not a cloud-server benchmark. Listening quality and background playback on phones still require human/device tests.

## Validation

- All 15 full-length files contain audio without video and match the source duration within one second.
- All five reference files match the encoded audio packet hashes of their source videos.
- There are three 45-second timeline samples per version per recording (45 short clips). These positions have not been classified as speech/music.
- Original videos were retained. No media was uploaded or published.

## Listening comparison

Open `output/review.html` in a web browser. Listen to the same early/middle/late excerpt in each version, preferably with headphones. Compare words, singing and instruments, background noise and stereo width. Only one player can play at a time.

## Cost limitations

Projection assumes 1,000 recordings match the average length of these five (about 2.47 hours each). It excludes request charges, authentication/backend work, backups, tax and future growth. R2 Standard storage is calculated at $0.015/GB-month after the first 10 GB, with billable storage rounded up; this is a planning estimate, not a bill or spending cap.
Pricing source: https://developers.cloudflare.com/r2/pricing/

The 64 kbps option reduces listener data roughly by half relative to 128 kbps. The reference is the best-quality copy available from these downloads; increasing its bitrate to 160 kbps cannot restore information lost before download.
