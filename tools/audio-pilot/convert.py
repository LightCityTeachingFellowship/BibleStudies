from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, subprocess, time, html, math
ROOT=Path(__file__).resolve().parent
TOOLS=ROOT/'runtime'
OUTPUT=ROOT/'output'
OUTPUT.mkdir(exist_ok=True)
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
profiles=[*manifest['profiles'],{'name':'reference','codec':'copy','bitrateKbps':None,'channels':None}]
def probe(path):
    r=subprocess.run([str(TOOLS/'ffprobe.exe'),'-v','error','-show_format','-show_streams','-of','json',str(path)],capture_output=True,text=True,check=True)
    return json.loads(r.stdout)
def run(args):
    r=subprocess.run([str(TOOLS/'ffmpeg.exe'),'-nostdin','-hide_banner','-loglevel','error',*map(str,args)],capture_output=True,text=True)
    if r.returncode:raise RuntimeError(r.stderr[-3000:])
sources=[]
for recording in manifest['recordings']:
    source=ROOT/'input'/recording['sourceFile']
    if not source.is_file():raise FileNotFoundError(source)
    info=probe(source)
    streams=[s for s in info['streams'] if s['codec_type']=='audio']
    if not streams:raise RuntimeError('No audio: '+source.name)
    sources.append({**recording,'durationSeconds':float(info['format']['duration']),'sourceBytes':source.stat().st_size,'sourceAudio':{k:streams[0].get(k) for k in ['codec_name','bit_rate','sample_rate','channels']}})
print('Input: %.2f hours; %.2f GB'%(sum(v['durationSeconds'] for v in sources)/3600,sum(v['sourceBytes'] for v in sources)/1e9),flush=True)
for v in sources:print(v['id']+' source audio: '+json.dumps(v['sourceAudio']),flush=True)
started=time.perf_counter()
def convert(job):
    recording,profile=job
    destination=OUTPUT/profile['name'];destination.mkdir(exist_ok=True)
    audio=destination/(recording['id']+'.m4a')
    source=ROOT/'input'/recording['sourceFile']
    seconds=None
    if not audio.exists():
        temporary=destination/(recording['id']+'.working.m4a')
        if temporary.exists():raise RuntimeError('Incomplete conversion exists: '+str(temporary))
        print('Converting '+recording['id']+' '+profile['name'],flush=True)
        before=time.perf_counter()
        args=['-n','-i',source,'-map','0:a:0','-vn']
        if profile['codec']=='copy':args+=['-c:a','copy']
        else:args+=['-c:a','aac','-b:a',str(profile['bitrateKbps'])+'k','-ac',profile['channels'],'-ar','48000','-threads','2']
        args+=['-map_metadata','-1','-metadata','title='+(recording['title'] or recording['id']),'-metadata','artist=LightCity Teaching Fellowship','-movflags','+faststart',temporary]
        run(args)
        seconds=round(time.perf_counter()-before,2)
        info=probe(temporary)
        if any(s['codec_type']=='video' for s in info['streams']):raise RuntimeError('Unexpected video output')
        if abs(float(info['format']['duration'])-recording['durationSeconds'])>1:raise RuntimeError('Duration mismatch: '+recording['id'])
        temporary.rename(audio)
    info=probe(audio)
    clips=[];clipsDir=OUTPUT/'clips';clipsDir.mkdir(exist_ok=True)
    for label,fraction in [('early',.15),('middle',.50),('late',.85)]:
        start=max(0,min(recording['durationSeconds']*fraction,recording['durationSeconds']-45))
        clip=clipsDir/(recording['id']+'-'+profile['name']+'-'+label+'.m4a')
        if not clip.exists():run(['-n','-ss',round(start,3),'-i',audio,'-t','45','-map','0:a:0','-c:a','copy','-movflags','+faststart',clip])
        clips.append({'label':label,'startSeconds':round(start,2),'path':clip.relative_to(OUTPUT).as_posix()})
    stream=next(s for s in info['streams'] if s['codec_type']=='audio')
    result={'id':recording['id'],'profile':profile['name'],'bitrateKbps':int(stream.get('bit_rate',0))/1000,'channels':stream['channels'],'durationSeconds':float(info['format']['duration']),'bytes':audio.stat().st_size,'conversionSeconds':seconds,'path':audio.relative_to(OUTPUT).as_posix(),'clips':clips}
    print('Ready '+recording['id']+' '+profile['name']+': %.1f MB'%(result['bytes']/1e6),flush=True)
    return result
jobs=[(recording,profile) for recording in sources for profile in profiles]
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(convert,jobs))
elapsed=round(time.perf_counter()-started,2)
summary={}
for profile in profiles:
    total=sum(r['bytes'] for r in results if r['profile']==profile['name'])
    projection=total/len(sources)*1000/1e9
    summary[profile['name']]={'pilotGB':total/1e9,'projected1000GB':projection,'approxR2MonthlyUSD':round(max(0,math.ceil(projection)-10)*.015,2)}
report={'createdAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'elapsedSeconds':elapsed,'parallelJobs':2,'sourceHours':sum(v['durationSeconds'] for v in sources)/3600,'sourceGB':sum(v['sourceBytes'] for v in sources)/1e9,'sources':sources,'outputs':results,'estimates':summary,'estimateCaveat':'Projection assumes the same average duration/quality as these five recordings. R2 Standard at $0.015/GB-month after 10GB free; excludes request/backend/tax/backup costs. Timings are on this computer, not a cloud-server benchmark. Clips are sampled by timeline position, not verified speech/music selections.'}
(OUTPUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
rows=[]
for recording in sources:
    columns=[]
    for profile in profiles:
        result=next(r for r in results if r['id']==recording['id'] and r['profile']==profile['name'])
        clips=''.join('<p>'+html.escape(clip['label'])+' (at '+str(round(clip['startSeconds']/60,1))+' min)</p><audio controls preload="none" src="'+html.escape(clip['path'])+'"></audio>' for clip in result['clips'])
        label='Reference: no further compression' if profile['name']=='reference' else profile['name']+' '+str(profile['bitrateKbps'])+' kbps'
        columns.append('<div><h3>'+html.escape(label)+'</h3><p>'+str(result['channels'])+' channel(s) | Full audio: '+str(round(result['bytes']/1e6,1))+' MB</p><audio controls preload="none" src="'+html.escape(result['path'])+'"></audio><details><summary>Three 45-second comparison clips</summary>'+clips+'</details></div>')
    rows.append('<section><h2>'+str(recording['number'])+'. '+html.escape(recording['title'] or recording['id'])+'</h2><p>'+str(round(recording['durationSeconds']/60,1))+' minutes</p><div class="compare">'+''.join(columns)+'</div></section>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LightCity audio pilot</title><style>body{max-width:1250px;margin:32px auto;padding:0 20px;background:#f5f5f5;color:#252525;font:17px/1.6 system-ui,sans-serif}h1{line-height:1.2}section{background:white;padding:24px;margin:24px 0;border-radius:16px;border:1px solid #ddd}.compare{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}audio{width:100%}summary{cursor:pointer;margin:16px 0}h2{font-size:22px}@media(max-width:800px){.compare{grid-template-columns:1fr}}</style><h1>LightCity audio comparison</h1><p>Local pilot only. Compare spoken words, singing, quiet passages and background noise. Speech is 64 kbps mono; balanced is 96 kbps stereo. Reference copies the downloaded audio without re-encoding; it is not the original OBS file.</p>'''+''.join(rows)+'''<script>document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause()})},true)</script></html>'''
(OUTPUT/'review.html').write_text(page,encoding='utf-8')
print('COMPLETE '+json.dumps({'elapsedSeconds':elapsed,'sourceHours':report['sourceHours'],'estimates':summary}),flush=True)
