#!/usr/bin/env python3
import json
import os
import sys

from faster_whisper import WhisperModel


def print_json(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def main():
    if len(sys.argv) < 2:
        print_json({"error": "Audio file path is required."})
        return

    audio_path = sys.argv[1]

    if not os.path.isfile(audio_path):
        print_json({"error": "Audio file does not exist."})
        return

    model_size = os.environ.get("VOICE_TRANSCRIBE_MODEL", "medium")
    device = os.environ.get("VOICE_TRANSCRIBE_DEVICE", "cpu")
    compute_type = os.environ.get("VOICE_TRANSCRIBE_COMPUTE_TYPE", "int8")

    try:
        model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
        )
        segments, info = model.transcribe(
            audio_path,
            vad_filter=True,
            beam_size=5,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()

        print_json({
            "text": text,
            "language": getattr(info, "language", None),
            "duration": getattr(info, "duration", None),
        })
    except Exception as error:
        print(str(error), file=sys.stderr)
        print_json({"error": "Transcription failed."})


if __name__ == "__main__":
    main()
