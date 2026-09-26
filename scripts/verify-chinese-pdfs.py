import sys
from pathlib import Path
sys.path.insert(0,str(Path('tmp/chinese-tools').resolve()))
import pymupdf as fitz
root=Path('C:/Users/desko/Claude/Artifacts/ChatGPT 저장')
for name,expected in [('cards-duplex',28),('starter-workbook',14),('printing-guide',1)]:
    doc=fitz.open(root/('Little-Mandarin-'+name+'.pdf'))
    print(name,len(doc),'pages')
    assert len(doc)==expected
    for i in ([0,1,6,7,26,27] if name=='cards-duplex' else ([0,1,8,12,13] if name=='starter-workbook' else [0])):
        doc[i].get_pixmap(matrix=fitz.Matrix(1.2,1.2)).save('tmp/chinese-review/'+name+'-'+str(i+1)+'.png')
    if name=='cards-duplex':
        for i in range(14):
            a,b=doc[2*i].get_text(),doc[2*i+1].get_text()
            for n in range(i*6+1,i*6+7):assert str(n).zfill(3) in a and str(n).zfill(3) in b
print('Page counts and all 84 front/back IDs verified.')
