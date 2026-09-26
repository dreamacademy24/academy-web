import sys, json, asyncio
from pathlib import Path
sys.path.insert(0,str(Path('tmp/chinese-tools').resolve()))
import edge_tts
words=json.loads(Path('public/mandarin/vocabulary.json').read_text(encoding='utf8'))
out=Path('public/mandarin/audio');out.mkdir(parents=True,exist_ok=True)
async def main():
    sem=asyncio.Semaphore(3)
    async def one(w):
        dest=out/(w['id']+'.mp3')
        if dest.exists() and dest.stat().st_size>1000:return
        async with sem:
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(w['zh'],'zh-CN-XiaoxiaoNeural',rate='-15%').save(str(dest))
                    print(w['id']+' OK',flush=True)
                    return
                except Exception as e:
                    if attempt==2:raise
                    await asyncio.sleep(2)
    await asyncio.gather(*(one(w) for w in words))
    assert all((out/(w['id']+'.mp3')).stat().st_size>1000 for w in words)
    print('Verified 84 Mandarin MP3 files.',flush=True)
asyncio.run(main())
