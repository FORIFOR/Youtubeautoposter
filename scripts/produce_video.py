#!/usr/bin/env python3
"""Render a reviewed story plan with VOICEVOX narration and FFmpeg.

Pillow typesets transparent caption/title overlays only. Original generated art
is left untouched; FFmpeg selects the atlas panels while composing the video.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import subprocess
import unicodedata
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / ".tools/voicevox/runtime"


def sha(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def run(args: list[str]) -> None:
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:] or result.stdout[-2000:])


def probe(path: Path) -> dict:
    return json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], text=True))


def font_path() -> Path:
    preferred = "ヒラギノ丸ゴ ProN W4.ttc"
    for p in Path("/System/Library/Fonts").glob("*.ttc"):
        if unicodedata.normalize("NFC", p.name) == preferred:
            return p
    for p in [Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"), Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")]:
        if p.exists():
            return p
    raise RuntimeError("日本語フォントを用意してください。")


def caption_overlay(plan: dict, segment: dict, index: int, path: Path) -> None:
    from PIL import Image, ImageDraw, ImageFont
    canvas = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    font = font_path()
    def text(value: str, y: int, size: int, color: str, max_width: int = 940):
        face = ImageFont.truetype(str(font), size)
        while draw.textbbox((0, 0), value, font=face)[2] > max_width and size > 32:
            size -= 2
            face = ImageFont.truetype(str(font), size)
        box = draw.textbbox((0, 0), value, font=face)
        if box[2] > max_width:
            raise ValueError("字幕が長すぎます: " + value)
        x = (1080 - (box[2] - box[0])) // 2
        draw.text((x, y), value, font=face, fill=color)
    # UI typography and geometry; no artwork is opened or edited here.
    text(plan["series"], 80, 44, "#89664f")
    text(plan["displayTitle"], 158, 70, "#4b3728")
    draw.rounded_rectangle((445, 275, 635, 283), radius=4, fill="#e8b956")
    draw.rounded_rectangle((42, 1450, 1038, 1708), radius=26, fill="#fffefa", outline="#efdfc2", width=2)
    lines = segment["caption"]
    if not 1 <= len(lines) <= 2:
        raise ValueError("字幕は2行以内にしてください。")
    for line, y in zip(lines, [1478, 1570] if len(lines) == 2 else [1520]):
        text(line, y, 70, "#453428", 920)
    text("ゆっくり かんがえてね" if segment.get("question") else "ポコと いっしょに", 1751, 36, "#927253")
    text("こえ：VOICEVOX:四国めたん", 1820, 26, "#8b8275")
    step_width = 1000 / len(plan["segments"])
    draw.rounded_rectangle((40, 1890, 1040, 1898), radius=4, fill="#ebdfcd")
    draw.rounded_rectangle((40, 1890, int(40 + step_width * (index + 1)), 1898), radius=4, fill="#d6ab52")
    canvas.save(path)


def synthesizer():
    from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile
    library = next((RUNTIME / "onnxruntime/lib").glob("libvoicevox_onnxruntime*.dylib"))
    dictionary = next((RUNTIME / "dict").glob("open_jtalk_dic*"))
    model_file = RUNTIME / "models/vvms/0.vvm"
    synth = Synthesizer(Onnxruntime.load_once(filename=str(library)), OpenJtalk(str(dictionary)), acceleration_mode="CPU", cpu_num_threads=4)
    with VoiceModelFile.open(str(model_file)) as model:
        synth.load_voice_model(model)
    return synth


def render(plan_path: Path, synth, only_audio: bool = False) -> dict:
    plan = json.loads(plan_path.read_text())
    if plan["format"] != {"width": 1080, "height": 1920, "fps": 30}:
        raise ValueError("現在の制作形式は1080×1920 / 30fpsです。")
    atlas = (ROOT / plan["atlas"]).resolve()
    if not atlas.is_relative_to(ROOT / "production/assets") or not atlas.exists():
        raise ValueError("場面画像がまだありません: " + str(atlas))
    content = json.dumps(plan, ensure_ascii=False, sort_keys=True) + sha(atlas)
    input_hash = hashlib.sha256(content.encode()).hexdigest()
    out = ROOT / "production/renders" / plan["id"] / f"r{plan['revision']}"
    out.mkdir(parents=True, exist_ok=True)
    report_path = out / "render.json"
    if report_path.exists():
        previous = json.loads(report_path.read_text())
        if previous["inputHash"] != input_hash:
            raise ValueError("完成済みの素材を変更する場合は、台本のrevisionを増やしてください。")
        existing = Path(previous["videoPath"])
        if existing.exists() and sha(existing) == previous["contentHash"]:
            print(plan["id"], "既存の完成動画を再利用", flush=True)
            return previous
    fps = plan["format"]["fps"]
    timeline = []
    segments = []
    elapsed = 0.0
    for i, segment in enumerate(plan["segments"]):
        if segment["panel"] not in [0, 1, 2, 3] or not 0 <= segment["pauseAfter"] <= 4:
            raise ValueError("無効な場面指定です。")
        wav = out / f"narration-{i:02d}.wav"
        query = synth.create_audio_query(segment["speech"], plan["voice"]["speakerId"])
        query.speed_scale = plan["voice"]["speedScale"]
        query.intonation_scale = plan["voice"]["intonationScale"]
        query.pre_phoneme_length = .08
        query.post_phoneme_length = .08
        query.output_sampling_rate = 24000
        wav.write_bytes(synth.synthesis(query, plan["voice"]["speakerId"]))
        with wave.open(str(wav)) as audio:
            speech_duration = audio.getnframes() / audio.getframerate()
        frames = math.ceil((speech_duration + segment["pauseAfter"]) * fps)
        duration = frames / fps
        timeline.append({"index": i, "start": elapsed, "end": elapsed + duration, "speechEnd": elapsed + speech_duration, **segment})
        elapsed += duration
        print(plan["id"], f"場面 {i + 1}/{len(plan['segments'])}: {duration:.2f}秒", flush=True)
        if only_audio:
            continue
        overlay = out / f"captions-{i:02d}.png"
        caption_overlay(plan, segment, i, overlay)
        video = out / f"segment-{i:02d}.mp4"
        panel = segment["panel"]
        crop = f"crop=iw/2:ih/2:{'iw/2' if panel % 2 else '0'}:{'ih/2' if panel >= 2 else '0'}"
        filters = f"[0:v]{crop},scale=1200:1200,zoompan=z='min(1.018,1+on*0.00007)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1000x1000:fps={fps},pad=1080:1920:40:370:color=0xfff7e9[art];[art][1:v]overlay=0:0:shortest=1,format=yuv420p[v];[2:a]apad=pad_dur={segment['pauseAfter'] + .1},aresample=48000[a]"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", str(fps), "-i", str(atlas), "-loop", "1", "-framerate", str(fps), "-i", str(overlay), "-i", str(wav), "-filter_complex_threads", "1", "-filter_complex", filters, "-map", "[v]", "-map", "[a]", "-t", str(duration), "-r", str(fps), "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-threads", "4", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "1", "-movflags", "+faststart", str(video)])
        segments.append(video)
    (out / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2))
    if only_audio:
        return {"id": plan["id"], "durationSeconds": elapsed, "audioOnly": True}
    concat = out / "concat.txt"
    concat.write_text("\n".join("file '" + str(p).replace("'", "'\\''") + "'" for p in segments))
    final = out / f"{plan['id']}.mp4"
    temporary = out / "completed.part.mp4"
    # Keep the final render above the low-bitrate failure mode seen in simple
    # picture-book boards while preserving the reviewed 1080x1920/30fps format.
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p", "-b:v", "1200k", "-minrate", "1200k", "-maxrate", "1200k", "-bufsize", "2400k", "-x264-params", "nal-hrd=cbr", "-r", str(fps), "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "1", "-movflags", "+faststart", str(temporary)])
    details = probe(temporary)
    video_info = next(s for s in details["streams"] if s["codec_type"] == "video")
    audio_info = next(s for s in details["streams"] if s["codec_type"] == "audio")
    duration = float(details["format"]["duration"])
    if (video_info["width"], video_info["height"]) != (1080, 1920) or video_info["codec_name"] != "h264" or audio_info["codec_name"] != "aac":
        raise ValueError("書き出し形式を確認できませんでした。")
    if not 25 <= duration <= 50:
        raise ValueError(f"尺が試作範囲外です ({duration:.2f}秒)。台本を調整してください。")
    temporary.replace(final)
    report = {"id": plan["id"], "revision": plan["revision"], "status": "ready_for_review", "videoPath": str(final), "contentHash": sha(final), "inputHash": input_hash, "atlasHash": sha(atlas), "durationSeconds": duration, "width": 1080, "height": 1920, "voice": plan["voice"], "title": plan["title"], "description": plan["description"], "selfDeclaredMadeForKids": True, "publication": None, "visualReview": None, "audioReview": None}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (out / "youtube-description.txt").write_text(plan["description"] + "\n")
    (out / "youtube-title.txt").write_text(plan["title"] + "\n")
    # Separate subtitle file for accessibility and downstream editing.
    def timestamp(t):
        millis = round(t * 1000)
        return f"{millis // 3600000:02d}:{millis // 60000 % 60:02d}:{millis // 1000 % 60:02d},{millis % 1000:03d}"
    (out / "subtitles.srt").write_text("\n\n".join(f"{i+1}\n{timestamp(row['start'])} --> {timestamp(row['end'])}\n" + "\n".join(row["caption"]) for i, row in enumerate(timeline)) + "\n")
    print("完成:", final, f"({duration:.2f}秒)", flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("plans", nargs="+", type=Path)
    parser.add_argument("--audio-only", action="store_true")
    args = parser.parse_args()
    synth = synthesizer()
    try:
        for path in args.plans:
            report = render(path.resolve(), synth, args.audio_only)
            print(json.dumps({"id": report["id"], "durationSeconds": report["durationSeconds"]}, ensure_ascii=False), flush=True)
    finally:
        synth.close()

if __name__ == "__main__":
    main()
