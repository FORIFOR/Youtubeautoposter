import base64
import json
from pathlib import Path
import shutil
import httpx
import pytest
from workers.production.runtime import OpenAI,Journal,render,probe,canonical,file_hash
from workers.production.worker import Bridge,execute


def source(conditions):
    return {'conditions':conditions,'evidence':{'groups':[{'observationIds':['real-1']}]}}


def test_receipt_is_durable_and_never_repeats_a_paid_request(tmp_path):
    calls=[];j=Journal(tmp_path)
    assert j.once('a',lambda:calls.append(1) or b'yes')==b'yes'
    assert Journal(tmp_path).once('a',lambda:pytest.fail('duplicate'))==b'yes'
    (tmp_path/'a').write_bytes(b'changed')
    with pytest.raises(ValueError,match='uncertain'):j.once('a',lambda:b'no')
    assert calls==[1]


def test_lost_paid_response_keeps_started_receipt(tmp_path):
    j=Journal(tmp_path)
    def fail():raise TimeoutError()
    with pytest.raises(TimeoutError):j.once('a',fail)
    with pytest.raises(ValueError,match='uncertain'):Journal(tmp_path).once('a',lambda:pytest.fail('repeat'))


def test_provider_routes_are_fixed_and_no_tools_or_storage(plan,conditions,media):
    calls=[]
    def handler(r):
        calls.append(r);body=json.loads(r.content)
        assert r.url.host=='api.openai.com'
        if r.url.path=='/v1/responses':
            assert body['store'] is False and 'tools' not in body
            assert body['text']['format']['strict'] is True
            return httpx.Response(200,json={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':plan.model_dump_json()}]}]})
        if r.url.path=='/v1/images/generations':
            assert body['n']==1 and body['output_format']=='png'
            return httpx.Response(200,json={'data':[{'b64_json':base64.b64encode(media[0]).decode()}]})
        assert r.url.path=='/v1/audio/speech' and body['response_format']=='wav'
        return httpx.Response(200,content=media[1])
    p=OpenAI('test','text','image','tts','voice',transport=httpx.MockTransport(handler))
    try:
        assert p.plan(source(conditions)).title==plan.title
        assert p.image('test')==media[0];assert p.speech('test')==media[1]
        assert len(calls)==3
    finally:p.close()


@pytest.mark.parametrize('payload',[{'status':'incomplete'}, {'status':'completed','output':[{'type':'message','content':[{'type':'refusal','refusal':'no'}]}]}])
def test_provider_rejects_incomplete_or_refused_output(payload,conditions):
    p=OpenAI('key','t','i','s','v',transport=httpx.MockTransport(lambda r:httpx.Response(200,json=payload)))
    try:
        with pytest.raises(ValueError):p.plan(source(conditions))
    finally:p.close()


def test_invented_evidence_fails(plan,conditions):
    plan.evidenceRefs=['imagined']
    p=OpenAI('key','t','i','s','v',transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':plan.model_dump_json()}]}]})))
    try:
        with pytest.raises(ValueError,match='invented_evidence'):p.plan(source(conditions))
    finally:p.close()


def test_provider_error_and_redirect_not_retried(conditions):
    calls=[]
    def handler(r):calls.append(r);return httpx.Response(302,headers={'location':'https://evil.invalid'})
    p=OpenAI('key','t','i','s','v',transport=httpx.MockTransport(handler))
    try:
        with pytest.raises(ValueError):p.plan(source(conditions))
        assert len(calls)==1
    finally:p.close()


def test_model_output_size_is_bounded(conditions):
    p=OpenAI('key','t','i','s','v',transport=httpx.MockTransport(lambda r:httpx.Response(200,content=b'a'*512001)))
    try:
        with pytest.raises(ValueError,match='too_large'):p.plan(source(conditions))
    finally:p.close()


@pytest.mark.parametrize('url',['http://example.com','https://example.com/path','https://user:pass@example.com','https://example.com?key=secret'])
def test_bridge_rejects_insecure_or_ambiguous_origins(url):
    with pytest.raises(ValueError):Bridge(url,'x'*32)


def test_real_mp4_composition_with_mocked_generation(tmp_path,monkeypatch,plan,conditions,media):
    # This test exercises the real encoder, not a fabricated MP4/header fixture.
    font=next((p for p in [Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.is_file()),None)
    assert shutil.which('ffmpeg') and font, 'FFmpeg and a test font must be installed'
    monkeypatch.setenv('PRODUCTION_FONT',str(font))
    class Provider:
        profile='fixture/ffmpeg-v1'
        calls=0
        def image(self,prompt):self.calls+=1;return media[0]
        def speech(self,text):self.calls+=1;return media[1]
    provider=Provider();j=Journal(tmp_path)
    path,info=render(plan,conditions,j,provider)
    streams=probe(path)['streams']
    assert {s['codec_name'] for s in streams}=={'h264','aac'}
    assert info['width']==1080 and info['height']==1920 and 1<=info['duration']<=4
    assert file_hash(path) and j.read('timeline.json')[0]['caption']==plan.scenes[0].caption
    # A repeat reuses paid inputs. A changed plan cannot silently reuse them.
    render(plan,conditions,j,provider)
    assert provider.calls==2
    changed=plan.model_copy(deep=True);changed.scenes[0].narration='Changed'
    with pytest.raises(ValueError,match='render_inputs_changed'):render(changed,conditions,j,provider)


def test_worker_requires_consent_before_generation(tmp_path,plan,conditions):
    class B:
        def guard(self,j):pass
    class P:
        def plan(self,s):pytest.fail('called without consent')
    job={'id':'00000000-0000-4000-8000-000000000001','task':'plan','consentText':False,'source':source(conditions)}
    with pytest.raises(ValueError,match='consent'):execute(job,tmp_path,B(),P(),None)


def test_worker_finishes_structured_plan_without_uploading(tmp_path,plan,conditions):
    calls=[]
    class B:
        def guard(self,j):pass
        def call(self,a,**kw):calls.append((a,kw))
    class P:
        text_model='test'
        def plan(self,s):return plan
    job={'id':'00000000-0000-4000-8000-000000000001','lease':'lease','task':'plan','consentText':True,'source':source(conditions)}
    execute(job,tmp_path,B(),P(),None)
    assert calls[0][0]=='finish-plan' and calls[0][1]['plan']['scenes']


def test_streaming_wav_unknown_length_is_normalized(media):
    import io, struct, wave
    raw=bytearray(media[1]);struct.pack_into('<I',raw,4,0xffffffff)
    marker=raw.index(b'data');struct.pack_into('<I',raw,marker+4,0xffffffff)
    p=OpenAI('key','t','i','s','v',transport=httpx.MockTransport(lambda r:httpx.Response(200,content=bytes(raw))))
    try:
        normalized=p.speech('Hello')
        with wave.open(io.BytesIO(normalized)) as audio:
            assert 0 < audio.getnframes()/audio.getframerate() < 3
            assert len(audio.readframes(audio.getnframes())) < 200000
    finally:p.close()
