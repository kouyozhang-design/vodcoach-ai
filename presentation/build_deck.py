#!/usr/bin/env python3
"""Build the 奥妙なAI領域 research-talk deck and the spoken manuscript.

The talk is about the wall between wanting something and making it.
A product appears once, as an example, then the talk leaves it.
Terms and quote glosses live in the notes and the manuscript, not as definitions on the slides.
"""

from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

FONT = "游ゴシック"
OUT_DIR = Path(__file__).resolve().parent

INK = RGBColor(0x0C, 0x0E, 0x12)
INK_CARD = RGBColor(0x17, 0x1A, 0x21)
PAPER = RGBColor(0xF3, 0xEF, 0xE6)
PAPER_CARD = RGBColor(0xFF, 0xFC, 0xF7)
INK_TEXT = RGBColor(0x14, 0x16, 0x1C)
CREAM = RGBColor(0xF6, 0xF1, 0xE7)
VERM = RGBColor(0xFF, 0x4B, 0x2B)
GOLD = RGBColor(0xE3, 0xC2, 0x7A)
MUTED_ON_INK = RGBColor(0xA3, 0x9E, 0x96)
MUTED_ON_PAPER = RGBColor(0x6F, 0x6A, 0x62)
LINE_ON_INK = RGBColor(0x2C, 0x30, 0x3A)
LINE_ON_PAPER = RGBColor(0xE1, 0xDB, 0xCE)

W = 13.333333
H = 7.5


def rgb(value: RGBColor) -> RGBColor:
    return value


def set_run_font(run, size: int, color: RGBColor, bold: bool = False) -> None:
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = False
    run.font.color.rgb = color
    run.font.name = FONT
    r_pr = run._r.get_or_add_rPr()
    r_pr.set("lang", "ja-JP")
    r_pr.set("altLang", "en-US")
    for tag in ("latin", "ea", "cs"):
        node = r_pr.find(qn(f"a:{tag}"))
        if node is None:
            node = r_pr.makeelement(qn(f"a:{tag}"))
            r_pr.append(node)
        node.set("typeface", FONT)


def paint(slide, color: RGBColor) -> None:
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def rect(slide, x, y, w, h, color: RGBColor, rounded: float | None = None):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if rounded is not None else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    if rounded is not None:
        try:
            shape.adjustments[0] = rounded
        except Exception:
            pass
    return shape


def write(
    slide,
    x,
    y,
    w,
    h,
    lines: list[str],
    size: int,
    color: RGBColor,
    bold: bool = False,
    align=PP_ALIGN.LEFT,
    spacing: float = 1.0,
    anchor: str = "t",
    space_after: int = 0,
):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = shape.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    anchor_map = {"t": MSO_ANCHOR.TOP, "ctr": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}
    tf.paragraphs[0].alignment = align
    try:
        tf._txBody.bodyPr.set("anchor", {"t": "t", "ctr": "ctr", "b": "b"}[anchor])
    except Exception:
        tf.auto_size = MSO_AUTO_SIZE.NONE
    # clear default paragraph content
    tf.clear()
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        p.space_before = Pt(0)
        p.space_after = Pt(space_after)
        run = p.add_run()
        run.text = line
        set_run_font(run, size, color, bold)
    return shape


def kicker(slide, text: str) -> None:
    write(slide, 0.72, 0.38, 11.8, 0.36, [text], 15, VERM, bold=True)


def footer(slide, page: int, dark: bool) -> None:
    color = MUTED_ON_INK if dark else MUTED_ON_PAPER
    write(slide, 0.72, 7.08, 8.5, 0.28, ["奥妙なAI領域"], 12, color)
    write(slide, 10.4, 7.08, 2.2, 0.28, [f"{page:02d}  /  {len(SLIDES):02d}"], 12, color, align=PP_ALIGN.RIGHT)


def spine(slide) -> None:
    rect(slide, 0, 0, 0.08, H, VERM)


def new_slide(prs, dark: bool):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    paint(slide, INK if dark else PAPER)
    spine(slide)
    return slide


def notes(slide, text: str) -> None:
    frame = slide.notes_slide.notes_text_frame
    frame.text = text.strip()


def chip(slide, x, y, w, h, text, fill, ink, size=16):
    rect(slide, x, y, w, h, fill, rounded=0.4)
    write(slide, x, y, w, h, [text], size, ink, bold=True, align=PP_ALIGN.CENTER, anchor="ctr")




TERMS: dict[str, dict[str, str]] = {
    "生成AI": {
        "reading": "せいせいエーアイ",
        "one": "すでにある答えを探すだけじゃなく、文章やコードや判断を、その場で新しく作るAI。",
        "deep": "検索は、もうネットにあるページを並べる。生成AIは、学習を終えたモデルが、渡された材料から新しい文章やコードや判断を組み立てる。ChatGPTやGeminiに質問する使い方は、その入口。今日の話は、その先で、欲しいものが動きはじめるところ。",
    },
    "人工知能": {
        "reading": "じんこうちのう",
        "one": "1955年の研究提案の題に使われた言葉。機械に、知能の働きをさせようとする研究。",
        "deep": "ジョン・マッカーシー、マービン・ミンスキー、ナサニエル・ロチェスター、クロード・シャノンが、1955年8月31日付の提案書の題に Artificial Intelligence と書いた。会議はその翌年、ダートマス大学で開かれた。言葉の始まりと、会議の年は一年ずれている。",
    },
    "LLM": {
        "reading": "エルエルエム",
        "one": "大規模言語モデル。膨大な文章から、次に来やすい言葉を予測する仕組み。ChatGPTやGeminiの芯。",
        "deep": "Large Language Model。会話も、指摘の文も、コードも、この予測を続けて組み立てている。賢いことと、こちらの願いどおりに動くことは別で、願いの形は頼む文が決める。",
    },
    "プロンプト": {
        "reading": "ぷろんぷと",
        "one": "AIに渡す指示文。成功してほしい形を、自分の言葉で書いたもの。",
        "deep": "役割、見てほしいこと、出してほしくないこと、出力の形が入る。気の利いた一言で終わるより、何ができた状態なのかが書いてある方がぶれにくい。",
    },
    "エージェント": {
        "reading": "えーじぇんと",
        "one": "会話で終わらず、ファイルを書いて、動かして、失敗を読んで直していくAI。",
        "deep": "一問一答は、説明の文章が返ったところで止まる。エージェントは、その先で手順を進める。出来たものを自分で触る仕事は、こちらに残る。",
    },
    "ハルシネーション": {
        "reading": "はるしねーしょん",
        "one": "根拠がないことを、本当みたいな文で出してしまうこと。",
        "deep": "モデルは次の言葉として自然な文を作るので、ない時刻や、ない事実でも、それらしい形になる。嘘とわかる形で出ないのが厄介。見せた材料から言えないことは、空のままにする。最後に信じるかは、自分の目。",
    },
    "推論": {
        "reading": "すいろん",
        "one": "学習を終えたモデルに、今の材料を渡して、出力を出させること。",
        "deep": "学習は、モデルの中身をデータで更新する時間。推論は、更新が終わったモデルを、今日の材料に対して使う時間。",
    },
    "コンテキスト": {
        "reading": "こんてきすと",
        "one": "その一回に、モデルへ見せている材料の全部。",
        "deep": "指示文だけではない。動画、状況、直前までの話も入る。見せていないことは知らない。知っているように書くときが、ハルシネーションになる。",
    },
    "マルチモーダル": {
        "reading": "まるちもーだる",
        "one": "文字だけではなく、動画や画像も一緒に扱えること。",
        "deep": "文章で実況を書き写さなくても、映像そのものを材料にできる、という意味。一例で動画を渡せたのは、これがあるから。",
    },
}


QUOTES = [
    {
        "who": "アラン・チューリング",
        "when": "1950年",
        "where": "A. M. Turing, “Computing Machinery and Intelligence,” Mind, vol. 59, no. 236, October 1950. 論文の書き出し。",
        "en": "I propose to consider the question, ‘Can machines think?’",
        "ja": "次の問いを考えたい。機械は、考えられるか。",
        "note": "歴史の話はこの一文と、次のダートマスの一文で終える。定義の話までは口にしない。",
    },
    {
        "who": "マッカーシー、ミンスキー、ロチェスター、シャノン",
        "when": "1955年8月31日",
        "where": "A Proposal for the Dartmouth Summer Research Project on Artificial Intelligence.",
        "en": "The study is to proceed on the basis of the conjecture that every aspect of learning or any other feature of intelligence can in principle be so precisely described that a machine can be made to simulate it.",
        "ja": "学習も、知能のほかの特徴も、原理としては精密に記述できる。そうすれば、機械にそれを真似させることができる。",
        "note": "口では「精密に書けば、機械は真似できる」と短くする。人工知能という語は、この提案書の題にある。",
    },
    {
        "who": "ジェンスン・フアン",
        "when": "2023年5月29日",
        "where": "台北 Computex の基調講演。CNBC が伝えた発言（2023年5月29日）。NVIDIA の CEO。",
        "en": "We have closed the digital divide. Everyone is a programmer. Now, you just have to say something to the computer.",
        "ja": "デジタルの格差は閉じた。みんな、プログラマーだ。いまは、コンピュータに何かを言うだけでいい。",
        "note": "スライドの「言うだけで、プログラマーだ。」はこの要旨。講演の全文ではない。",
    },
    {
        "who": "イーロン・マスク",
        "when": "2025年8月3日",
        "where": "X への投稿。投稿 ID 1951939365267190205。同じ全文を Mint（2025年8月4日）が引いている。xAI の CEO。",
        "en": "He's right in that AI has taken a lot of the drudgery out of writing software. But, in the fairly near future, writing software will be like being a painter: In the old days, you needed a professional painter to spend many days just to make one selfie (fka a portrait) just so people could know what you looked like! Now, you can make a video selfie instantly & effortlessly. There are still people who paint, of course, but it's recreational, rather than functional.",
        "ja": "ソフトウェアを書く面倒の多くは、AIが持っていった。かなり近い将来、書くことは画家でいるようなことになる。昔は、顔を残すのに職人の画家が何日もかかった。いま、動画の自撮りは一瞬だ。絵を描く人は残る。ただし仕事というより、趣味になる。",
        "note": "「もうそうなった」とは言っていない。近い将来、の話。スライドは比喩の芯だけ。",
    },
    {
        "who": "ダリオ・アモデイ",
        "when": "2024年10月",
        "where": "Dario Amodei, “Machines of Loving Grace,” October 2024. https://darioamodei.com/essay/machines-of-loving-grace 書き出し。Anthropic の CEO。",
        "en": "I think that most people are underestimating just how radical the upside of AI could be, just as I think most people are underestimating how bad the risks could be.",
        "ja": "良いほうの振れ幅も、悪いほうの振れ幅も、みんな見くびっていると思う。",
        "note": "リスクの話を仕事にしている人の文。良い話だけを拾っていない。",
    },
    {
        "who": "ダリオ・アモデイ",
        "when": "2024年10月",
        "where": "同じエッセイ。強力なAIの定義をまとめた文。",
        "en": "We could summarize this as a “country of geniuses in a datacenter”.",
        "ja": "要約すれば、データセンターの中の、天才たちの国だ。",
        "note": "次のスライドの「国じゃなくて、いい」は、アモデイの言葉ではない。引用のあとに、この発表が続ける文。",
    },
]


SLIDES: list[dict] = [
    {
        "n": 1,
        "seconds": 20,
        "terms": [],
        "spoken": """奥妙なAI領域、で話します。
作りたかったものが、ふつうの言葉で動きはじめた、という話です。""",
    },
    {
        "n": 2,
        "seconds": 25,
        "terms": ["生成AI"],
        "spoken": """またAIの話か、って思った人、いますよね。
その感じ、わかります。
生成AIは、すでにある答えを探すだけじゃなく、文章やコードや判断を、その場で新しく作るAIのことです。
検索して答えをもらう話は、もうみんな知っている。今日はその先です。""",
    },
    {
        "n": 3,
        "seconds": 30,
        "terms": [],
        "spoken": """欲しいものは、口で言える。
作る段になると、急に専門家の仕事になる。
その段差が、ずっとありました。
見たい。直したい。動かしたい。言えた瞬間に、頼む先が分かれる。""",
    },
    {
        "n": 4,
        "seconds": 30,
        "terms": ["人工知能"],
        "spoken": """1950年にチューリングが「機械は考えられるか」と書き、1955年にマッカーシーたちが「精密に書けば機械は真似できる」と予想してから、書く言語は長く、専門家の側にありました。
いま、その壁の話をしているのは、作っている側の人です。""",
    },
    {
        "n": 5,
        "seconds": 55,
        "terms": ["LLM"],
        "spoken": """NVIDIAのジェンスン・フアン。2023年5月、台北でこう言いました。
デジタルの格差は閉じた。みんな、プログラマーだ。いまは、コンピュータに何かを言うだけでいい。
原文。We have closed the digital divide. Everyone is a programmer now. You just have to say something to the computer.
十年くらい前は、子どもにコードを習わせろ、がよく聞こえました。彼の言う仕事は逆です。人間が専門の言語を覚えるより、コンピュータの側が、人間の言葉を受け取ればいい。
受け取る側の芯は、大規模言語モデル、短い名前はLLMです。次に来やすい言葉を予測する仕組みで、ChatGPTやGeminiの芯です。""",
    },
    {
        "n": 6,
        "seconds": 55,
        "terms": [],
        "spoken": """xAIのイーロン・マスク。2025年8月の投稿です。
ソフトウェアを書く面倒の多くは、AIが持っていった。かなり近い将来、書くことは画家でいるようなことになる。
昔は、顔を残すのに職人の画家が何日もかかった。いま、動画の自撮りは一瞬です。絵を描く人は残る。ただし仕事というより、趣味になる。
まだ、そうなった、とは言っていません。近い将来、です。
ただ、職人に頼んでいたものの一部は、もう言葉で頼めます。""",
    },
    {
        "n": 7,
        "seconds": 35,
        "terms": ["マルチモーダル", "プロンプト"],
        "spoken": """たとえば、の話を一つだけします。
試合の動画を見て、ダメなところを時刻つきで言って、と日本語で頼んだことがあります。頼む文を、プロンプトと言います。
返ってきたのは、0分12秒、正面のピークを捨てろ、という温度の文でした。
名前は VODCoach です。
文字だけじゃなく、動画も渡しています。種類の違うものを一緒に扱うことを、マルチモーダルと言います。
この文は、出てくる言い方です。特定の一試合の成績報告ではありません。""",
    },
    {
        "n": 8,
        "seconds": 20,
        "terms": [],
        "spoken": """機能の話は、ここまでです。
見てほしいのは、アプリの仕様じゃありません。
一文が、形になった、というところです。
［名前の説明を足さない］""",
    },
    {
        "n": 9,
        "seconds": 40,
        "terms": ["ハルシネーション", "推論", "コンテキスト", "エージェント"],
        "spoken": """それらしい文は、出ます。根拠がないのに、本当みたいに。それをハルシネーションと言います。
学習を終えたモデルに、今の材料を渡して出力させることを、推論と言います。モデルを新しく鍛える時間とは別です。
その一回に見せている材料の全部が、コンテキストです。見せていないことは知りません。
ファイルを書いて、動かして、壊れたら直していく役が、エージェントです。
出来たものを自分で触る仕事は残ります。触らないと、動いたふりが残る。""",
    },
    {
        "n": 10,
        "seconds": 50,
        "terms": [],
        "spoken": """アンソロピックのダリオ・アモデイ。リスクの研究を仕事にしている人です。2024年10月に、自分のサイトで長いエッセイを出しています。
良いほうの振れ幅も、悪いほうの振れ幅も、みんな見くびっている。良い話しかしない人の文ではありません。
同じ文章で、強力なAIをこう要約しています。データセンターの中の、天才たちの国。
原文。a country of geniuses in a datacenter.
［一拍。次のスライドは、こちらの文］""",
    },
    {
        "n": 11,
        "seconds": 35,
        "terms": [],
        "spoken": """国じゃなくて、いい。
この部屋で動くのは、見てほしい一文です。
部活の動画でも、文化祭の出し物でも、バイトの面倒でもいい。
［アモデイの言葉ではない］""",
    },
    {
        "n": 12,
        "seconds": 25,
        "terms": [],
        "spoken": """部活でも、バイトでも、文化祭でもいい。
見てほしいことを、一文にする。
いま、その言語は日本語で始められる。""",
    },
    {
        "n": 13,
        "seconds": 25,
        "terms": ["プロンプト", "エージェント"],
        "spoken": """今夜やるなら、三つです。
見てほしいことを、一文にする。それがプロンプトです。
説明で止めず、動くまで頼む。進めるのはエージェントです。
出来たものを、自分で触る。変だったら、その現象を日本語で返す。""",
    },
    {
        "n": 14,
        "seconds": 25,
        "terms": [],
        "spoken": """奥妙の中身は、言えなかった一文でした。
それを言った側に、壁は動きます。
自分なら、何を一文にしますか。
［ここで終える。補足しない］""",
    },
]


QA = [
    (
        "VODCoachって、結局なに。",
        "試合の動画や、プレイ中の画面を渡すと、時刻つきで次の一手を返すものです。今日の話の証拠として、一文だけ出しました。機能の案内は、ここまでです。",
    ),
    (
        "英語じゃないとダメなのか。",
        "フアンもマスクも、英語で話しています。頼んだ実例は日本語でした。言いたいことが、ふつうの言葉で書けているかが先です。",
    ),
    (
        "それらしい嘘が怖い。",
        "出ます。それがハルシネーションです。アモデイも、悪いほうの振れ幅を見くびるな、と書いています。見せた材料から言えないことは、信じない。最後に触るのは自分です。",
    ),
    (
        "プログラミングは要らないのか。",
        "フアンは、言うだけでプログラマーだ、と言いました。最初の一文は日本語で足ります。出来たものを自分で見る仕事は残ります。そこを飛ばすと、それらしい画面で終わります。",
    ),
]


def note_for(slide: dict) -> str:
    if slide["terms"]:
        block = "\n".join(
            f"{name}（{TERMS[name]['reading']}）: {TERMS[name]['one']}" for name in slide["terms"]
        )
    else:
        block = "このスライドで新しく出す用語はない。"
    return f"""スライド {slide['n']} / {len(SLIDES)}。目安 {slide['seconds']}秒。

{slide['spoken'].strip()}

用語:
{block}
"""


def build(prs: Presentation) -> None:
    s = new_slide(prs, True)
    write(s, 0.72, 1.7, 11.5, 0.34, ["探究発表"], 16, GOLD, bold=True)
    write(s, 0.72, 2.2, 12, 1.3, ["奥妙なAI領域"], 60, CREAM, bold=True)
    rect(s, 0.74, 3.65, 2.05, 0.035, VERM)
    write(s, 0.72, 4.0, 11.2, 1.4, ["作れなかったものが、", "言葉で、動きだす。"], 30, CREAM, spacing=1.15)
    notes(s, note_for(SLIDES[0]))

    s = new_slide(prs, False)
    write(s, 0.72, 1.7, 12, 2.4, ["またAIの話か。"], 54, INK_TEXT, bold=True)
    write(s, 0.72, 3.5, 11, 1.0, ["その感じ、わかります。"], 28, INK_TEXT)
    footer(s, 2, False)
    notes(s, note_for(SLIDES[1]))

    s = new_slide(prs, True)
    write(s, 0.72, 1.7, 12, 2.6, ["欲しい、は言える。", "作る、は専門だった。"], 44, CREAM, bold=True, spacing=1.08)
    write(s, 0.72, 4.8, 11, 0.8, ["その段差が、ずっとあった。"], 24, MUTED_ON_INK)
    footer(s, 3, True)
    notes(s, note_for(SLIDES[2]))

    s = new_slide(prs, True)
    write(s, 0.72, 0.42, 11, 0.36, ["1950"], 16, VERM, bold=True)
    write(s, 0.72, 2.0, 12, 2.2, ["機械は、", "考えられるか。"], 54, CREAM, bold=True, spacing=1.02)
    write(s, 0.72, 5.0, 11, 0.8, ["その後も、書くのは専門家だった。"], 22, MUTED_ON_INK)
    footer(s, 4, True)
    notes(s, note_for(SLIDES[3]))

    s = new_slide(prs, True)
    write(s, 0.72, 0.42, 11.5, 0.36, ["ジェンスン・フアン　　2023"], 16, VERM, bold=True)
    write(s, 0.72, 1.9, 12, 2.4, ["言うだけで、", "プログラマーだ。"], 48, CREAM, bold=True, spacing=1.05)
    write(s, 0.72, 5.05, 11.5, 0.7, ["NVIDIA"], 18, GOLD)
    footer(s, 5, True)
    notes(s, note_for(SLIDES[4]))

    s = new_slide(prs, False)
    write(s, 0.72, 0.42, 11.5, 0.36, ["イーロン・マスク　　2025"], 16, VERM, bold=True)
    write(s, 0.72, 1.9, 12, 2.4, ["書くことは、", "絵を描くことになる。"], 44, INK_TEXT, bold=True, spacing=1.05)
    write(s, 0.72, 5.05, 11.5, 0.7, ["近い将来の話。"], 18, MUTED_ON_PAPER)
    footer(s, 6, False)
    notes(s, note_for(SLIDES[5]))

    s = new_slide(prs, True)
    write(s, 0.72, 0.45, 8, 0.36, ["たとえば"], 16, VERM, bold=True)
    rect(s, 0.72, 1.85, 11.9, 2.15, INK_CARD, rounded=0.06)
    rect(s, 0.72, 1.85, 0.1, 2.15, VERM)
    write(s, 1.15, 1.95, 11, 1.95, ["0分12秒。", "正面ピークを捨てろ。"], 40, CREAM, bold=True, spacing=1.02, anchor="ctr")
    write(s, 0.72, 4.35, 11.5, 1.2, ["日本語で頼んで、返ってきた文。", "VODCoach"], 20, MUTED_ON_INK, spacing=1.25)
    footer(s, 7, True)
    notes(s, note_for(SLIDES[6]))

    s = new_slide(prs, True)
    write(s, 0.72, 2.0, 12, 2.6, ["機能の話は、ここまで。", "一文が、形になった。"], 40, CREAM, bold=True, spacing=1.12)
    footer(s, 8, True)
    notes(s, note_for(SLIDES[7]))

    s = new_slide(prs, False)
    write(s, 0.72, 1.7, 12, 2.3, ["それらしい嘘は、出る。"], 42, INK_TEXT, bold=True)
    write(s, 0.72, 3.5, 11.5, 1.2, ["触るのは、自分。"], 32, INK_TEXT, bold=True)
    write(s, 0.72, 5.3, 8, 0.4, ["ハルシネーション"], 16, VERM, bold=True)
    footer(s, 9, False)
    notes(s, note_for(SLIDES[8]))

    s = new_slide(prs, True)
    write(s, 0.72, 0.42, 11.5, 0.36, ["ダリオ・アモデイ　　2024"], 16, VERM, bold=True)
    write(s, 0.72, 1.7, 12, 2.3, ["良いほうも、悪いほうも、", "見くびっている。"], 40, CREAM, bold=True, spacing=1.08)
    write(s, 0.72, 4.85, 11.5, 0.9, ["データセンターの中に、天才たちの国。"], 20, GOLD)
    footer(s, 10, True)
    notes(s, note_for(SLIDES[9]))

    s = new_slide(prs, True)
    write(s, 0.72, 1.9, 12, 2.6, ["国じゃなくて、いい。", "自分の一文で、いい。"], 44, CREAM, bold=True, spacing=1.08)
    footer(s, 11, True)
    notes(s, note_for(SLIDES[10]))

    s = new_slide(prs, False)
    write(s, 0.72, 1.8, 12, 2.6, ["見てほしいことを、", "一文にする。"], 48, INK_TEXT, bold=True, spacing=1.05)
    write(s, 0.72, 5.0, 11, 0.8, ["部活でも、バイトでも、文化祭でも。"], 22, MUTED_ON_PAPER)
    footer(s, 12, False)
    notes(s, note_for(SLIDES[11]))

    s = new_slide(prs, True)
    steps = [
        ("1", "一文にする"),
        ("2", "動くまで頼む"),
        ("3", "自分で触る"),
    ]
    for i, (num, label) in enumerate(steps):
        y = 1.55 + i * 1.5
        write(s, 0.72, y, 1.1, 1.0, [num], 36, VERM, bold=True, anchor="ctr")
        write(s, 2.15, y, 9, 1.0, [label], 36, CREAM, bold=True, anchor="ctr")
    footer(s, 13, True)
    notes(s, note_for(SLIDES[12]))

    s = new_slide(prs, True)
    write(s, 0.72, 1.6, 12, 2.3, ["言えなかった一文を、", "言う。"], 48, CREAM, bold=True, spacing=1.05)
    write(s, 0.72, 4.6, 11.5, 1.0, ["自分なら、何を一文にする？"], 26, GOLD)
    footer(s, 14, True)
    notes(s, note_for(SLIDES[13]))



def spoken_chars(text: str) -> int:
    kept = []
    skip = False
    for ch in text:
        if ch == "［":
            skip = True
            continue
        if ch == "］":
            skip = False
            continue
        if skip or ch.isspace():
            continue
        kept.append(ch)
    return len(kept)


def manuscript() -> str:
    total = sum(s["seconds"] for s in SLIDES)
    speech = sum(spoken_chars(s["spoken"]) for s in SLIDES)
    lines = [
        "# 奥妙なAI領域　発表原稿",
        "",
        f"7分から10分。スライドは{len(SLIDES)}枚。セリフの目安は {total // 60}分{total % 60:02d}秒、本文は約{speech}字。角括弧の中は、間の取り方なので声には出さない。",
        "",
        "話の芯は、欲しいものと作ることのあいだにあった段差が、ふつうの言葉で動きはじめた、ということ。VODCoachは、その証拠を一つ見せるための例で、機能の紹介では終わらせる。",
        "",
        "引用は、確認できた文だけ。スライドの日本語は要旨で、原文は下に置いた。歴史は二文で終える。アモデイの次の「国じゃなくて、いい」は、本人の言葉ではない。",
        "",
        "用語の意味はセリフに入っている。各スライドの下の説明は、準備のとき用。",
        "",
        "並べ方は、歴史を短くして、いま作っている人の見解を前に出す。製品名は一例で通過して、最後に部屋へ返す。",
        "",
        "## セリフ",
        "",
    ]
    for slide in SLIDES:
        lines.append(f"### {slide['n']}　{slide['seconds']}秒")
        lines.append("")
        lines.append(slide["spoken"].strip())
        lines.append("")
        if slide["terms"]:
            for name in slide["terms"]:
                term = TERMS[name]
                lines.append(f"{name}（{term['reading']}）。{term['one']}")
                lines.append("")
                lines.append(term["deep"])
                lines.append("")
    lines += ["## 聞かれたら", ""]
    for q, a in QA:
        lines += [q, "", a, ""]
    lines += ["## 引用", ""]
    for q in QUOTES:
        lines += [
            f"### {q['who']}　{q['when']}",
            "",
            q["en"],
            "",
            f"訳。{q['ja']}",
            "",
            q["where"],
            "",
            q["note"],
            "",
        ]
    lines += [
        "## 用語",
        "",
    ]
    for name, term in TERMS.items():
        lines += [f"### {name}（{term['reading']}）", "", term["one"], "", term["deep"], ""]
    return "\n".join(lines)


def main() -> None:
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    prs.core_properties.title = "奥妙なAI領域"
    prs.core_properties.subject = "探究発表"
    prs.core_properties.category = "探究発表"
    build(prs)
    pptx = OUT_DIR / "奥妙なAI領域.pptx"
    md = OUT_DIR / "奥妙なAI領域_発表原稿.md"
    prs.save(pptx)
    md.write_text(manuscript(), encoding="utf-8")
    speech = sum(spoken_chars(s["spoken"]) for s in SLIDES)
    seconds = sum(s["seconds"] for s in SLIDES)
    print(f"slides={len(prs.slides)} speech_chars={speech} planned_sec={seconds}")
    print(pptx)
    print(md)


if __name__ == "__main__":
    main()
