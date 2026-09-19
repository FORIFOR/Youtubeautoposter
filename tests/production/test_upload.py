import json
from datetime import datetime,timedelta,timezone
from pathlib import Path
import httpx
import pytest
from workers.production.runtime import Journal,file_hash,digest
from workers.production.upload import YouTubeUpload,session_url,offset

CHANNEL='UC'+'a'*22
VIDEO='abcdefghijk'
SESSION='https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=test-session'

@pytest.fixture
def job(tmp_path):
    path=tmp_path/'approved.mp4';path.write_bytes(b'fake test payload, never sent outside MockTransport')
    sha=file_hash(path)
    return {'source':{'channelId':CHANNEL,'conditions':{'language':'ja'}},'sourceHash':'source','planHash':'plan',
        'artifact':{'sha256':sha,'size':path.stat().st_size},'uploadAttempts':1,
        'approval':{'videoHash':sha,'sourceHash':'source','planHash':'plan','channelId':CHANNEL,
          'expiresAt':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),
          'metadata':{'title':'Test','description':'AI voice disclosure','privacy':'public','madeForKids':False,'containsSyntheticMedia':True}}}

class Server:
    def __init__(self,*,channel=CHANNEL):self.calls=[];self.channel=channel;self.data_put=None
    def __call__(self,r):
        self.calls.append(r)
        if r.url.host=='oauth2.googleapis.com':return httpx.Response(200,json={'access_token':'test-token'})
        if r.url.path.endswith('/channels'):return httpx.Response(200,json={'items':[{'id':self.channel}]})
        if r.url.path=='/youtube/v3/videos':return httpx.Response(200,json={'items':[{'id':VIDEO,'snippet':{'title':'Test','channelId':CHANNEL,'publishedAt':'2026-09-18T00:00:00Z'},'contentDetails':{'duration':'PT2S'},'status':{'privacyStatus':'private','uploadStatus':'processed'}}]})
        if r.method=='POST':return httpx.Response(200,headers={'location':SESSION})
        if not r.content:return httpx.Response(308)
        return self.data_put(r) if self.data_put else httpx.Response(200,json={'id':VIDEO})
    @property
    def creates(self):return [r for r in self.calls if r.method=='POST' and r.url.host=='www.googleapis.com']


def uploader(server):return YouTubeUpload('client','secret','refresh',transport=httpx.MockTransport(server))


def test_upload_uses_exact_reviewed_metadata_and_actual_privacy(tmp_path,job):
    s=Server();u=uploader(s);guards=[]
    try:
        result=u.run(job,tmp_path/'approved.mp4',Journal(tmp_path/'journal'),lambda:guards.append(1))
        assert result['duration']==2
        assert result['id']==VIDEO and result['privacy']=='private' and result['processed']
        body=json.loads(s.creates[0].content)
        assert body['status']=={'privacyStatus':'public','selfDeclaredMadeForKids':False,'containsSyntheticMedia':True}
        assert len(s.creates)==1 and len(guards)==2
    finally:u.close()


def test_receipt_prevents_duplicate_after_callback_loss(tmp_path,job):
    s=Server();u=uploader(s);root=tmp_path/'journal'
    try:
        u.run(job,tmp_path/'approved.mp4',Journal(root))
        job['uploadAttempts']=2
        result=u.run(job,tmp_path/'approved.mp4',Journal(root))
        assert result['id']==VIDEO and len(s.creates)==1
    finally:u.close()


def test_channel_mismatch_stops_before_creating_video(tmp_path,job):
    s=Server(channel='other');u=uploader(s)
    try:
        with pytest.raises(ValueError,match='channel_mismatch'):u.run(job,tmp_path/'approved.mp4',Journal(tmp_path/'journal'))
        assert not s.creates
    finally:u.close()


def test_changed_mp4_or_approval_stops(tmp_path,job):
    s=Server();u=uploader(s)
    try:
        (tmp_path/'approved.mp4').write_bytes(b'changed')
        with pytest.raises(ValueError,match='video_changed'):u.run(job,tmp_path/'approved.mp4',Journal(tmp_path/'journal'))
        job['approval']['planHash']='changed'
        with pytest.raises(ValueError,match='content_changed'):u.run(job,tmp_path/'approved.mp4',Journal(tmp_path/'journal'))
        assert not s.creates
    finally:u.close()


def test_timeout_after_data_send_resumes_same_session(tmp_path,job):
    s=Server();s.data_put=lambda r: (_ for _ in ()).throw(httpx.ReadTimeout('lost',request=r))
    u=uploader(s);j=Journal(tmp_path/'journal')
    try:
        with pytest.raises(httpx.ReadTimeout):u.run(job,tmp_path/'approved.mp4',j)
        assert j.read('upload.json')['session']==SESSION
        s.data_put=None;job['uploadAttempts']=2
        assert u.run(job,tmp_path/'approved.mp4',j)['id']==VIDEO
        assert len(s.creates)==1
    finally:u.close()


def test_unknown_initialization_and_lost_receipt_never_repost(tmp_path,job):
    s=Server();u=uploader(s);j=Journal(tmp_path/'journal')
    try:
        identity=digest({'videoHash':job['artifact']['sha256'],'metadata':job['approval']['metadata'],'channelId':CHANNEL})
        j.save('upload.json',{'identity':identity,'state':'initiating','size':job['artifact']['size']})
        with pytest.raises(ValueError,match='do_not_repost'):u.run(job,tmp_path/'approved.mp4',j)
        job['uploadAttempts']=2
        with pytest.raises(ValueError,match='do_not_repost'):u.run(job,tmp_path/'approved.mp4',Journal(tmp_path/'empty'))
        assert not s.creates
    finally:u.close()


def test_check_only_does_not_send_video(tmp_path,job):
    s=Server();u=uploader(s);j=Journal(tmp_path/'journal')
    try:
        with pytest.raises(ValueError,match='do_not_repost'):u.run(job,tmp_path/'approved.mp4',j,check_only=True)
        identity=digest({'videoHash':job['artifact']['sha256'],'metadata':job['approval']['metadata'],'channelId':CHANNEL})
        j.save('upload.json',{'identity':identity,'state':'session','session':SESSION,'size':job['artifact']['size']})
        with pytest.raises(ValueError,match='explicit_resume'):u.run(job,tmp_path/'approved.mp4',j,check_only=True)
        assert not s.creates and not [r for r in s.calls if r.method=='PUT' and r.content]
    finally:u.close()


def test_expired_approval_cannot_write_but_can_read_known_video(tmp_path,job):
    s=Server();u=uploader(s);j=Journal(tmp_path/'journal')
    try:
        job['approval']['expiresAt']='2020-01-01T00:00:00Z'
        with pytest.raises(ValueError,match='expired'):u.run(job,tmp_path/'approved.mp4',j)
        job['remote']={'id':VIDEO}
        assert u.run(job,tmp_path/'approved.mp4',j,check_only=True)['id']==VIDEO
        assert not s.creates
    finally:u.close()


def test_live_revocation_prevents_data_write(tmp_path,job):
    s=Server();u=uploader(s);count=0
    def guard():
        nonlocal count
        count+=1
        if count==2:raise ValueError('revoked')
    try:
        with pytest.raises(ValueError,match='revoked'):u.run(job,tmp_path/'approved.mp4',Journal(tmp_path/'journal'),guard)
        assert not [r for r in s.calls if r.method=='PUT' and r.content]
    finally:u.close()


@pytest.mark.parametrize('url',['http://www.googleapis.com/upload/youtube/v3/videos?upload_id=a','https://evil.invalid/upload/youtube/v3/videos?upload_id=a','https://www.googleapis.com:443/upload/youtube/v3/videos?upload_id=a','https://www.googleapis.com/upload/youtube/v3/videos','https://www.googleapis.com/other?upload_id=a','https://user@www.googleapis.com/upload/youtube/v3/videos?upload_id=a'])
def test_session_allowlist(url):
    with pytest.raises(ValueError):session_url(url)


def test_acknowledgement_offsets_are_checked():
    assert session_url(SESSION)==SESSION
    assert offset(httpx.Response(308),100)==0
    assert offset(httpx.Response(308,headers={'range':'bytes=0-49'}),100)==50
    for value in ['bytes=1-50','bytes=0-100','garbage']:
        with pytest.raises(ValueError):offset(httpx.Response(308,headers={'range':value}),100)
