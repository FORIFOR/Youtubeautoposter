#!/usr/bin/env python3
"""Compose a 3-round picture-book color game; generated sprites stay untouched.

Pillow creates typography/UI on a blank canvas only. FFmpeg crops the generated
atlas into sprites, composes them, and animates the correct answer.
"""
import argparse
import hashlib
import json
import math
import wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from produce_video import ROOT, font_path, probe, run, sha, synthesizer


def board(row, path):
    canvas = Image.new("RGBA", (1080, 1920), "#fff7e9")
    draw = ImageDraw.Draw(canvas)
    face = str(font_path())
    def text(value, y, size, color):
        font = ImageFont.truetype(face, size)
        box = draw.textbbox((0, 0), value, font=font)
        if box[2] - box[0] > 950:
            raise ValueError("文字が画面幅を超えます: " + value)
        draw.text(((1080-box[2]+box[0])/2, y), value, font=font, fill=color)
    text("ポコの いろあそび", 95, 36, "#80694e")
    lines = row["headline"]
    for line, y in zip(lines, [215, 330] if len(lines) == 2 else [275]):
        text(line, y, 96, row["color"])
    if row["mode"] != "ending":
        for i, x in enumerate([65, 555]):
            correct = row["mode"] == "answer" and i == row["correct"]
            draw.rounded_rectangle((x, 585, x+440, 1125), radius=58,
                                   fill="#fffefa", outline=row["color"] if correct else "#ecdfc8", width=9 if correct else 3)
        text("ゆびで さしてね" if row["mode"] == "question" else "みつけたね！", 1185, 52, "#5b4b36")
    for i in range(3):
        x = 468 + i * 58
        draw.ellipse((x, 1570, x+24, 1594), fill="#bba786" if i < row["round"] else "#e9ddc6")
    text("こえ：VOICEVOX:四国めたん", 1695, 26, "#827765")
    canvas.save(path)


def render(plan_path):
    plan = json.loads(plan_path.read_text())
    atlas = ROOT / plan["atlas"]
    out = ROOT / "production/renders" / plan["id"] / f"r{plan['revision']}"
    out.mkdir(parents=True, exist_ok=True)
    fingerprint = hashlib.sha256((json.dumps(plan, ensure_ascii=False, sort_keys=True)+sha(atlas)+sha(Path(__file__))).encode()).hexdigest()
    report_path = out / "render.json"
    if report_path.exists():
        previous = json.loads(report_path.read_text())
        if previous["inputHash"] != fingerprint:
            raise ValueError("完成済みの制作条件が変わりました。revisionを増やしてください。")
        if Path(previous["videoPath"]).exists() and sha(Path(previous["videoPath"])) == previous["contentHash"]:
            print("既存の完成動画:", previous["videoPath"])
            return
    synth = synthesizer()
    timeline, videos, elapsed = [], [], 0.0
    try:
        for index, row in enumerate(plan["segments"]):
            wav = out / f"narration-{index:02d}.wav"
            query = synth.create_audio_query(row["speech"], plan["voice"]["speakerId"])
            query.speed_scale = plan["voice"]["speedScale"]
            query.intonation_scale = plan["voice"]["intonationScale"]
            query.pre_phoneme_length = .08
            query.post_phoneme_length = .08
            query.output_sampling_rate = 24000
            wav.write_bytes(synth.synthesis(query, plan["voice"]["speakerId"]))
            with wave.open(str(wav)) as source:
                speech_duration = source.getnframes()/source.getframerate()
            duration = math.ceil((speech_duration+row["pauseAfter"])*30)/30
            timeline.append({"index": index, "start": elapsed, "end": elapsed+duration, "speechEnd": elapsed+speech_duration, **row})
            elapsed += duration
            bg = out / f"board-{index:02d}.png"
            board(row, bg)
            ending = row["mode"] == "ending"
            sprites = [0] + row["objects"]
            count = len(sprites)
            filters = [f"[1:v]format=rgba,split={count}"+"".join(f"[s{i}]" for i in range(count))]
            for i, panel in enumerate(sprites):
                size = (480 if ending else 320) if i == 0 else (290 if ending else 440)
                # The bear extends slightly below the atlas midpoint. These
                # reviewed bounds include its feet; the lower-left fruit starts
                # far below this rectangle. Preserve aspect ratio after crop.
                bounds = ["crop=iw/2:ih*0.54:0:0", "crop=iw/2:ih/2:iw/2:0", "crop=iw/2:ih*0.46:0:ih*0.54", "crop=iw/2:ih/2:iw/2:ih/2"]
                crop = bounds[panel]
                fade = ",colorchannelmixer=aa=0.36" if row["mode"] == "answer" and i>0 and i-1 != row["correct"] else ""
                filters.append(f"[s{i}]{crop},scale={size}:{size}:force_original_aspect_ratio=decrease,pad={size}:{size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000{fade}[p{i}]")
            previous = "0:v"
            for i in range(count):
                if i == 0:
                    x, y = (300, 1030) if ending else (380, 1260)
                else:
                    x, y = (75+(i-1)*320, 650) if ending else ([65,555][i-1], 630)
                    if row["mode"] == "answer" and i-1 == row["correct"]:
                        y = f"{y}-24*abs(sin(PI*t/1.2))*exp(-t/3)"
                target = f"c{i}"
                filters.append(f"[{previous}][p{i}]overlay=x='{x}':y='{y}':shortest=1[{target}]")
                previous = target
            filters += [f"[{previous}]format=yuv420p[v]",f"[2:a]apad=pad_dur={row['pauseAfter']+.1},aresample=48000[a]"]
            video = out / f"segment-{index:02d}.mp4"
            run(["ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1","-framerate","30","-i",str(bg),"-loop","1","-framerate","30","-i",str(atlas),"-i",str(wav),"-filter_complex_threads","1","-filter_complex",";".join(filters),"-map","[v]","-map","[a]","-t",str(duration),"-r","30","-c:v","libx264","-preset","fast","-crf","19","-threads","4","-c:a","aac","-b:a","160k","-ar","48000","-ac","1",str(video)])
            videos.append(video)
            print(f"{index+1}/{len(plan['segments'])}: {duration:.2f}秒", flush=True)
    finally:
        synth.close()
    (out/"timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2))
    concat = out/"concat.txt"
    concat.write_text("\n".join("file '"+str(p).replace("'", "'\\''")+"'" for p in videos))
    final = out/f"{plan['id']}.mp4"
    # The first published color-game render was visually readable but its
    # mostly static boards resulted in a very low video bitrate (~0.216 Mbps).
    # Re-encode the final file at a stable 1.2 Mbps so pale backgrounds and
    # illustrated edges have room after upload. Keep the loudness policy and
    # audio format unchanged.
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(concat),"-c:v","libx264","-preset","slow","-profile:v","high","-pix_fmt","yuv420p","-b:v","1200k","-minrate","1200k","-maxrate","1200k","-bufsize","2400k","-x264-params","nal-hrd=cbr","-r","30","-af","loudnorm=I=-18:TP=-2:LRA=7","-c:a","aac","-b:a","160k","-ar","48000","-ac","1","-movflags","+faststart",str(final)])
    details = probe(final)
    duration = float(details["format"]["duration"])
    if not 20 <= duration <= 35:
        raise ValueError(f"尺を確認してください: {duration}")
    report = {"id":plan["id"],"revision":plan["revision"],"status":"ready_for_review","videoPath":str(final),"durationSeconds":duration,"contentHash":sha(final),"inputHash":fingerprint,"rendererHash":sha(Path(__file__)),"atlasHash":sha(atlas),"firstAnswerSeconds":timeline[1]["start"],"experiment":plan["experiment"],"publication":None,"visualReview":None,"audioReview":None}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    def stamp(t):
        m=round(t*1000)
        return f"{m//3600000:02d}:{m//60000%60:02d}:{m//1000%60:02d},{m%1000:03d}"
    (out/"subtitles.srt").write_text("\n\n".join(f"{i+1}\n{stamp(r['start'])} --> {stamp(r['end'])}\n"+"\n".join(r["caption"]) for i,r in enumerate(timeline))+"\n")
    for field in ["title","description"]:
        (out/f"youtube-{field}.txt").write_text(plan[field]+"\n")
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("plan", type=Path)
    render(parser.parse_args().plan.resolve())
