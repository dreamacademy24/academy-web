"""Install five approved-reference Qwen intro clips; never synthesize speech.

Inputs: artifacts/free-voice/intro/intro-01.wav through intro-05.wav.
Run only after all five generated clips have been reviewed. The default run
refuses to replace a previous installation with different inputs or outputs.
Use --replace-installed for an intentional revision; the original backup stays.
Use --check to validate and preview timing without writing any files.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import os
import sys
import tempfile
import wave
from array import array
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = ROOT / "artifacts/free-voice/intro"
PUBLIC_DIR = ROOT / "public/learning/tree-house"
TIMELINE_PATH = ROOT / "scripts/dreamy-intro-timeline.json"
VTT_PATH = PUBLIC_DIR / "dreamy-intro.ko.vtt"
REFERENCE_PATH = ROOT / "artifacts/free-voice/dreamy-qwen-greeting.wav"
REFERENCE_REQUEST = ROOT / "artifacts/free-voice/qwen-greeting-request.json"
BACKUP_DIR = ROOT / "artifacts/free-voice/previous-intro"
RECEIPT_PATH = ROOT / "artifacts/free-voice/intro-install.json"
MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
REFERENCE_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
SAMPLE_RATE = 24000
THRESHOLD = 80  # PCM16 amplitude: only quiet edges, never internal pauses.
LEADING_PAD = 0.012
TRAILING_PAD = 0.080
PROCESSING = {
    "trimOnly": True,
    "silenceThresholdPcm16": THRESHOLD,
    "leadingPaddingSeconds": LEADING_PAD,
    "trailingPaddingSeconds": TRAILING_PAD,
    "internalPausesPreserved": True,
    "speedChanged": False,
    "pitchChanged": False,
    "sampleRateChanged": False,
}


class AssemblyError(Exception):
    pass


def checked(path: Path) -> Path:
    resolved = path.resolve()
    if not resolved.is_relative_to(ROOT):
        raise AssemblyError(f"Path is outside this project: {path}")
    return resolved


def relative(path: Path) -> str:
    return checked(path).relative_to(ROOT).as_posix()


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def read_json(path: Path) -> dict:
    try:
        value = json.loads(checked(path).read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise AssemblyError(f"Cannot read JSON {relative(path)}: {exc}") from exc
    if not isinstance(value, dict):
        raise AssemblyError(f"Expected a JSON object in {relative(path)}")
    return value


def pcm_from_wave(path: Path) -> tuple[bytes, bytes]:
    original = checked(path).read_bytes()
    try:
        with wave.open(io.BytesIO(original), "rb") as audio:
            if (audio.getframerate(), audio.getnchannels(), audio.getsampwidth(), audio.getcomptype()) != (SAMPLE_RATE, 1, 2, "NONE"):
                raise AssemblyError(f"Expected 24kHz mono PCM16 WAV: {relative(path)}")
            frame_count = audio.getnframes()
            if frame_count <= 0:
                raise AssemblyError(f"Empty audio: {relative(path)}")
            pcm = audio.readframes(frame_count)
            if len(pcm) != frame_count * 2:
                raise AssemblyError(f"Truncated audio: {relative(path)}")
    except (wave.Error, EOFError) as exc:
        raise AssemblyError(f"Invalid WAV {relative(path)}: {exc}") from exc
    return original, pcm


def trim_edges(pcm: bytes) -> tuple[bytes, dict]:
    samples = array("h")
    samples.frombytes(pcm)
    if sys.byteorder != "little":
        samples.byteswap()
    first = next((i for i, value in enumerate(samples) if abs(value) >= THRESHOLD), None)
    if first is None:
        raise AssemblyError("An input clip contains only silence; no files were installed.")
    last = next(i for i in range(len(samples) - 1, first - 1, -1) if abs(samples[i]) >= THRESHOLD)
    start = max(0, first - round(SAMPLE_RATE * LEADING_PAD))
    stop = min(len(samples), last + 1 + round(SAMPLE_RATE * TRAILING_PAD))
    # A contiguous byte slice preserves every speech sample and internal pause.
    trimmed = pcm[start * 2:stop * 2]
    return trimmed, {
        "originalFrames": len(samples),
        "installedFrames": stop - start,
        "trimmedStartFrames": start,
        "trimmedEndFrames": len(samples) - stop,
        "leadingSilence": round((first - start) / SAMPLE_RATE, 6),
        "trailingSilence": round((stop - last - 1) / SAMPLE_RATE, 6),
    }


def wave_bytes(pcm: bytes) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        audio.writeframes(pcm)
    return output.getvalue()


def vtt_time(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{milliseconds:03}"


def atomic_write(path: Path, data: bytes) -> None:
    path = checked(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def backup_once(paths: list[Path]) -> None:
    checked(BACKUP_DIR)
    manifest_path = BACKUP_DIR / "backup-manifest.json"
    if manifest_path.exists():
        manifest = read_json(manifest_path)
        for item in manifest.get("files", []):
            if item["existed"]:
                backup = checked(BACKUP_DIR / item["path"])
                if not backup.is_relative_to(BACKUP_DIR.resolve()) or digest(backup.read_bytes()) != item["sha256"]:
                    raise AssemblyError("Original backup is incomplete or changed. Review it before reinstalling.")
        return
    if BACKUP_DIR.exists() and any(BACKUP_DIR.iterdir()):
        raise AssemblyError("The backup folder is non-empty without a manifest. It will not be overwritten.")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for path in paths:
        item = {"path": relative(path), "existed": path.exists()}
        if path.exists():
            original = path.read_bytes()
            atomic_write(BACKUP_DIR / item["path"], original)
            item["sha256"] = digest(original)
        files.append(item)
    atomic_write(manifest_path, json_bytes({
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "description": "Original intro before approved Qwen voice installation; keep this snapshot unchanged.",
        "files": files,
    }))


def inspect_installed() -> dict:
    """Read current media and any receipt/backup, without creating directories."""
    files = {}
    for index in range(1, 6):
        path = PUBLIC_DIR / f"intro-voice-{index:02}.wav"
        if not checked(path).is_file():
            files[relative(path)] = {"exists": False}
            continue
        original, pcm = pcm_from_wave(path)
        files[relative(path)] = {"exists": True, "sha256": digest(original), "durationSeconds": round(len(pcm) / (SAMPLE_RATE * 2), 6)}
    receipt_matches = None
    if RECEIPT_PATH.exists():
        outputs = read_json(RECEIPT_PATH).get("outputs")
        expected_paths = set(files) | {relative(TIMELINE_PATH), relative(VTT_PATH)}
        if not isinstance(outputs, dict) or set(outputs) != expected_paths:
            raise AssemblyError("Installed receipt has an unexpected output list.")
        receipt_matches = all(checked(ROOT / path).is_file() and digest(checked(ROOT / path).read_bytes()) == sha for path, sha in outputs.items())
    backup_manifest = BACKUP_DIR / "backup-manifest.json"
    backup_state = "not-created"
    if backup_manifest.exists():
        items = read_json(backup_manifest).get("files")
        expected_paths = set(files) | {relative(TIMELINE_PATH), relative(VTT_PATH)}
        if not isinstance(items, list) or any(not isinstance(item, dict) for item in items) or len(items) != len(expected_paths) or {item.get("path") for item in items} != expected_paths:
            raise AssemblyError("Original backup manifest has an unexpected file list.")
        for item in items:
            backup = checked(BACKUP_DIR / item["path"])
            if not backup.is_relative_to(BACKUP_DIR.resolve()) or not isinstance(item.get("existed"), bool):
                raise AssemblyError("Original backup manifest is invalid.")
            if item["existed"] and (not backup.is_file() or digest(backup.read_bytes()) != item.get("sha256")):
                raise AssemblyError("Original backup is incomplete or changed.")
        backup_state = "verified"
    elif BACKUP_DIR.exists() and any(BACKUP_DIR.iterdir()):
        raise AssemblyError("The backup folder is non-empty without a manifest.")
    return {"audio": files, "captionsExist": checked(VTT_PATH).is_file(), "receiptExists": RECEIPT_PATH.exists(), "receiptMatchesCurrentFiles": receipt_matches, "backup": backup_state}


def verify_request(input_path: Path, cue: dict, reference_hash: str) -> None:
    """Optional request-record check; fail explicitly for unknown schemas."""
    request_path = input_path.with_suffix(".request.json")
    source = read_json(request_path).get("source")
    if not isinstance(source, dict) or not isinstance(source.get("text"), str) or not isinstance(source.get("referenceHash"), str):
        raise AssemblyError(f"Expected source.text and source.referenceHash in {relative(request_path)}; review any new browser-record schema first.")
    if source["text"] != cue["text"] or source["referenceHash"] != reference_hash:
        raise AssemblyError(f"Request text or approved reference hash does not match: {relative(request_path)}")


def assemble(replace_installed: bool, check_only: bool = False, verify_requests: bool = False) -> dict:
    inputs = [INPUT_DIR / f"intro-{index:02}.wav" for index in range(1, 6)]
    required = [TIMELINE_PATH, REFERENCE_PATH, REFERENCE_REQUEST] + ([] if check_only else inputs)
    missing = [relative(path) for path in required if not checked(path).is_file()]
    if missing:
        raise AssemblyError("Nothing installed. Required files are missing: " + ", ".join(missing))

    timeline = copy.deepcopy(read_json(TIMELINE_PATH))
    cues = timeline.get("cues")
    if not isinstance(cues, list) or len(cues) != 5:
        raise AssemblyError("The existing timeline must contain exactly five cues.")
    for index, cue in enumerate(cues, 1):
        if not isinstance(cue, dict) or cue.get("id") != f"intro-{index:02}" or not isinstance(cue.get("text"), str) or not cue["text"].strip() or not isinstance(cue.get("speech"), list) or not isinstance(cue.get("scene"), str):
            raise AssemblyError(f"Unexpected existing timeline cue {index}; no files were installed.")
    request = read_json(REFERENCE_REQUEST)
    reference_text = request.get("text")
    if not isinstance(reference_text, str) or not reference_text.strip():
        raise AssemblyError("Approved reference request must contain its original text.")
    reference_original, _ = pcm_from_wave(REFERENCE_PATH)
    reference_hash = digest(reference_original)

    installation = inspect_installed() if check_only else None
    missing_inputs = [relative(path) for path in inputs if not checked(path).is_file()]
    if check_only and missing_inputs:
        available = []
        for cue, path in zip(cues, inputs):
            if not checked(path).is_file():
                continue
            original, pcm = pcm_from_wave(path)
            trimmed, trim_info = trim_edges(pcm)
            if verify_requests:
                verify_request(path, cue, reference_hash)
            available.append({"path": relative(path), "sha256": digest(original), "audioDuration": round(len(trimmed) / (SAMPLE_RATE * 2), 6), **trim_info})
        return {"status": "incomplete", "readOnly": True, "missingInputs": missing_inputs, "availableInputs": available, "requestsVerified": verify_requests, "installation": installation, "expectedTimeline": None}

    if verify_requests:
        for cue, path in zip(cues, inputs):
            verify_request(path, cue, reference_hash)

    # Complete every input/format check before any backup or destination write.
    validated = [pcm_from_wave(path) for path in inputs]
    prepared = [trim_edges(pcm) for _, pcm in validated]
    outputs: dict[Path, bytes] = {}
    source_records = []
    subtitles = ["WEBVTT", ""]
    cursor = 0.0
    for index, (cue, input_path, source, processed) in enumerate(zip(cues, inputs, validated, prepared), 1):
        pcm, trim_info = processed
        duration = len(pcm) / (SAMPLE_RATE * 2)
        start = round(cursor, 6)
        audio_start = round(start + 0.04, 6)
        audio_end = round(audio_start + duration, 6)
        end = round(audio_end + (1.0 if index == 5 else 0.35), 6)
        destination = PUBLIC_DIR / f"intro-voice-{index:02}.wav"
        outputs[checked(destination)] = wave_bytes(pcm)
        cue.update({
            "start": start, "end": end,
            "audioSrc": f"/learning/tree-house/intro-voice-{index:02}.wav",
            "audioStart": audio_start, "audioDuration": round(duration, 6), "audioEnd": audio_end,
            "leadingSilence": trim_info["leadingSilence"],
        })
        subtitles.extend([
            cue["id"],
            f"{vtt_time(audio_start)} --> {vtt_time(min(end - 0.04, audio_end + 0.2))}",
            cue["text"], "",
        ])
        source_records.append({"path": relative(input_path), "sha256": digest(source[0]), **trim_info})
        cursor = end

    voice = {
        "name": "Dreamy approved Qwen reference", "engine": "Qwen3-TTS",
        "model": MODEL, "speed": "normal", "speedChanged": False, "pitchChanged": False,
        "referenceSha256": reference_hash,
    }
    timeline.update({
        "version": 3, "durationSeconds": round(cursor, 6),
        "sampleRate": SAMPLE_RATE, "channels": 1, "bitsPerSample": 16,
        "voices": {"ko": copy.deepcopy(voice), "en": copy.deepcopy(voice)},
        "narration": {
            "source": "Qwen official free demo / generate_voice_clone",
            "assemblyScript": "scripts/assemble-dreamy-qwen-intro.py",
            "windowsNarrationScriptApplies": False,
            "model": MODEL, "referenceModel": REFERENCE_MODEL,
            "referencePath": relative(REFERENCE_PATH), "referenceSha256": reference_hash,
            "referenceText": reference_text, "languageForMixedSpeech": "Auto",
            "processing": PROCESSING,
        },
    })
    outputs[checked(VTT_PATH)] = ("\n".join(subtitles) + "\n").encode("utf-8")
    outputs[checked(TIMELINE_PATH)] = json_bytes(timeline)
    expected_hashes = {relative(path): digest(data) for path, data in outputs.items()}
    input_hashes = {item["path"]: item["sha256"] for item in source_records}

    if check_only:
        previous = read_json(RECEIPT_PATH) if RECEIPT_PATH.exists() else None
        identical = previous is not None and previous.get("inputs") == input_hashes and previous.get("outputs") == expected_hashes
        current = all(path.is_file() and digest(path.read_bytes()) == expected_hashes[relative(path)] for path in outputs)
        return {
            "status": "checked", "readOnly": True, "requestsVerified": verify_requests,
            "installation": installation, "inputs": source_records, "expectedOutputHashes": expected_hashes,
            "expectedTimeline": {"version": 3, "durationSeconds": cursor, "sampleRate": SAMPLE_RATE, "channels": 1, "bitsPerSample": 16, "cues": cues},
            "alreadyInstalled": identical and current, "requiresReplaceInstalled": previous is not None and not (identical and current),
        }

    if RECEIPT_PATH.exists():
        previous = read_json(RECEIPT_PATH)
        identical = previous.get("inputs") == input_hashes and previous.get("outputs") == expected_hashes
        current = all(path.exists() and digest(path.read_bytes()) == expected_hashes[relative(path)] for path in outputs)
        if identical and current:
            return {"status": "already-installed", "durationSeconds": cursor, "message": "Identical approved clips are already installed; no files changed."}
        if not replace_installed:
            raise AssemblyError("A Qwen intro was installed previously. Review the new clips, then use --replace-installed for an intentional revision. The original backup will stay unchanged.")
        print("Replacing the installed Qwen clips; preserving the original one-time backup.", file=sys.stderr)

    backup_once(list(outputs))
    receipt = {
        "installedAt": datetime.now(timezone.utc).isoformat(), "version": 3,
        "model": MODEL, "referenceSha256": reference_hash,
        "durationSeconds": cursor, "inputs": input_hashes, "outputs": expected_hashes,
        "processing": PROCESSING, "clips": source_records,
        "backupPath": relative(BACKUP_DIR),
    }
    writes = {**outputs, checked(RECEIPT_PATH): json_bytes(receipt)}
    originals = {path: path.read_bytes() if path.exists() else None for path in writes}
    written = []
    try:
        for path, data in writes.items():
            atomic_write(path, data)
            written.append(path)
    except Exception as exc:
        rollback_errors = []
        for path in reversed(written):
            try:
                if originals[path] is None:
                    checked(path).unlink(missing_ok=True)
                else:
                    atomic_write(path, originals[path])
            except OSError as rollback_error:
                rollback_errors.append(str(rollback_error))
        detail = f" Rollback errors: {rollback_errors}. Restore from {relative(BACKUP_DIR)}." if rollback_errors else " Previous installed files were restored."
        raise AssemblyError(f"Installation failed: {exc}.{detail}") from exc
    return {"status": "installed", "durationSeconds": cursor, "clips": 5, "backup": relative(BACKUP_DIR), "receipt": relative(RECEIPT_PATH), "speedChanged": False, "pitchChanged": False}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replace-installed", action="store_true", help="Allow an intentional revision after reviewing all five new clips; preserve the original backup.")
    parser.add_argument("--check", action="store_true", help="Validate existing installation and available inputs; preview the complete timeline when all five inputs exist. Never write files.")
    parser.add_argument("--verify-requests", action="store_true", help="Also require each input's .request.json source.text and source.referenceHash to match the timeline and approved reference.")
    arguments = parser.parse_args()
    if arguments.check and arguments.replace_installed:
        parser.error("--check and --replace-installed cannot be combined.")
    try:
        result = assemble(arguments.replace_installed, arguments.check, arguments.verify_requests)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2 if result["status"] == "incomplete" else 0
    except (AssemblyError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
