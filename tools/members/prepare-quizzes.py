"""Import existing public quizzes without changing their questions or presentation."""
from html.parser import HTMLParser
from pathlib import Path
from hashlib import sha256
import json, re

ROOT = Path(__file__).resolve().parents[2]
class Node:
    def __init__(self, tag='', parent=None): self.tag,self.parent,self.children=tag,parent,[]
    def text(self): return ''.join(c if isinstance(c,str) else c.text() for c in self.children)
    def find(self, tag): return next((c for c in self.children if isinstance(c,Node) and c.tag==tag),None)
    def has(self, tag): return self.tag==tag or any(c.has(tag) for c in self.children if isinstance(c,Node))
class Parser(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.root=Node(); self.current=self.root
    def handle_starttag(self,tag,attrs):
        n=Node(tag,self.current); self.current.children.append(n)
        if tag not in ['br','hr','img','input','meta','link']: self.current=n
    def handle_endtag(self,tag):
        n=self.current
        while n.parent and n.tag!=tag: n=n.parent
        if n.parent: self.current=n.parent
    def handle_data(self,data): self.current.children.append(data)
def clean(value): return re.sub(r'\s+',' ',value).strip()
quizzes=[]
for path in sorted(ROOT.glob('QuizQuestions-*/*.html')):
    source=path.read_text(encoding='utf-8-sig')
    front=re.match(r'---\s*\n(.*?)\n---\s*\n',source,re.S)
    if not front or not re.search(r'layout:\s*QandA-TEMPLATE2?\s*$',front[1],re.M): continue
    if re.search(r'^learning_resource_id:',front[1],re.M): continue
    parser=Parser(); parser.feed(source[front.end():]); ol=parser.root.find('ol')
    if not ol: raise ValueError('Missing questions: '+str(path))
    questions=[]
    for q in (c for c in ol.children if isinstance(c,Node) and c.tag=='li'):
        ul=q.find('ul')
        if not ul: raise ValueError('Missing options: '+str(path))
        opts=[n for n in ul.children if isinstance(n,Node) and n.tag=='li']
        text=lambda n: clean(''.join(c if isinstance(c,str) else c.text() for c in n.children if not isinstance(c,Node) or c.tag not in ['ul','em']))
        correct=[i for i,o in enumerate(opts) if any(c.has('strong') for c in o.children if isinstance(c,Node) and c.tag!='ul')]
        if not correct: raise ValueError('No correct answer: '+str(path))
        questions.append(dict(id='q'+str(len(questions)+1),prompt=text(q),options=[text(o) for o in opts],correct=correct,hint=clean(q.find('em').text()) if q.find('em') else '',explanation='',reference=''))
    rel=path.relative_to(ROOT).as_posix(); title=re.search(r'^title:\s*(.+)$',front[1],re.M)[1].strip().strip('"\'')
    category=path.parent.name.replace('QuizQuestions-','')
    quizzes.append(dict(id='legacy-'+sha256(rel.encode()).hexdigest()[:24],kind='Quiz',title=title+' · '+category,legacy=True,legacyUrl='/'+rel,state='published',version=1,questions=questions))
target=ROOT/'tools/members/functions/quiz-catalog.json'
target.write_text(json.dumps(quizzes,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'data/quiz-index.json').write_text(json.dumps([{k:q[k] for k in ['id','title','legacyUrl','version']}|{'questionCount':len(q['questions'])} for q in quizzes],ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Prepared',len(quizzes),'public quizzes with',sum(len(q['questions']) for q in quizzes),'questions. Original pages and settings are unchanged.')
