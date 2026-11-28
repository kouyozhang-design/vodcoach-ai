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
    write(slide, 10.4, 7.08, 2.2, 0.28, [f"{page:02d}  /  15"], 12, color, align=PP_ALIGN.RIGHT)


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
        "note": "この一文の直後、チューリングは、機械と思考を辞書の意味で定義しようとするのは危ない、と書いている。定義で争うと、答えが世論調査みたいになる。そうではなく、文章のやりとりで機械と人間を見分けられるか、という問いに差し替えた。",
    },
    {
        "who": "マッカーシー、ミンスキー、ロチェスター、シャノン",
        "when": "1955年8月31日",
        "where": "A Proposal for the Dartmouth Summer Research Project on Artificial Intelligence. 翌1956年の夏に開かれた会議の提案書。",
        "en": "The study is to proceed on the basis of the conjecture that every aspect of learning or any other feature of intelligence can in principle be so precisely described that a machine can be made to simulate it.",
        "ja": "この研究は、次の予想で進める。学習も、知能のほかの特徴も、原理としては精密に記述できる。そうすれば、機械にそれを真似させることができる。",
        "note": "スライドの文は、この予想を短くしたもの。人工知能という語は、この提案書の題にある。",
    },
    {
        "who": "アンドレイ・カーパシー",
        "when": "2023年1月24日",
        "where": "X（旧Twitter）への投稿。@karpathy。",
        "en": "The hottest new programming language is English",
        "ja": "いま一番熱い、新しいプログラミング言語は、英語だ。",
        "note": "OpenAIの共同創業者の一人。画像認識と、自動運転の研究でも知られる。",
    },
    {
        "who": "アンドレイ・カーパシー",
        "when": "2023年2月19日",
        "where": "上の投稿を補足した連続投稿。",
        "en": "GPTs don't “want” to succeed. They want to imitate. You want to succeed, and you have to ask for it.",
        "ja": "GPTは、成功を望んではいない。真似をしようとする。成功したいのは自分で、自分から頼むしかない。",
        "note": "成功の形は、モデルの中にはない。頼む側が書く。",
    },
    {
        "who": "デミス・ハサビス",
        "when": "2010年からのミッション。本人がのちの対話でも同じ文を使っている",
        "where": "DeepMindのミッション。スタンフォード経営大学院での対話で、2010年に投資家へ出した計画として本人が回想している。",
        "en": "Step one, solve intelligence. Step two, use it to solve everything else.",
        "ja": "第一に、知能を解く。第二に、それを使って、ほかのすべてを解く。",
        "note": "DeepMindの共同創業者。スライドの「全部じゃなくていい」は、ハサビスの言葉ではない。引用のあとに、この発表が続ける文。",
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
検索の使い方は、もうみんな知っている。""",
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
        "seconds": 45,
        "terms": [],
        "spoken": """1950年です。アラン・チューリング。人工知能という言葉が出てくるより前に、計算する機械は知的でありうるか、を論文にした人です。
書き出しは、この問いでした。機械は、考えられるか。
原文は、I propose to consider the question, Can machines think?
彼はすぐ続けて、その問いのままは危ない、と書いています。言葉の定義で争っても、答えは世論調査みたいになる。そうじゃなく、文章のやりとりで、機械と人間を見分けられるか。できるかどうかで見よう、と問いを変えた。""",
    },
    {
        "n": 5,
        "seconds": 40,
        "terms": ["人工知能"],
        "spoken": """1955年。ジョン・マッカーシー、マービン・ミンスキー、ナサニエル・ロチェスター、クロード・シャノン。4人で、翌年の夏に集まって研究しようと書いた文書です。
題に、人工知能、とあります。この言葉は、ここから広がりました。
中心の予想は、学習も知能のほかの特徴も、原理としては精密に書ける。そうすれば機械は真似できる、というものでした。
当時、その「精密に書く」は、専門家の言語でした。""",
    },
    {
        "n": 6,
        "seconds": 20,
        "terms": [],
        "spoken": """壁の正体は、頭の良さだけじゃなかった。
書く言語が、専門の側にあった。
［ここで一拍置く］""",
    },
    {
        "n": 7,
        "seconds": 40,
        "terms": [],
        "spoken": """2023年1月24日。アンドレイ・カーパシー。OpenAIの共同創業者の一人で、画像の認識と、自動運転の研究でも知られる人です。
投稿は一行でした。いま一番熱い、新しいプログラミング言語は、英語だ。
原文。The hottest new programming language is English.
1955年に専門家の言葉だった記述が、ふつうの言葉に降りてきた、という報告です。
彼が書いたのは英語です。""",
    },
    {
        "n": 8,
        "seconds": 40,
        "terms": ["LLM", "プロンプト"],
        "spoken": """同じ人が、その年の2月19日に補足しています。
モデルは、成功を望まない。真似をする。成功したいのは自分で、自分から頼むしかない。
原文。GPTs don't want to succeed. They want to imitate. You want to succeed, and you have to ask for it.
ここで言うモデルは、大規模言語モデル、短い名前はLLMです。膨大な文章から、次に来やすい言葉を予測する仕組みで、ChatGPTやGeminiの芯です。
頼む文を、プロンプトと言います。AIへの指示文。成功してほしい形を、自分で書いたものです。""",
    },
    {
        "n": 9,
        "seconds": 35,
        "terms": ["マルチモーダル"],
        "spoken": """たとえば、の話を一つだけします。
試合の動画を見て、ダメなところを時刻つきで言って、と日本語で頼んだことがあります。
返ってきたのは、0分12秒、正面のピークを捨てろ、という温度の文でした。
名前は VODCoach です。
文字だけじゃなく、動画も渡しています。種類の違うものを一緒に扱うことを、マルチモーダルと言います。
この文は、出てくる言い方です。特定の一試合の成績報告ではありません。""",
    },
    {
        "n": 10,
        "seconds": 20,
        "terms": [],
        "spoken": """機能の話は、ここまでです。
見てほしいのは、アプリの仕様じゃありません。
一文が、形になった、というところです。
［名前の説明を足さない］""",
    },
    {
        "n": 11,
        "seconds": 40,
        "terms": ["ハルシネーション", "推論", "コンテキスト", "エージェント"],
        "spoken": """それらしい文は、出ます。根拠がないのに、本当みたいに。それをハルシネーションと言います。
学習を終えたモデルに、今の材料を渡して出力させることを、推論と言います。モデルを新しく鍛える時間とは別です。
その一回に見せている材料の全部が、コンテキストです。見せていないことは知りません。知っているように書くときが、危ない。
ファイルを書いて、動かして、壊れたら直していく役が、エージェントです。会話の答えが返っただけでは、ものは動きません。
それでも、出来たものを自分で触る仕事は残ります。触らないと、動いたふりが残る。""",
    },
    {
        "n": 12,
        "seconds": 45,
        "terms": [],
        "spoken": """デミス・ハサビス。DeepMindの共同創業者です。2010年に、こう置きました。
第一に、知能を解く。第二に、それを使って、ほかのすべてを解く。
原文。Step one, solve intelligence. Step two, use it to solve everything else.
［一拍］
全部じゃなくていい。
自分の、見てほしい一文でいい。
第一人者は、全部を狙った。この部屋で動く壁は、もっと近いところにあります。""",
    },
    {
        "n": 13,
        "seconds": 25,
        "terms": [],
        "spoken": """部活でも、バイトでも、文化祭でもいい。
見てほしいことを一文にできたとき、1955年の人たちが専門家へ渡していた入口に、自分で立てます。
いま、その言語は日本語で始められる。""",
    },
    {
        "n": 14,
        "seconds": 25,
        "terms": ["プロンプト", "エージェント"],
        "spoken": """今夜やるなら、三つです。
見てほしいことを、一文にする。それがプロンプトです。
説明で止めず、動くまで頼む。進めるのはエージェントです。
出来たものを、自分で触る。変だったら、その現象を日本語で返す。""",
    },
    {
        "n": 15,
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
        "カーパシーが書いたのは英語です。頼んだ実例は日本語でした。ふつうの言葉で、成功の形が書けているかが先です。",
    ),
    (
        "それらしい嘘が怖い。",
        "出ます。それがハルシネーションです。見せた材料から言えないことは、信じない。最後に触るのは自分です。",
    ),
    (
        "プログラミングは要らないのか。",
        "最初の一文は、日本語で足ります。出来たものが動くかを自分で見る仕事は残ります。そこを飛ばすと、それらしい画面で終わります。",
    ),
]


def note_for(slide: dict) -> str:
    if slide["terms"]:
        block = "\n".join(
            f"{name}（{TERMS[name]['reading']}）: {TERMS[name]['one']}" for name in slide["terms"]
        )
    else:
        block = "このスライドで新しく出す用語はない。"
    return f"""スライド {slide['n']} / 15。目安 {slide['seconds']}秒。

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
    write(s, 0.72, 0.42, 11, 0.36, ["アラン・チューリング　　1950"], 16, VERM, bold=True)
    write(s, 0.72, 2.0, 12, 2.4, ["機械は、", "考えられるか。"], 54, CREAM, bold=True, spacing=1.02)
    write(s, 0.72, 5.15, 11.5, 0.8, ["Can machines think?"], 20, GOLD)
    footer(s, 4, True)
    notes(s, note_for(SLIDES[3]))

    s = new_slide(prs, False)
    write(s, 0.72, 0.42, 11, 0.36, ["1955　　ダートマスへの提案"], 16, VERM, bold=True)
    write(s, 0.72, 1.7, 12, 2.5, ["精密に書けば、", "機械は真似できる。"], 44, INK_TEXT, bold=True, spacing=1.05)
    write(
        s,
        0.72,
        4.8,
        11.5,
        1.2,
        ["マッカーシー、ミンスキー、", "ロチェスター、シャノン"],
        20,
        MUTED_ON_PAPER,
        spacing=1.2,
    )
    footer(s, 5, False)
    notes(s, note_for(SLIDES[4]))

    s = new_slide(prs, True)
    write(s, 0.72, 2.05, 12, 2.4, ["書く言語が、", "専門側にあった。"], 48, CREAM, bold=True, spacing=1.05)
    footer(s, 6, True)
    notes(s, note_for(SLIDES[5]))

    s = new_slide(prs, True)
    write(s, 0.72, 0.42, 11.5, 0.36, ["アンドレイ・カーパシー　　2023"], 16, VERM, bold=True)
    write(s, 0.72, 1.85, 12, 2.5, ["いちばん熱い言語は、", "英語だ。"], 48, CREAM, bold=True, spacing=1.05)
    write(s, 0.72, 5.1, 11.5, 0.7, ["The hottest new programming language is English"], 18, GOLD)
    footer(s, 7, True)
    notes(s, note_for(SLIDES[6]))

    s = new_slide(prs, False)
    write(s, 0.72, 0.42, 11.5, 0.36, ["アンドレイ・カーパシー　　2023"], 16, VERM, bold=True)
    write(s, 0.72, 1.9, 12, 2.4, ["成功したいのは、", "頼む側だ。"], 48, INK_TEXT, bold=True, spacing=1.05)
    write(s, 0.72, 5.0, 11.5, 1.1, ["You want to succeed,", "and you have to ask for it."], 20, MUTED_ON_PAPER, spacing=1.15)
    footer(s, 8, False)
    notes(s, note_for(SLIDES[7]))

    s = new_slide(prs, True)
    write(s, 0.72, 0.45, 8, 0.36, ["たとえば"], 16, VERM, bold=True)
    rect(s, 0.72, 1.85, 11.9, 2.15, INK_CARD, rounded=0.06)
    rect(s, 0.72, 1.85, 0.1, 2.15, VERM)
    write(s, 1.15, 1.95, 11, 1.95, ["0分12秒。", "正面ピークを捨てろ。"], 40, CREAM, bold=True, spacing=1.02, anchor="ctr")
    write(s, 0.72, 4.35, 11.5, 1.2, ["日本語で頼んで、返ってきた文。", "VODCoach"], 20, MUTED_ON_INK, spacing=1.25)
    footer(s, 9, True)
    notes(s, note_for(SLIDES[8]))

    s = new_slide(prs, True)
    write(s, 0.72, 2.0, 12, 2.6, ["機能の話は、ここまで。", "一文が、形になった。"], 40, CREAM, bold=True, spacing=1.12)
    footer(s, 10, True)
    notes(s, note_for(SLIDES[9]))

    s = new_slide(prs, False)
    write(s, 0.72, 1.7, 12, 2.3, ["それらしい嘘は、出る。"], 42, INK_TEXT, bold=True)
    write(s, 0.72, 3.5, 11.5, 1.2, ["触るのは、自分。"], 32, INK_TEXT, bold=True)
    write(s, 0.72, 5.3, 8, 0.4, ["ハルシネーション"], 16, VERM, bold=True)
    footer(s, 11, False)
    notes(s, note_for(SLIDES[10]))

    s = new_slide(prs, True)
    write(s, 0.72, 0.4, 11.5, 0.34, ["デミス・ハサビス"], 16, VERM, bold=True)
    write(s, 0.72, 1.15, 12, 1.5, ["第一に、知能を解く。", "第二に、残りを全部。"], 26, MUTED_ON_INK, spacing=1.15)
    rect(s, 0.72, 3.05, 2.1, 0.03, VERM)
    write(s, 0.72, 3.4, 12, 2.2, ["全部じゃなくて、いい。", "自分の一文で、いい。"], 40, CREAM, bold=True, spacing=1.08)
    footer(s, 12, True)
    notes(s, note_for(SLIDES[11]))

    s = new_slide(prs, False)
    write(s, 0.72, 1.8, 12, 2.6, ["見てほしいことを、", "一文にする。"], 48, INK_TEXT, bold=True, spacing=1.05)
    write(s, 0.72, 5.0, 11, 0.8, ["部活でも、バイトでも、文化祭でも。"], 22, MUTED_ON_PAPER)
    footer(s, 13, False)
    notes(s, note_for(SLIDES[12]))

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
    footer(s, 14, True)
    notes(s, note_for(SLIDES[13]))

    s = new_slide(prs, True)
    write(s, 0.72, 1.6, 12, 2.3, ["言えなかった一文を、", "言う。"], 48, CREAM, bold=True, spacing=1.05)
    write(s, 0.72, 4.6, 11.5, 1.0, ["自分なら、何を一文にする？"], 26, GOLD)
    footer(s, 15, True)
    notes(s, note_for(SLIDES[14]))


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
        f"7分から10分。スライドは15枚。セリフの目安は {total // 60}分{total % 60:02d}秒、本文は約{speech}字。角括弧の中は、間の取り方なので声には出さない。",
        "",
        "話の芯は、欲しいものと作ることのあいだにあった段差が、ふつうの言葉で動きはじめた、ということ。VODCoachは、その証拠を一つ見せるための例で、機能の紹介では終わらせる。",
        "",
        "引用は、確認できた文だけ。訳は発表用に短くしてある。原文と出典は下にまとめた。ハサビスの引用のあとの「全部じゃなくていい」は、本人の言葉ではない。",
        "",
        "用語の意味はセリフに入っている。各スライドの下の説明は、準備のとき用。",
        "",
        "並べ方は、山を後ろに置いている。製品名で開かず、一例を早く通過して、最後に部屋へ返す。",
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
