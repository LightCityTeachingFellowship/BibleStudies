from pathlib import Path
import json,subprocess,re
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output'
report=json.loads((OUT/'report.json').read_text(encoding='utf-8'))
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
titles={v['id']:v['title'] for v in manifest['recordings']}
for v in report['sources']:
    if titles.get(v['id']):v['title']=titles[v['id']]
# Verify each reference preserves the exact encoded audio packet content.
def audio_hash(path):
    r=subprocess.run([str(ROOT/'runtime'/'ffmpeg.exe'),'-nostdin','-v','error','-i',str(path),'-map','0:a:0','-c:a','copy','-f','hash','-hash','sha256','-'],capture_output=True,text=True,check=True)
    return r.stdout.strip()
for v in report['sources']:
    original=audio_hash(ROOT/'input'/v['sourceFile'])
    reference=audio_hash(OUT/'reference'/(v['id']+'.m4a'))
    if original!=reference:raise RuntimeError('Reference packet content differs: '+v['id'])
    v['referencePacketHashVerified']=True
    print('Verified unchanged reference audio: '+v['id'],flush=True)
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
page=(OUT/'review.html').read_text(encoding='utf-8')
import html
for v in report['sources']:
    if titles.get(v['id']):page=page.replace('<h2>'+str(v['number'])+'. '+v['id']+'</h2>','<h2>'+str(v['number'])+'. '+html.escape(titles[v['id']])+'</h2>')
(OUT/'review.html').write_text(page,encoding='utf-8')
lines=['# LightCity: measured five-recording audio pilot','',
'Input: **%.2f hours across five recordings**, **%.2f GB** of video.'%(report['sourceHours'],report['sourceGB']),
'All five downloaded sources use 128 kbps stereo AAC at 44.1 kHz. The original OBS setting was reported as 160 kbps; the original OBS recordings are not the files tested here.','',
'| Audio option | Five recordings | Projected storage for 1,000 similar recordings | Approximate R2 storage/month |','|---|---:|---:|---:|']
labels={'speech':'64 kbps AAC, mono','balanced':'96 kbps AAC, stereo','reference':'128 kbps AAC reference, copied without re-encoding'}
for key in ['speech','balanced','reference']:
    e=report['estimates'][key]
    lines.append('| '+labels[key]+' | %.1f MB | %.1f GB | $%.2f |'%(e['pilotGB']*1000,e['projected1000GB'],e['approxR2MonthlyUSD']))
lines+=['',
'Full batch elapsed time: **%.1f minutes**, using two parallel jobs on this computer, including reference extraction, comparison clips and validation.'%(report['elapsedSeconds']/60),
'This is not a cloud-server benchmark. Listening quality and background playback on phones still require human/device tests.','',
'## Validation','',
'- All 15 full-length files contain audio without video and match the source duration within one second.','- All five reference files match the encoded audio packet hashes of their source videos.','- There are three 45-second timeline samples per version per recording (45 short clips). These positions have not been classified as speech/music.','- Original videos were retained. No media was uploaded or published.','',
'## Listening comparison','',
'Open `output/review.html` in a web browser. Listen to the same early/middle/late excerpt in each version, preferably with headphones. Compare words, singing and instruments, background noise and stereo width. Only one player can play at a time.','',
'## Cost limitations','',
'Projection assumes 1,000 recordings match the average length of these five (about %.2f hours each). It excludes request charges, authentication/backend work, backups, tax and future growth. R2 Standard storage is calculated at $0.015/GB-month after the first 10 GB, with billable storage rounded up; this is a planning estimate, not a bill or spending cap.'%(report['sourceHours']/5),
'Pricing source: https://developers.cloudflare.com/r2/pricing/','',
'The 64 kbps option reduces listener data roughly by half relative to 128 kbps. The reference is the best-quality copy available from these downloads; increasing its bitrate to 160 kbps cannot restore information lost before download.','']
(ROOT/'RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'hours':report['sourceHours'],'minutes':report['elapsedSeconds']/60,'estimates':report['estimates'],'referencePacketHashesVerified':5}),flush=True)
