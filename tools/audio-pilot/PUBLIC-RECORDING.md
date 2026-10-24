# Public listening test

Recording: **Mark 10-11 Reading and Commentary.** (`R42uVd9spDw`)

The ID is in the authoritative public video list. Its audio has been added to the server catalogue as public; all five member recordings retain their member visibility.

- Input: `input/R42uVd9spDw.mp4` (463,143,839 bytes).
- Upload file: `output/reference/R42uVd9spDw.m4a` (82,899,707 bytes; about 83 MB).
- Duration: 5,125.921088 seconds, about 1 hour 25 minutes 26 seconds.
- AAC 128 kbps, stereo, 44.1 kHz, copied without re-encoding.
- Encoded audio SHA-256 compared between source and output: identical. Output has exactly one audio stream, no video; duration matches within one second.
- R2 object key: `audio/R42uVd9spDw.m4a` in `lightcity-audio`.
- Upload status: user confirmed successful upload and deployed the catalogue. Guest playback was confirmed by the user. No upload or deployment was performed by the agent.

## Publish and test

1. Upload the M4A file into the existing R2 `audio` folder. Do not enable public access on the bucket.
2. From `tools/members`, deploy the updated `getChurchAudio` function using the same command as before. The catalogue ships with the function, not with GitHub Pages.
3. Open `/audio-pilot/` in an Incognito window, with no member sign-in. The public recording should appear and play; member recordings should not appear.
4. Sign in as an approved member: all six recordings should appear.
5. Test the public recording on a phone, including switching apps and locking the screen. Live website script changes, if not already synced, need the normal GitHub Pages publishing process.

The original five-recording comparison in `RESULTS.md` remains a separate measured sample; this public addition does not alter those historical measurements. Media input/output remain ignored by Git.
