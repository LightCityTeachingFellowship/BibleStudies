"""Generate a private draft for one published LightCity archive recording."""
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import sys
from tempfile import NamedTemporaryFile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "tools/audio-library/work/transcripts"
INVENTORY = WORK.parent / "message-archive/inventory.json"
ARCHIVE_URL = "https://us-central1-perceptive-zoo-424115-j6.cloudfunctions.net/getChurchAudioArchive"


def find_recording(relative):
    relative = relative.replace("\\", "/")
    inventory = json.loads(INVENTORY.read_text(encoding="utf-8-sig"))
    for entry in inventory:
        if entry["relative"].replace("\\", "/") == relative:
            audio = Path(entry["path"])
            if audio.is_file() and audio.suffix.lower() == ".mp3":
                return sha256(relative.encode("utf-8")).hexdigest()[:32], audio
    raise SystemExit("Choose an MP3 by its exact relative path from the archive inventory.")


def published_title(recording_id):
    request = Request(ARCHIVE_URL, data=b'{"data":{}}', headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        body = json.load(response)
    for recording in (body.get("result") or body.get("data") or {}).get("recordings", []):
        if recording["id"] == recording_id:
            return recording["title"]
    raise SystemExit("This recording is not in the published archive catalogue.")


def write_draft(audio, draft):
    sys.path.insert(0, str(WORK / "packages-v1"))
    os.environ.setdefault("HF_HOME", str(WORK / "model-cache"))
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    from faster_whisper import WhisperModel

    model = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=min(os.cpu_count() or 1, 4))
    segments, _ = model.transcribe(str(audio), language="en", vad_filter=True, condition_on_previous_text=False)
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=WORK, suffix=".partial", delete=False) as output:
        temporary = Path(output.name)
        try:
            for segment in segments:
                text = segment.text.strip()
                if text:
                    seconds = int(segment.start)
                    output.write(f"[{seconds // 3600:02}:{seconds // 60 % 60:02}:{seconds % 60:02}] {text}\n")
            if output.tell() == 0:
                raise SystemExit("No speech was detected. Check the recording.")
            output.close()
            temporary.rename(draft)
        finally:
            output.close()
            temporary.unlink(missing_ok=True)


def prepare_reviewed(recording_id, draft):
    sys.path.insert(0, str(WORK / "packages-v1"))
    import yaml

    text = draft.read_text(encoding="utf-8-sig").strip()
    if not text:
        raise SystemExit("The reviewed transcript is empty.")
    catalogue = ROOT / "_data/archive_transcripts.yml"
    entries = yaml.safe_load(catalogue.read_text(encoding="utf-8")) or {}
    if not isinstance(entries, dict):
        raise SystemExit("The website transcript file is invalid.")
    entries[recording_id] = text
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=catalogue.parent, suffix=".tmp", delete=False) as output:
        temporary = Path(output.name)
        try:
            yaml.safe_dump(entries, output, allow_unicode=True, sort_keys=True)
            output.close()
            temporary.replace(catalogue)
        finally:
            output.close()
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recording", help="Exact relative MP3 path from the archive inventory")
    parser.add_argument("--prepare-reviewed", action="store_true", help="Add your reviewed draft to the website source")
    args = parser.parse_args()
    recording_id, audio = find_recording(args.recording)
    title = published_title(recording_id)
    WORK.mkdir(parents=True, exist_ok=True)
    draft = WORK / f"{recording_id}.txt"
    if args.prepare_reviewed:
        if not draft.exists():
            raise SystemExit("Generate and review the private draft first.")
        prepare_reviewed(recording_id, draft)
        print(f"Reviewed transcript for {title} is ready for the normal website commit and sync.")
        return
    if not draft.exists():
        print(f"Transcribing {title} locally", flush=True)
        write_draft(audio, draft)
    print(f"Private draft for {title} ({recording_id})\n{draft}", flush=True)


if __name__ == "__main__":
    main()
