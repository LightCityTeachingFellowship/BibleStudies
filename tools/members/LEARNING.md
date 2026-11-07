# Selected teaching trial

The trial covers three teachings, not the backlog. The first selected teaching is
`l6wvIBr4fnA` — **What Does It Mean To Be Saved?**, Sunday 4 October 2026.
The other two are reserved for upcoming teachings chosen by the administrator.

## Private setup

Run `setup-learning-ai.ps1` in PowerShell. Paste the OpenAI API key only at its
hidden prompt. It is stored in Firebase Secret Manager, never the browser,
repository or a local key file. This step does not enable processing or charge
the API. Deploy the learning services with `deploy-learning.ps1 -IncludeAI` once
the key is stored. The default deployment excludes paid AI services.

## Studio workflow

In **Content library → Teaching summaries & quizzes**:

1. Set a monthly allowance (initial trial: US $5) and enable selected processing.
2. Choose the teaching and its actual ending time. Matching recorded audio must
   already be registered. Do not choose worship-only streams or every recording.
3. Prepare drafts. One transcript is retained privately and reused for both drafts.
4. Review and edit each draft; save edits before approving release.
5. Summary release waits until three hours after the teaching ends AND approval.
   Quiz release waits until one hour after the summary actually publishes AND
   approval. Late approval releases on the next scheduler check.
6. Pause processing whenever desired. Approval and release work without further AI
   spending. No resource is published merely because its draft is generated.

The initial trial is limited on the server to three distinct paid teachings.
Retries of completed paid steps reuse cached results. A request with an uncertain
outcome is held rather than automatically charged again. Check its provider usage
before reconciling it. Failed requests may still consume provider credit.

The allowance counts estimates and reservations before sending new requests. It
is not a guaranteed provider billing cap. The allowance month uses Nigeria time;
the three-teaching trial limit does not reset with the month. Cloud hosting costs
are separate. The first historical teaching's end-of-day date is used solely as
an already-elapsed eligibility boundary; upcoming teachings use their actual end.

## Privacy, existing quizzes and results

Generated resources follow their source video's current public/member access.
Changing access is silent. Removing the source blocks access to its linked
resources. Test-only videos are not released as public/member learning resources.
Drafts, transcripts, usage, correct answers and personal scores are stored under
the existing client-denied `churchVideoActivity` root. Verified server endpoints
enforce the current audience and account.

Existing quiz content remains public and is not regenerated. Regenerate the
private catalogue and answer-free public index with `python prepare-quizzes.py`
after editing an existing quiz. Themes and font controls stay in the original
quiz engine. Signed-in progress and results sync; visitors keep device progress.
The private Studio ranking uses the first completed score, with best score and
attempt count shown separately. Repeated submission of one attempt is idempotent.

## Checks

`node tools/test-learning.mjs` exercises opt-in processing, reservations, cached
requests, approval timing, audience changes, account isolation and scoring using
mocked AI responses. It makes no paid AI requests.
