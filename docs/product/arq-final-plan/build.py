#!/usr/bin/env python3
"""Generate the local ARQ planning book from programme.json and overview-template.md."""
import pathlib,json,html,re,csv,argparse,hashlib,datetime
P=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=pathlib.Path,default=P.parent);args=parser.parse_args();O=args.output_dir;O.mkdir(parents=True,exist_ok=True)
d=json.loads((P/'programme.json').read_text());phases=d['phases'];records=d['records'];esc=lambda s:html.escape(str(s),quote=True)
subs={**d,**d['stats']};overview=(P/'overview-template.md').read_text()
for k,v in subs.items():
 if isinstance(v,(str,int)):overview=overview.replace('{{'+k+'}}',str(v))
assert not re.search(r'{{\w+}}',overview),'Unresolved overview placeholder'

def inline(s):
 s=esc(s);s=re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)',r'<a href="\2" target="_blank" rel="noopener noreferrer">\1 ↗</a>',s)
 s=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',s);s=re.sub(r'`([^`]+)`',r'<code>\1</code>',s);return s

def md(s):
 out=[];para=[];table=[];lis=[]
 def flush():
  if para:out.append('<p>'+inline(' '.join(para))+'</p>');para.clear()
  if lis:out.append('<ul>'+''.join('<li>'+inline(x)+'</li>' for x in lis)+'</ul>');lis.clear()
  if table:
   rows=[x for x in table if not re.match(r'^\|\s*:?-{3,}',x)];out.append('<div class="table-scroll"><table>')
   for i,row in enumerate(rows):
    vals=row.strip().strip('|').split('|');tag='th' if i==0 else 'td';out.append('<tr>'+''.join(f'<{tag}>'+inline(v.strip())+f'</{tag}>' for v in vals)+'</tr>')
   out.append('</table></div>');table.clear()
 for l in s.splitlines():
  if not l.strip():flush();continue
  if l.startswith('#'):
   flush();level=len(l)-len(l.lstrip('#'));title=l[level:].strip();slug=re.sub('[^a-z0-9]+','-',title.lower()).strip('-');out.append(f'<h{level} id="{slug}">'+inline(title)+f'</h{level}>')
  elif l.startswith('|'):
   if para or lis:flush()
   table.append(l)
  elif l.startswith('- '):
   if para or table:flush()
   lis.append(l[2:])
  else:
   if table or lis:flush()
   para.append(l)
 flush();return '\n'.join(out)

def phase_md(p):
 lines=[f"# {p['id']} · {p['title']}",f"Stage: {p['stage']} · Accountable role: {p['owner']} · State: {p['state']}","",'Dependencies: '+(', '.join(p['depends_on']) or 'None; first integration control phase.'),"",'Existing issues: '+', '.join(f'[#{n}](https://github.com/ruddvz/Arq/issues/{n})' for n in p['source_issues']),"",'Prior slices: '+(', '.join(p['previous_slices']) or 'New lifecycle expansion.'),"",'All REQ-01–REQ-16 apply or need a documented non-applicability decision. Each obligation is a delivery contract; split into bounded issues/PRs only after prerequisites are stable.',""]
 for t in p['obligations']:lines.extend([f"## {t['id']}",t['work'],"",'**Acceptance:** '+t['acceptance'],""])
 lines.extend(['## Gate evidence and handoff','Record integration/source SHA, artefact hashes, commands and actual outputs, fixture/browser/device versions, known gaps, related defects, decision references and rollback. Passing a plan validator or closing an issue is not product evidence. Preserve exact source acceptance and stage constraints.',''])
 return '\n'.join(lines)
allmd=overview+'\n\n# Detailed phase contracts\n\n'
for p in phases:
 content=phase_md(p);(P/'phases'/f"{p['id']}.md").write_text(content);allmd+=content.replace('# ', '## ',1)+'\n\n'
allmd+='\n# Register location and coverage\n\nThe companion programme.json and registers directory contain every captured source record with proposed phase routes, source links and disposition. The HTML presents this register with search and filters. Source stage/applicability controls inclusion; allocated does not mean implemented.\n'
(O/'ARQ-Execution-Plan.md').write_text(allmd)
(O/'ARQ-Plan-Data.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))
for kind in sorted(set(r['kind'] for r in records)):
 rows=[r for r in records if r['kind']==kind];fields=['id','title','state','phases','source','url','disposition','routing_basis','body','head','base','head_branch','base_branch','ahead_main','behind_main','file_count','files','failed_checks']
 with (P/'registers'/(kind.replace(' ','-')+'.csv')).open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
  for r in rows:w.writerow({k:json.dumps(r[k],ensure_ascii=False) if isinstance(r.get(k),(list,dict)) else r.get(k,'') for k in fields})
with (P/'registers/phase-obligations.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['id','phase','phase_title','owner','stage','depends_on','work','acceptance','state']);w.writeheader()
 for p in phases:
  for t in p['obligations']:w.writerow({**t,'phase':p['id'],'phase_title':p['title'],'owner':p['owner'],'stage':p['stage'],'depends_on':', '.join(p['depends_on'])})
with (P/'registers/tracked-paths.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['path','bucket']);w.writeheader();w.writerows(d['tracked_path_inventory'])

cards=[]
for p in phases:
 links=' '.join(f'<a href="https://github.com/ruddvz/Arq/issues/{n}" target="_blank" rel="noopener noreferrer">#{n}</a>' for n in p['source_issues'])
 deps=' '.join(f'<a href="#{n}" class="phase-link">{n}</a>' for n in p['depends_on']) or 'Start here'
 tasks=''.join(f'<div class="obligation"><span class="mono">{t["id"]}</span><p>{esc(t["work"])}</p><p class="accept"><strong>Acceptance</strong> {esc(t["acceptance"])}</p></div>' for t in p['obligations'])
 cards.append(f'<details class="phase" id="{p["id"]}"><summary><span class="phase-number">{p["id"]}</span><div><span class="eyebrow">{esc(p["stage"])}</span><h3>{esc(p["title"])}</h3></div><span class="plus" aria-hidden="true">+</span></summary><div class="phase-content"><div class="meta"><span>Accountable role <b>{esc(p["owner"])}</b></span><span>Prerequisites <b>{deps}</b></span><span>Existing issues <b>{links}</b></span><span>Previous slices <b>{esc(", ".join(p["previous_slices"]) or "New expansion")}</b></span></div><p class="note">Proposed phase · gate not evaluated. All REQ-01–REQ-16 apply or require justified non-applicability. Source issues and accepted ADRs retain authority.</p>{tasks}<a class="back" href="#roadmap">Back to phase index ↑</a></div></details>')
# HTML uses compact metadata + full records, no executable source content.
payload=json.dumps(d,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
options=''.join(f'<option value="{esc(k)}">{esc(k.title())}</option>' for k in sorted(set(r['kind'] for r in records)))
phaseoptions=''.join(f'<option value="{p["id"]}">{p["id"]} · {esc(p["title"])}</option>' for p in phases)
nav=''.join(f'<a href="#{p["id"]}" class="phase-link"><span>{p["id"]}</span>{esc(p["title"])}</a>' for p in phases)
style=(P/'book.css').read_text();client=(P/'book.js').read_text()
htmlout='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>ARQ — Complete execution programme</title><style>'''+style+'''</style></head><body><a class="skip" href="#main">Skip to programme</a><header class="top"><a class="wordmark" href="#top">ARQ<span> / PROGRAMME</span></a><div class="top-right"><span class="edition">15 SEP 2026 · V1.0</span><button id="print">Print / PDF</button></div></header><div class="layout"><aside><nav aria-label="Programme navigation"><a href="#top" class="nav-top">Overview & evidence</a><a href="#roadmap" class="nav-top">48 phase contracts</a><a href="#register" class="nav-top">Source register</a><details class="index"><summary>Phase index</summary>'''+nav+'''</details><div class="sidebar-note">PROPOSED BASELINE<br>Inventory is verified.<br>Product gates remain open.<br><br>Source-linked. Local. No tracking.</div></nav></aside><main id="main"><section class="hero" id="top"><span class="eyebrow">FROM FIRST PRINCIPLES TO PUBLIC PRODUCT</span><h1>A complete path<br>to a dependable ARQ.</h1><p class="lead">One programme for architectural continuity, product craft, reliable files and public delivery.</p><div class="hero-bottom"><p>48 phases <span>/</span> 192 delivery obligations<br>Core → alpha → beta → stable → mature platform</p><span class="status">PLANNING BASELINE<br><b>Release not certified</b></span></div></section><div class="stats"><div><b>'''+str(d['stats']['branches'])+'''</b><span>branches captured</span></div><div><b>'''+str(d['stats']['prs'])+'''</b><span>PRs inventoried</span></div><div><b>'''+str(d['stats']['issues'])+'''</b><span>issues preserved</span></div><div><b>4,080</b><span>tests passed · 4 skipped</span></div></div><section class="reading"><div class="section-kicker">01 / THE DECISION & EVIDENCE</div>'''+md(overview)+'''</section><section id="roadmap"><div class="section-kicker">02 / THE EXECUTION MAP</div><h2>48 phases. Each with a finish line.</h2><p class="intro">Phase numbers organise the lifecycle. Dependencies determine the order. Open a phase to see its owner, source issues, four obligations and acceptance evidence.</p><div class="road-strip"><a href="#E00">E00–E09<br><b>Establish trust</b></a><a href="#E10">E10–E20<br><b>Complete Core</b></a><a href="#E21">E21–E31<br><b>Qualify & launch</b></a><a href="#E32">E32–E47<br><b>Operate & expand</b></a></div><div class="controls"><label>Find a phase<input id="phase-search" type="search" placeholder="Search title, issue or acceptance…"></label><button id="expand">Expand all</button><button id="collapse">Collapse all</button></div><p id="phase-count" class="count" role="status">48 phases</p><div id="phase-cards">'''+''.join(cards)+'''</div></section><section id="register"><div class="section-kicker">03 / THE TRACEABILITY REGISTER</div><h2>Every captured source keeps its place.</h2><p class="intro">Search original IDs, titles, source text, branches and dispositions. Routing preserves coverage; it does not promote a historical requirement into current release scope or certify implementation.</p><div class="register-controls"><label>Search source records<input id="record-search" type="search" placeholder="Try #361, wall, BUG-RISK-001 or AOGRP"></label><label>Source type<select id="kind"><option value="">All source types</option>'''+options+'''</select></label><label>Phase<select id="phase-filter"><option value="">All phases</option>'''+phaseoptions+'''</select></label></div><div class="register-bar"><p id="record-count" class="count" role="status"></p><button id="download">Download filtered JSON</button></div><div id="records"></div><div class="pagination"><button id="previous">← Previous</button><span id="page"></span><button id="next">Next →</button></div></section><footer>ARQ execution programme · Snapshot '''+esc(d['snapshot_time'])+'''<br>Inspected main: <code>'''+esc(d['main_sha'])+'''</code><br>Planning is complete when its coverage is validated. The product is complete only when its release gates are proven.</footer></main></div><script type="application/json" id="programme-data">'''+payload+'''</script><script>'''+client+'''</script></body></html>'''
(O/'ARQ-Execution-Plan.html').write_text(htmlout)
print(json.dumps({'html_bytes':len(htmlout.encode()),'markdown_words':len(allmd.split()),'records':len(records),'phases':len(phases),'obligations':sum(len(p['obligations']) for p in phases)}))
