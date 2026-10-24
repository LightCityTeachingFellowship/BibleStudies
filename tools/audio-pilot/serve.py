from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import re, os
ROOT=Path(__file__).resolve().parent/'output'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def send_head(self):
        self.byte_range=None
        header=self.headers.get('Range')
        path=Path(self.translate_path(self.path))
        if not header or not path.is_file():return super().send_head()
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',header)
        size=path.stat().st_size
        if not match:return super().send_head()
        a,b=match.groups()
        if not a and not b:return super().send_head()
        start=int(a) if a else max(0,size-int(b))
        end=min(size-1,int(b)) if a and b else size-1
        if start>=size or start>end:
            self.send_response(416);self.send_header('Content-Range','bytes */'+str(size));self.send_header('Content-Length','0');self.end_headers();return None
        stream=path.open('rb');stream.seek(start);self.byte_range=(start,end)
        self.send_response(206);self.send_header('Content-type',self.guess_type(str(path)));self.send_header('Accept-Ranges','bytes');self.send_header('Content-Range','bytes '+str(start)+'-'+str(end)+'/'+str(size));self.send_header('Content-Length',str(end-start+1));self.end_headers();return stream
    def copyfile(self,source,output):
        if not self.byte_range:return super().copyfile(source,output)
        remaining=self.byte_range[1]-self.byte_range[0]+1
        while remaining:
            chunk=source.read(min(65536,remaining))
            if not chunk:break
            try:output.write(chunk)
            except (BrokenPipeError,ConnectionResetError):break
            remaining-=len(chunk)
if __name__=='__main__':
    print('Local-only listening comparison: http://127.0.0.1:8765/review.html',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
