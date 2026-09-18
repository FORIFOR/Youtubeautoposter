"""Run with `npm run production:worker -- --once` or as a single persistent worker."""
from __future__ import annotations

import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit

import httpx
from .runtime import OpenAI,Plan,Journal,atomic,canonical,file_hash,render,MAX_VIDEO
from .upload import YouTubeUpload


class Bridge:
    def __init__(self,base_url,token,*,transport=None):
        parsed=urlsplit(base_url)
        if (parsed.scheme not in ("https","http") or (parsed.scheme=="http" and parsed.hostname not in ("127.0.0.1","localhost","::1"))
            or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("","/") or len(token)<32):
            raise ValueError("invalid_bridge_configuration")
        self.base=base_url.rstrip("/")
        self.client=httpx.Client(headers={"Authorization":"Bearer "+token},timeout=180,follow_redirects=False,trust_env=False,transport=transport)

    def call(self,action,**kwargs):
        r=self.client.post(self.base+"/api/production-worker",json={"action":action,**kwargs})
        if not r.is_success:raise ValueError("bridge_rejected")
        return r.json()

    def guard(self,job):return self.call("heartbeat",id=job["id"],lease=job["lease"])

    def artifact(self,job,path,info):
        with path.open("rb") as file:
            r=self.client.put(self.base+"/api/production-worker/artifact",params={"id":job["id"]},
                headers={"Content-Type":"video/mp4","Content-Length":str(path.stat().st_size),"X-Job-Lease":job["lease"],"X-Artifact-Info":json.dumps(info)},content=file)
        if not r.is_success:raise ValueError("artifact_rejected")
        return r.json()

    def download(self,job,path):
        with self.client.stream("GET",self.base+"/api/production-worker/artifact",params={"id":job["id"]},headers={"X-Job-Lease":job["lease"]}) as response:
            if response.status_code!=200:raise ValueError("artifact_download_failed")
            data=bytearray()
            for chunk in response.iter_bytes():
                data.extend(chunk)
                if len(data)>MAX_VIDEO:raise ValueError("artifact_too_large")
        atomic(path,bytes(data))
        if file_hash(path)!=job["artifact"]["sha256"]:raise ValueError("artifact_hash_mismatch")

    def close(self):self.client.close()


def execute(job,root,bridge,provider,uploader):
    if not re.fullmatch(r"[a-f0-9-]{36}",job["id"]):raise ValueError("invalid_job_id")
    journal=Journal(root/job["id"])
    guard=lambda:bridge.guard(job)
    guard()
    if job["task"]=="plan":
        if not job.get("consentText"):raise ValueError("text_consent_required")
        raw=journal.once("plan.json",lambda:canonical(provider.plan(job["source"]).model_dump()))
        guard();bridge.call("finish-plan",id=job["id"],lease=job["lease"],plan=json.loads(raw),model=provider.text_model)
    elif job["task"]=="render":
        if not job.get("consentMedia"):raise ValueError("media_consent_required")
        path,info=render(Plan.model_validate(job["plan"]),job["source"]["conditions"],journal,provider,guard)
        guard();bridge.artifact(job,path,info)
    elif job["task"] in ("upload","check"):
        path=journal.root/"video.mp4"
        if not path.exists() or file_hash(path)!=job["artifact"]["sha256"]:bridge.download(job,path)
        remote=uploader.run(job,path,journal,guard,check_only=job["task"]=="check")
        bridge.call("finish-upload",id=job["id"],lease=job["lease"],remote=remote)
    else:raise ValueError("unsupported_task")


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--once",action="store_true");args=parser.parse_args()
    read=lambda name:os.environ.get(name,"")
    root=Path(read("PRODUCTION_WORK_DIR") or ".production-worker").resolve();root.mkdir(parents=True,exist_ok=True,mode=0o700)
    lock=(root/"worker.lock").open("a+")
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    provider=OpenAI(read("OPENAI_API_KEY"),read("PRODUCTION_TEXT_MODEL"),read("PRODUCTION_IMAGE_MODEL"),read("PRODUCTION_TTS_MODEL"),read("PRODUCTION_TTS_VOICE"))
    uploader=YouTubeUpload(read("GOOGLE_CLIENT_ID"),read("GOOGLE_CLIENT_SECRET"),read("GOOGLE_UPLOAD_REFRESH_TOKEN"))
    bridge=Bridge(read("PRODUCTION_APP_URL"),read("PRODUCTION_WORKER_TOKEN"))
    capabilities={"text":bool(read("OPENAI_API_KEY") and provider.text_model),
                  "media":bool(read("OPENAI_API_KEY") and provider.image_model and provider.tts_model and provider.voice),
                  "upload":bool(read("GOOGLE_CLIENT_ID") and read("GOOGLE_CLIENT_SECRET") and read("GOOGLE_UPLOAD_REFRESH_TOKEN")),"profile":provider.profile}
    try:
        while True:
            job=None
            try:
                bridge.call("hello",capabilities=capabilities)
                job=bridge.call("claim",capabilities=capabilities).get("job")
                if job:
                    execute(job,root,bridge,provider,uploader)
                    print(json.dumps({"job":job["id"],"task":job["task"],"state":"completed"}),flush=True)
            except Exception:
                if job:
                    code="upload_uncertain" if job["task"] in ("upload","check") else "render_failed" if job["task"]=="render" else "provider_or_validation_failed"
                    try:bridge.call("fail",id=job["id"],lease=job["lease"],code=code)
                    except Exception:pass
                print(json.dumps({"job":job["id"] if job else None,"state":"stopped_or_failed","automatic_retry":False}),flush=True)
                if args.once:raise SystemExit(1)
            if args.once:break
            time.sleep(15)
    finally:
        bridge.close();uploader.close();provider.close();lock.close()


if __name__=="__main__":main()
