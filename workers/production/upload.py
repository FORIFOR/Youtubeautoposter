"""Resumable upload with durable identity; never blindly create a second video."""
from __future__ import annotations

from datetime import datetime,timezone
import json
import re
from urllib.parse import urlsplit,parse_qs
from pathlib import Path

import httpx
from .runtime import Journal,digest,file_hash,MAX_VIDEO


def session_url(value: str) -> str:
    parsed=urlsplit(value)
    if (parsed.scheme!="https" or parsed.hostname!="www.googleapis.com" or parsed.port is not None
        or parsed.username or parsed.password or parsed.fragment
        or parsed.path!="/upload/youtube/v3/videos" or not parse_qs(parsed.query).get("upload_id")):
        raise ValueError("untrusted_upload_session")
    return value


def offset(response: httpx.Response, size: int) -> int:
    value=response.headers.get("range")
    if not value:return 0
    match=re.fullmatch(r"bytes=0-(\d+)",value)
    if not match or not 0<=int(match[1])<size:raise ValueError("invalid_upload_range")
    return int(match[1])+1


class YouTubeUpload:
    def __init__(self,client_id:str,client_secret:str,refresh_token:str,*,transport=None):
        self.client_id,self.client_secret,self.refresh_token=client_id,client_secret,refresh_token
        self.client=httpx.Client(timeout=120,follow_redirects=False,trust_env=False,transport=transport)
        self.token=""

    def authorize(self,channel_id):
        response=self.client.post("https://oauth2.googleapis.com/token",data={"client_id":self.client_id,
            "client_secret":self.client_secret,"refresh_token":self.refresh_token,"grant_type":"refresh_token"})
        if response.status_code!=200:raise ValueError("upload_authorization_required")
        self.token=response.json()["access_token"]
        response=self.client.get("https://www.googleapis.com/youtube/v3/channels",params={"part":"id","mine":"true"},headers=self.headers)
        if response.status_code!=200 or {v["id"] for v in response.json().get("items",[])}!={channel_id}:
            raise ValueError("upload_channel_mismatch")

    @property
    def headers(self):return {"Authorization":"Bearer "+self.token}

    def remote(self,id,channel_id):
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}",id):raise ValueError("invalid_video_id")
        response=self.client.get("https://www.googleapis.com/youtube/v3/videos",params={"id":id,"part":"snippet,status,processingDetails,contentDetails"},headers=self.headers)
        if response.status_code!=200:raise ValueError("video_status_unavailable")
        items=response.json().get("items",[])
        if len(items)!=1 or items[0].get("id")!=id or items[0].get("snippet",{}).get("channelId")!=channel_id:
            raise ValueError("uploaded_video_mismatch")
        item=items[0];status=item["status"];snippet=item["snippet"]
        match=re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", item.get("contentDetails",{}).get("duration",""))
        duration = (float(match[1] or 0)*3600+float(match[2] or 0)*60+float(match[3] or 0)) if match else None
        if duration is not None and not 0 < duration <= 91:raise ValueError("remote_duration_outside_limits")
        return {"id":id,"channelId":channel_id,"title":snippet["title"],"privacy":status["privacyStatus"],
                "processed":item.get("processingDetails",{}).get("processingStatus")=="succeeded" or status.get("uploadStatus")=="processed",
                "duration":duration,"publishedAt":snippet["publishedAt"],"checkedAt":datetime.now(timezone.utc).isoformat().replace("+00:00","Z")}

    def run(self,job,path:Path,journal:Journal,guard=lambda:None,*,check_only=False):
        approval=job.get("approval")
        if not approval or not job.get("artifact"):raise ValueError("approval_required")
        if (approval.get("videoHash")!=job["artifact"]["sha256"] or approval.get("planHash")!=job.get("planHash")
            or approval.get("sourceHash")!=job.get("sourceHash") or approval.get("channelId")!=job["source"]["channelId"]):
            raise ValueError("approval_content_changed")
        if not check_only and datetime.fromisoformat(approval["expiresAt"].replace("Z","+00:00"))<=datetime.now(timezone.utc):
            raise ValueError("approval_expired")
        identity=digest({"videoHash":job["artifact"]["sha256"],"metadata":approval["metadata"],"channelId":job["source"]["channelId"]})
        saved=journal.read("upload.json")
        if saved and saved["identity"]!=identity:raise ValueError("upload_identity_changed")
        self.authorize(job["source"]["channelId"])
        video_id=job.get("remote",{}).get("id") or (saved or {}).get("video_id")
        if video_id:return self.remote(video_id,job["source"]["channelId"])
        if not path.is_file() or file_hash(path)!=job["artifact"]["sha256"] or path.stat().st_size>MAX_VIDEO:
            raise ValueError("approved_video_changed")
        size=path.stat().st_size
        if not saved:
            if check_only or job.get("uploadAttempts",1)>1:raise ValueError("missing_upload_receipt_do_not_repost")
            guard()
            saved={"identity":identity,"state":"initiating","size":size}
            journal.save("upload.json",saved)  # Before any network write.
            metadata=approval["metadata"]
            body={"snippet":{"title":metadata["title"],"description":metadata["description"],"categoryId":"22","defaultLanguage":job["source"]["conditions"]["language"]},
                  "status":{"privacyStatus":metadata["privacy"],"selfDeclaredMadeForKids":metadata["madeForKids"],"containsSyntheticMedia":metadata["containsSyntheticMedia"]}}
            response=self.client.post("https://www.googleapis.com/upload/youtube/v3/videos",params={"uploadType":"resumable","part":"snippet,status"},
                headers={**self.headers,"X-Upload-Content-Type":"video/mp4","X-Upload-Content-Length":str(size)},json=body)
            if response.status_code not in (200,201):raise ValueError("upload_initialization_uncertain")
            saved.update(session=session_url(response.headers.get("location","")),state="session")
            journal.save("upload.json",saved)
        if not saved.get("session"):raise ValueError("upload_initialization_uncertain_do_not_repost")
        url=session_url(saved["session"])
        response=self.client.put(url,headers={**self.headers,"Content-Length":"0","Content-Range":f"bytes */{size}"},content=b"")
        if response.status_code in (200,201):
            saved.update(video_id=response.json()["id"],state="uploaded");journal.save("upload.json",saved)
            return self.remote(saved["video_id"],job["source"]["channelId"])
        if response.status_code!=308:raise ValueError("upload_session_unavailable_do_not_repost")
        if check_only:raise ValueError("upload_incomplete_explicit_resume_required")
        # Honor a requested wait without sleeping inside or replaying the upload.
        if response.headers.get("retry-after"):raise ValueError("upload_retry_later")
        start=offset(response,size)
        with path.open("rb") as f:
            while start<size:
                guard()  # Re-check live lease, source, expiry and approval before every write.
                f.seek(start);chunk=f.read(8*1024*1024)
                response=self.client.put(url,headers={**self.headers,"Content-Type":"video/mp4",
                    "Content-Length":str(len(chunk)),"Content-Range":f"bytes {start}-{start+len(chunk)-1}/{size}"},content=chunk)
                if response.status_code in (200,201):
                    saved.update(video_id=response.json()["id"],state="uploaded");journal.save("upload.json",saved)
                    return self.remote(saved["video_id"],job["source"]["channelId"])
                if response.status_code!=308:raise ValueError("upload_interrupted")
                next_offset=offset(response,size)
                if not start<next_offset<=start+len(chunk):raise ValueError("upload_not_advancing")
                saved["acknowledged_bytes"]=next_offset;journal.save("upload.json",saved)
                if response.headers.get("retry-after"):raise ValueError("upload_retry_later")
                start=next_offset
        raise ValueError("upload_completion_uncertain")

    def close(self):self.client.close()
