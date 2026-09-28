# -*- coding: utf-8 -*-
"""生成高拍仪扫描件风格的《产品生产每日登记表》PDF（复刻用户模板版式）"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle

pdfmetrics.registerFont(TTFont('Songti', '/System/Library/Fonts/Supplemental/Songti.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('SongtiBold', '/System/Library/Fonts/Supplemental/Songti.ttc', subfontIndex=2))  # 黑体面

GREEN = colors.HexColor('#2e8b57')
RED = colors.HexColor('#c0392b')

title_style = ParagraphStyle('t', fontName='SongtiBold', fontSize=20, leading=26, alignment=1)
info_style = ParagraphStyle('i', fontName='Songti', fontSize=11, leading=14, alignment=0)
cell = ParagraphStyle('c', fontName='Songti', fontSize=9.5, leading=12, alignment=1)
cell_l = ParagraphStyle('cl', fontName='Songti', fontSize=9.5, leading=12, alignment=0)
head = ParagraphStyle('h', fontName='SongtiBold', fontSize=9.5, leading=12, alignment=1)

OUT = '/Users/rock/Documents/cursor代码存档/2026钢铁项目/绿低平台补充功能/绿低功能设计/outputs/产品生产每日登记表-高拍仪-20260901.pdf'

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=36, rightMargin=36, topMargin=42, bottomMargin=36,
                        title='产品生产每日登记表', author='发电车间')
story = []

story.append(Paragraph('产品生产每日登记表', title_style))
story.append(Spacer(1, 10))
story.append(Paragraph('部门/车间：<u>发电车间</u>　　　　　　　　登记人：<u>李建国</u>　　　　　　　　填表日期：<u>2026年9月1日</u>', info_style))
story.append(Spacer(1, 4))

def chk(yes):
    # 宋体缺 ☑ 字形：用「是√ 否□」文字方案，√ 用颜色区分（有字形，渲染可靠）
    if yes:
        return Paragraph('是<font color="#2e8b57">√</font>　否□', cell)
    return Paragraph('是□　否<font color="#c0392b">√</font>', cell)

def plain():
    return Paragraph('是□　否□', cell)

header = ['序号', '生产日期', '产品名称', '规格', '生产数量', '订单数量', '是否完成', '差量', '负责人', '备注']
rows = [
    ['1', '09-01', '上网电量', '35kV', '86.4', '85.0', True, '+1.4', '张伟', '万kWh'],
    ['2', '09-01', '上网电量', '10kV', '42.1', '42.0', True, '+0.1', '张伟', '万kWh'],
    ['3', '09-01', '外供蒸汽', '0.8MPa 饱和', '512.0', '500.0', True, '+12.0', '王强', 't'],
    ['4', '09-01', '外供蒸汽', '1.0MPa 310℃', '288.5', '280.0', True, '+8.5', '王强', 't'],
    ['5', '09-01', '压缩空气', '0.7MPa', '36.2', '35.0', True, '+1.2', '刘敏', '万Nm³'],
    ['6', '09-01', '除盐水', '二级反渗透', '208.0', '200.0', True, '+8.0', '刘敏', 't'],
    ['7', '09-01', '纯水', '电导率≤0.1', '46.5', '45.0', True, '+1.5', '陈浩', 't'],
    ['8', '09-01', '热风', '120℃', '95.0', '90.0', True, '+5.0', '陈浩', '万m³'],
    ['9', '09-01', '冷冻水', '7/12℃', '120.0', '110.0', True, '+10.0', '赵磊', 't'],
    ['10', '09-01', '上网电量', '35kV(午后)', '84.8', '85.0', False, '-0.2', '张伟', '万kWh'],
    ['11', '09-01', '炉渣回收', '粒径≤5mm', '18.6', '15.0', True, '+3.6', '赵磊', 't'],
    ['12', '09-01', '压缩空气', '0.7MPa(备用)', '18.4', '18.0', True, '+0.4', '刘敏', '万Nm³'],
    ['13', '09-01', '上网电量', '10kV(晚峰)', '41.6', '42.0', False, '-0.4', '张伟', '万kWh'],
    ['14', '09-01', '外供蒸汽', '0.6MPa', '156.3', '150.0', True, '+6.3', '王强', 't'],
]

data = [[Paragraph(h, head) for h in header]]
for i, r in enumerate(rows):
    data.append([Paragraph(r[0], cell), Paragraph(r[1], cell), Paragraph(r[2], cell_l),
                 Paragraph(r[3], cell_l), Paragraph(r[4], cell), Paragraph(r[5], cell),
                 chk(r[6]), Paragraph(r[7], cell), Paragraph(r[8], cell), Paragraph(r[9], cell_l)])
empty_start = len(rows)
for j in range(empty_start, 20):
    n = str(j + 1)
    data.append([Paragraph(n, cell), Paragraph('', cell), Paragraph('', cell_l), Paragraph('', cell_l),
                 Paragraph('', cell), Paragraph('', cell), plain(), Paragraph('', cell),
                 Paragraph('', cell), Paragraph('', cell_l)])

col_w = [24, 46, 62, 66, 48, 48, 56, 38, 42, 50]  # 共 480
table = Table(data, colWidths=col_w, rowHeights=[30] + [26.5] * (len(data) - 1))
table.setStyle(TableStyle([
    ('GRID', (0, 0), (-1, -1), 0.7, colors.black),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f2f2f2')),
    ('LEFTPADDING', (0, 0), (-1, -1), 3),
    ('RIGHTPADDING', (0, 0), (-1, -1), 3),
]))
story.append(table)

doc.build(story)
print('OK', OUT)
