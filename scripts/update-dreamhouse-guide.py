from pathlib import Path
from io import BytesIO
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

root=Path(__file__).resolve().parents[1]
source=Path(r'C:/Users/desko/Claude/Projects/온라인결제/3. 드림아카데미 X 드림하우스/1. 드림하우스 안내서/드림하우스 안내서.pdf')
pdfmetrics.registerFont(TTFont('Malgun',r'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBold',r'C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('Malgun',normal='Malgun',bold='MalgunBold')
style=ParagraphStyle('body',fontName='Malgun',fontSize=14,leading=24,wordWrap='CJK',textColor=HexColor('#1f2937'))
replacements={
1: ('주변 위치 안내',[
('주요 장소', '그랜드몰: 차량 약 5분, 트라이시클 이용 가능<br/>드림아카데미: 차량 약 5분, 트라이시클 이용 가능<br/>제이파크 리조트: 차량 약 10분<br/>블루워터 리조트: 차량 약 15~20분'),
('식당 · 주변 지역','모리 식당: 베이스워터 마시와 게이트<br/>88식당: 뉴타운, 차량 약 20~25분<br/>뉴타운 엘지 가든: 차량 약 20~25분'),
('이용 안내','교통 상황에 따라 소요 시간은 달라질 수 있습니다.<br/>플레이드림은 운영이 종료되어 이용 장소 안내에서 제외했습니다.')]),
19: ('패키지 투어 셔틀 신청 안내',[
('어플(App)을 통한 신청','드림아카데미 어플에 로그인한 후 <b>투어 셔틀</b> 메뉴에서 날짜·목적지·탑승자를 선택해 신청해주세요. 신청 내역을 확인하고, 변경·취소가 필요한 경우 어플에 안내된 절차를 이용해주세요.'),
('사전 예약 · 마감','모든 셔틀은 사전 예약제로 운영됩니다.<br/><b>탑승 전날 오후 4시 30분까지</b> 신청해주세요.<br/>토·일·월요일 탑승분은 직전 금요일 오후 4시 30분까지 신청해주세요.<br/>신청 접수: 월~금. 토·일 및 당일 신청은 불가합니다.<br/>모든 시간은 세부 현지 시간 기준입니다.'),
('꼭 확인해주세요','자리 여유가 있어도 미예약 시 탑승할 수 없습니다. 종이 신청서를 작성하는 방식은 어플 신청으로 변경되었습니다. 채널이나 현지 직원에게 전달만 한 경우 신청이 완료된 것으로 처리되지 않습니다.<br/><br/>패키지 투어 셔틀의 이용 제한과 탑승 유의사항은 다음 페이지를 확인해주세요.')]),
22: ('애프터스쿨 · 필드트립 신청 안내',[
('어플(App)을 통한 신청','드림아카데미 어플에서 <b>애프터스쿨 / 필드트립</b> 메뉴를 열고, 프로그램·날짜·학생을 선택해 신청해주세요. 신청 후 내 신청 내역에서 접수 내용을 확인해주세요.'),
('애프터스쿨은 시작일 4일 전 마감','재료 및 차량 준비를 위해 <b>마감 이후 추가 신청은 불가</b>합니다. 미리 신청해주세요. 신청 접수는 월~금 오후 4시 50분까지이며, 마감일이 주말이면 직전 금요일 오후 4시 50분까지 신청해주세요.'),
('필드트립은 7일 전 마감','필드트립은 별도 기준에 따라 7일 전까지 신청해주세요. 프로그램의 실제 일정과 상세 안내는 어플에서 확인하실 수 있습니다.'),
('취소 및 이용 제한','당일 신청은 불가하며 미예약 시 수업에 참여할 수 없습니다.<br/>당일 무단 취소 또는 취소 2회 누적 시 이후 수업 신청이 제한됩니다.<br/>종이 신청서 대신 어플을 이용해주세요. 채널이나 현지 직원에게 전달만 한 경우 접수로 처리되지 않습니다.')]),
25: ('상담 채널 · 연락 안내',[
('행복한드림하우스','드림하우스 투숙자 전용 상담 채널입니다.<br/>상담 시간: 월~토 오전 8시~오후 6시 (세부 현지 시간)<br/>하우스 내 문제나 수리가 필요한 경우 반드시 채널로 연락해주세요. 헬퍼에게 구두로 전달하면 대처가 늦어질 수 있습니다.'),
('세부드림아카데미','수업·교육 관련 상담 채널입니다.<br/>상담 시간: 월~금 오전 8시~오후 5시 (세부 현지 시간)<br/>카카오톡에서 채널명을 검색해주세요.'),
('응급 상황 연락처','<b>09292932991</b><br/>수도 파열 등 중대한 응급 상황에 전화해주세요. 인터넷 연결 등 일반 문의는 상담 채널을 이용해주세요.'),
('운영 종료 안내','플레이드림은 운영이 종료되었습니다. 기존 플레이드림 채널·위치 안내는 더 이상 사용하지 않습니다.')])}
def page(title,sections,num):
    stream=BytesIO(); c=canvas.Canvas(stream,pagesize=(595.5,842.25))
    c.setFillColor(HexColor('#facc15'));c.roundRect(36,746,523,57,12,fill=1,stroke=0)
    c.setFillColor(HexColor('#111827'));c.setFont('MalgunBold',23);c.drawString(51,765,title)
    y=713
    for heading,body in sections:
        c.setFont('MalgunBold',17);c.setFillColor(HexColor('#264b74'));c.drawString(42,y,heading);y-=15
        p=Paragraph(body,style);_,height=p.wrap(509,y-60)
        if y-height<65: raise ValueError(f'Page {num} overflow')
        p.drawOn(c,42,y-height);y-=height+35
    c.setStrokeColor(HexColor('#d1d5db'));c.line(36,46,559,46)
    c.setFont('Malgun',9);c.setFillColor(HexColor('#6b7280'));c.drawString(36,29,'드림하우스 이용 안내 · 신청 방식 및 운영 종료 안내 반영 2026.09.11')
    c.drawRightString(559,29,str(num));c.save();return PdfReader(stream).pages[0]
reader=PdfReader(source);writer=PdfWriter()
for i,p in enumerate(reader.pages): writer.add_page(page(*replacements[i],i+1) if i in replacements else p)
out=root/'public/guides/dreamhouse-guide-20260911.pdf';out.parent.mkdir(parents=True,exist_ok=True)
with out.open('wb') as f: writer.write(f)
check=PdfReader(out);assert len(check.pages)==28
for i in replacements: assert len(check.pages[i].extract_text())>100
assert '신청 종이' not in check.pages[19].extract_text()
print(f'Guide updated: {out}; 28 pages, replaced 2/20/23/26, original preserved.')
