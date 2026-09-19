import io
import math
import struct
import wave
import pytest
from PIL import Image
from workers.production.runtime import Plan

@pytest.fixture
def plan():
    return Plan(title='A small discovery',description='An original test story.',
      scenes=[{'narration':'Look at the light.','caption':'A small discovery','imagePrompt':'A warm sunrise'}],
      rationale='An exploratory story, not a measured improvement.',evidenceRefs=[],caveats=['Not an effectiveness claim.'])

@pytest.fixture
def conditions():
    return {'format':'short','durationMin':1,'durationMax':4,'visualStyle':'storybook','character':'small bear','language':'ja'}

@pytest.fixture
def media():
    image=io.BytesIO();Image.new('RGB',(128,192),(160,190,210)).save(image,format='PNG')
    audio=io.BytesIO()
    with wave.open(audio,'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(24000)
        f.writeframes(b''.join(struct.pack('<h',int(2000*math.sin(i*2*math.pi*440/24000))) for i in range(24000)))
    return image.getvalue(),audio.getvalue()
