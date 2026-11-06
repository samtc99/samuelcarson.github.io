"""Generate review-only finish comparison using the real interactive gallery."""
from pathlib import Path
root = Path(__file__).resolve().parents[2]
page = (root/'review/mobile-deck.html').read_text()
css = '''
<style>
#finish-study {position:fixed;right:18px;bottom:18px;z-index:1000;max-width:calc(100vw - 36px);padding:12px;background:#151516;border:1px solid #444;border-radius:12px;box-shadow:0 8px 35px #0008;font:12px Inter,system-ui;color:#eee}
#finish-study button {padding:9px;border-radius:6px;background:#282829;margin:3px;color:#eee}
#finish-study button[aria-pressed=true] {background:#10b981;color:#07140e}
#finish-study p {margin:4px 3px 8px;color:#aaa}
html[data-finish=hairline] .thumbnail::after,html[data-finish=combined] .thumbnail::after {content:"";position:absolute;inset:0;border-radius:inherit;border:1px solid rgba(0,0,0,.3);pointer-events:none}
html[data-finish=hairline] .card img,html[data-finish=combined] .card img {outline:1px solid rgba(0,0,0,.3);outline-offset:-1px}
html[data-finish=hairline] .hover-preview {border-color:#68686a;box-shadow:0 24px 80px #000b}
html[data-finish=shadow] .thumbnail,html[data-finish=combined] .thumbnail {box-shadow:0 3px 12px #0009}
html[data-finish=shadow] .hover-preview {border-color:#1b1b1d;box-shadow:0 0 0 2px #111113,0 10px 18px #000b,0 32px 65px #000c}
html[data-finish=combined] .hover-preview {border-color:#747477;box-shadow:0 0 0 2px #101012,0 8px 16px #000b,0 28px 60px #000c}
html[data-finish=combined] .hover-preview img {outline:1px solid #0005;outline-offset:-1px}
</style>
'''
panel='''<aside id="finish-study" aria-label="Card finish comparison"><strong>Card finish study</strong><p>Open Browse, then hover a bright photograph.</p><div>
<button data-finish="current">Current</button><button data-finish="hairline">A · Thin edge</button><button data-finish="shadow">B · Shadow</button><button data-finish="combined">C · Edge + shadow</button></div></aside>
<script>
const study=document.getElementById('finish-study');
function finish(value){document.documentElement.dataset.finish=value;study.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.finish===value)));}
study.addEventListener('click',e=>{if(e.target.dataset.finish)finish(e.target.dataset.finish)});
// Keep review controls available inside the modal top layer.
document.querySelectorAll('.browse-trigger').forEach(b=>b.addEventListener('click',()=>document.getElementById('browse').append(study)));
document.getElementById('browse').addEventListener('close',()=>document.body.append(study));
finish('combined');
</script>'''
page=page.replace('</head>',css+'</head>').replace('</body>',panel+'</body>')
(root/'review/card-finishes.html').write_text(page)
print('Built card-finishes.html')
