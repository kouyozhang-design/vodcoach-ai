#!/usr/bin/env python3
"""Build the 奥妙なAI領域 research-talk deck and the spoken manuscript.

Terms appear on slides as labels only. Definitions live in speaker notes
and in the manuscript this script also writes.
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


# ---------------------------------------------------------------------------
# Manuscript source. Spoken lines are what the presenter says.
# one = the sentence said immediately after the term.
# deep = kept for the manuscript, not placed on the slide.
# ---------------------------------------------------------------------------

TERMS: dict[str, dict[str, str]] = {
    "生成AI": {
        "reading": "せいせいエーアイ",
        "one": "すでにあるページを探すだけではなく、文章やコードや指摘を、その場で新しく作るAIのこと。",
        "deep": "検索は、すでにネット上にあるページを並べる。生成AIは、学習を終えたモデルが、渡された材料に対して新しい文章、コード、指摘、台本などを組み立てる。ChatGPTやGeminiに作文を頼む使い方は、生成AIの入口ではある。今日の話の本体は、その先で、生成した結果を動く道具にするところ。",
    },
    "VOD": {
        "reading": "ブイオーディ",
        "one": "生放送ではなく、録画してあとから見る動画のこと。ここでは自分の試合の録画。",
        "deep": "Video On Demandの略。配信中の画面をその場で見ることと対になる。アプリでは、短いクリップと、試合一本の録画の両方をVODとして扱い、プレイ中の画面共有は別モードにしている。録画なので、0分12秒のような時刻を指定して指摘できる。",
    },
    "プロンプト": {
        "reading": "ぷろんぷと",
        "one": "AIに渡す指示文のこと。役割、見てほしいこと、出してはいけないこと、出力の形を書く。",
        "deep": "プログラムの設計書の代わりに、この指示が振る舞いのかなりの部分を決める。上手いプロンプトは気の利いた一文というより、材料、禁止事項、出力の形が具体的な指示。今日の実例では「動画を見て、ダメなところをカードで出して」「およそ40秒ごとに切って」「戦闘のあとだけ喋って」がそれにあたる。専門用語を知らなくても、見てほしいことを具体的に書けば指示は始まる。",
    },
    "チャンク": {
        "reading": "ちゃんく",
        "one": "長いものを、処理できる大きさに分けた一塊のこと。試合はおよそ40秒ごとに切っている。",
        "deep": "試合一本を一度に渡すと、サーバの制限時間も、モデルが一度に受け取れる量も超える。だからクライアント側で時間を区切り、その区間ごとに推論して、最後に試合全体を見て統合する。一区間がチャンク。並行できる数も限って、詰まった区間だけやり直せるようにしてある。",
    },
    "コンテキストウィンドウ": {
        "reading": "こんてきすとうぃんどう",
        "one": "そのモデルが一度に見ていられる量の上限のこと。超えるから、試合は切る。",
        "deep": "モデルは無限に長い入力を一度に覚えられない。この上限をコンテキストウィンドウと言う。中に入るのは指示文だけでなく、ランク、キャラ、悩み、直前までの指摘、動画の区間も含まれる。長いほどトークンを使い、上限に近づくと後ろが落ちたり、時間がかかったりする。40秒分割は、この上限と、サーバが一つの処理に使える時間の両方に合わせた設計。",
    },
    "トークン": {
        "reading": "とーくん",
        "one": "AIが文章を数えるときの、単語より小さい欠片。日本語は文字数と1対1ではない。",
        "deep": "モデルは文章を文字のままではなく、トークンという単位に切って処理する。英語の単語そのものとも限らず、単語をさらに割った断片になることが多い。日本語も「1文字＝1トークン」ではない。プロンプトが長い、試合が長い、言語を増やして同じ内容を重ねる、のいずれもトークンを消費し、コンテキストウィンドウを圧迫する。口頭では、聞かれたときだけでよい。",
    },
    "エージェント": {
        "reading": "えーじぇんと",
        "one": "会話で終わらず、手順を自分で進めて、ファイルを書き、エラーも読んで直すAIのこと。",
        "deep": "ChatGPTに質問して答えの文章をもらうのは、一問一答。エージェントは、その先でツールを選んで使う。ファイルを読む、コードを書く、テストを実行する、失敗のログを見て直す、といった操作を、指示に沿って繰り返す。今日のアプリの中身は、チャットの返答を貼ったものではなく、この繰り返しで増えている。使った道具の名前はCursor。エージェントに渡したあとも、動いたかを人間が触って確かめる仕事は残る。",
    },
    "ツール呼び出し": {
        "reading": "つーるよびだし",
        "one": "AIが会話だけでなく、決まった外部の機能を自分で選んで実行すること。",
        "deep": "ファイルの読み書き、コマンドの実行、検索、決済やログインの窓口を叩く、などがツールにあたる。モデルが「次はこれを使う」と判断して呼ぶので、全部を人間がボタンで順番に押さなくてよくなる。呼ばせる範囲を決めておかないと、関係ない操作まで進む。口頭の本編ではエージェントの説明に含め、単語としては聞かれたときに出す。",
    },
    "マルチモーダル": {
        "reading": "まるちもーだる",
        "one": "文字だけではなく、動画や画像や音声もまとめて扱える、ということ。",
        "deep": "モーダルは入力や出力の種類。テキストだけのモデルは、試合を文章で説明してもらわないと中身が分からない。マルチモーダルなモデルは、録画そのものや画面の画像を入力にして、何が映っているかを材料にできる。このアプリが「動画を見ている」と言えるのは、プロンプトに文章で実況を書き写しているからではなく、映像を渡しているから。",
    },
    "LLM": {
        "reading": "エルエルエム",
        "one": "大規模言語モデル。膨大な文章から、次に来やすい言葉を予測するよう作られたモデル。ChatGPTやGeminiの会話の芯。",
        "deep": "Large Language Modelの略。気の利いた検索窓ではなく、次のトークンを予測する仕組みが本体。会話、要約、指摘文、コードは、この予測を続けて組み立てている。今回のコーチは、映像を扱えるモデルに試合を見せ、出力を指摘のカードや台本という形に縛っている。モデルが賢いことと、出力の形を決めることは別で、形はプロンプトと、アプリ側のチェックが担当している。",
    },
    "推論": {
        "reading": "すいろん",
        "one": "学習を終えたモデルに、今の材料を渡して出力を計算させること。新しく鍛える学習とは別。",
        "deep": "学習は、モデルの中身をデータで更新する時間。推論は、更新が終わったモデルを使って、今日の画面に対する答えを出す時間。プレイ中に約2.5秒おきへ画面を渡しているのが推論。毎回の推論で人間に声をかけると試合にならないので、声にするものだけを選んでいる。クラウドの利用料や待ち時間も、だいたいこの推論の回数と長さで増える。",
    },
    "TTS": {
        "reading": "ティーティーエス",
        "one": "Text to Speech。文字を音声にして読み上げること。",
        "deep": "ライブの指摘は、画面の端に文字で出し、戦闘のあとや膠着のときに声でも出す。常時の実況にはしていない。読み上げは、モデルが「今は言う価値がある」と判断した文に限る。同じ注意の繰り返しは捨てる。",
    },
    "レイテンシ": {
        "reading": "れてんし",
        "one": "渡してから、結果が返ってくるまでの遅さのこと。",
        "deep": "正確でも、10秒後の助言は今の撃ち合いには間に合わない。逆に、速くても毎回喋るとプレイの邪魔になる。ライブでは、画面を見る間隔と、声に出す条件を分けて、遅さと、うるささを両方見ている。録画の解析では、遅さは「いつまでも解析中のまま」という別の問題になる。",
    },
    "ハルシネーション": {
        "reading": "はるしねーしょん",
        "one": "根拠がないことを、本当らしく言ってしまうこと。",
        "deep": "モデルは次の言葉として自然な文を作るので、映っていない武器、いない人数、ない時刻でも、それらしい文になる。嘘と分かる形ではなく、指摘っぽい形で出るのが厄介。このアプリの台本は、映像からタイトルとツッコミが言えないときは空欄にして、埋めさせない。指摘も、画面から言えることに寄せている。それでも最後に、その指摘が自分の試合と一致するかは人間が見る。",
    },
    "ファインチューニング": {
        "reading": "ふぁいんちゅーにんぐ",
        "one": "追加のデータで、モデルの中身そのものを更新して、特定の仕事に寄せること。今回はしていない。",
        "deep": "モデルを自分専用に鍛え直す方法。データと費用と評価が要る。今回やっていない。代わりに、プロンプトと、その回に見せる映像やランクや悩みで振る舞いを変えている。12言語も、モデルを言語の数だけ鍛え直したのではなく、できた指摘を翻訳している。鍛え直す前に、指示と材料でどこまで届くかを見た、という順番の話。",
    },
    "コンテキスト": {
        "reading": "こんてきすと",
        "one": "その一回の推論で、モデルに見せている材料一式のこと。",
        "deep": "指示文だけがコンテキストではない。ゲーム、ランク、キャラ、本人が書いた悩み、直前までの指摘、動画のどの区間か、も含まれる。モデルは、渡されていない試合の事情は知らない。知っているように書くときがハルシネーションになる。コンテキストを何にするかを決めるのが、アプリ側の仕事。",
    },
    "SaaS": {
        "reading": "サース",
        "one": "自分のPCにインストールして買い切るのではなく、ブラウザ越しに使うソフトのこと。",
        "deep": "Software as a Serviceの略。アプリの本体は利用者のPCに全部入っているわけではなく、解析やログインや課金はネットの向こうの機能を使う。だから、利用者はインストール作業より、動画を置くか画面を共有するかに集中できる。提供する側は、その向こうの鍵や制限時間を自分で持つ。",
    },
    "サブスクリプション": {
        "reading": "さぶすくりぷしょん",
        "one": "月ごとなど、期間で払い続ける契約のこと。Proは月額980円。",
        "deep": "一回買って終わりではなく、期間中だけ機能が開く。表示している価格は月額980円。週1本までの無料と、制限を外す有料を分けている。売上の実績は、この発表の根拠にしていない。話してよいのは価格の設計まで。",
    },
    "Webhook": {
        "reading": "うぇぶふっく",
        "one": "こちらから取りにいくのではなく、出来事が起きたときに相手のサービスから届く通知のこと。",
        "deep": "決済画面から戻っただけでは、払ったことにしない。決済サービスが「支払いが確定した」とWebhookで通知し、その通知を確かめてからProを開く。画面を戻しただけ、通信が途中で切れただけ、では有料機能を開けない。通知の署名も確かめる前提。",
    },
    "フェイルクローズ": {
        "reading": "ふぇいるくろーず",
        "one": "判断に必要なものが欠けていたら、機能を開かず、閉じた側に倒すこと。",
        "deep": "フェイルオープンは、よく分からないとき開いてしまう設計。フェイルクローズは、その逆。決済やログインの鍵が揃っていないとき、Proを無料で全開放しない。学校の発表で言うなら「不安なときは、通すのではなく止める」。お金と権限が絡むところでは、この向きが安全側。",
    },
    "冪等": {
        "reading": "べきとう",
        "one": "同じ通知が二回来ても、結果が一回のときと変わらないこと。",
        "deep": "決済の通知は、通信の都合で再送されることがある。そのたびに状態を足し算すると、課金や権限が二重に動く。同じ出来事なら何度届いても結果が同じ、という性質が冪等。口頭では時間がなければ省略してよい。聞かれたら、支払い通知の二重受信の話として出す。漢字は冪等。言うときは「べきとう」。",
    },
    "API": {
        "reading": "エーピーアイ",
        "one": "ソフト同士が、決まった形でお願いを出し合う窓口のこと。",
        "deep": "画面のボタンの奥で、コーチの推論、動画の置き場、ログイン、決済は、それぞれ別のAPIを呼んでいる。人間が見る画面と、ソフトが話す窓口は別。止まったとき、画面の文言だけでは原因が分からず、どの窓口が失敗したかを見る。日本語の「止まっている。原因を見て、直して」は、この窓口の失敗をエージェントに調べさせるときの言い方。",
    },
    "タイムアウト": {
        "reading": "たいむあうと",
        "one": "決めた時間を超えた処理を、待ち続けずに打ち切ること。",
        "deep": "無料枠のサーバ機能には、一つの処理に使える時間の上限がある。試合一本を一つの処理で最後まで待つと、その上限で切れる。だから区間に分け、区間ごとに時間を決め、進みが止まったときだけ失敗にする。進んでいるのに時計だけで全体を失敗にすると、長い試合がいつも途中で死ぬ。",
    },
    "期待値": {
        "reading": "きたいち",
        "one": "一回の勝敗ではなく、同じ判断を繰り返したときに得かどうか、という見方。",
        "deep": "一回うまくいっても、毎回それだと損なら、それは改善点になる。逆に、負けた試合でも、その判断の繰り返しが得なら、結果だけで叱らない。コーチの基準を「勝ったか負けたか」から「繰り返したときに得か」に置いている、という単語。数学の期待値そのものの計算式を、発表で展開する必要はない。",
    },
    "OAuth": {
        "reading": "オーオース",
        "one": "パスワードをこのアプリに預けず、GoogleやAppleやDiscordに本人確認を任せること。",
        "deep": "利用者がすでに持っているアカウントに「この人は本人か」を聞き、結果だけを受け取るログイン。このアプリはメールのリンクに加えて、Google、Apple、Discordを置いている。パスワードを自前で保管しないぶん、預ける先が減る。口頭の本編には入れず、ログインを聞かれたときに出す。",
    },
    "アンチチート": {
        "reading": "あんちちーと",
        "one": "不正ツールを防ぐ、ゲーム側の仕組み。画面の取得を止めることがある。",
        "deep": "プレイ中の画面共有は、ゲームがその取得を許すときにしか映らない。VALORANTのVanguardのように、チート対策がキャプチャを黒くしたり、失敗させたりすることがある。そのときはライブを無理に続けず、録画したVODを見る、と画面でも言っている。口頭では聞かれたときだけでよい。",
    },
}


SLIDES: list[dict] = [
    {
        "n": 1,
        "seconds": 20,
        "dark": True,
        "terms": [],
        "cut": "",
        "spoken": """奥妙なAI領域、というタイトルで話します。
中身は、神秘の講座ではありません。この秋、日本語で頼んだら、少し前まで専門の人の仕事だったことが、動くアプリになった。その話です。
検索して答えをもらう使い方は、今日の本題にしていません。""",
    },
    {
        "n": 2,
        "seconds": 35,
        "dark": False,
        "terms": ["生成AI"],
        "cut": "定義は一文で切って、すぐ「自分の動画を見る道具」に戻る。",
        "spoken": """部屋の空気からいきます。また生成AIか、と思った人。その感覚は合っています。
生成AIは、すでにあるページを探すだけではなく、文章やコードや指摘を、その場で新しく作るAIのことです。
今日の本題は作文のコツではありません。自分の動画を見て、次の一手を言う道具です。""",
    },
    {
        "n": 3,
        "seconds": 30,
        "dark": True,
        "terms": [],
        "cut": "",
        "spoken": """一個だけ聞きます。
最近、誰かにちゃんと見てほしかった瞬間はありますか。
試合でも、部活のフォームでも、バイトのミスでもいい。
欲しいのは検索結果ではなく、自分のその場面を見ることです。
［ここで3秒待つ。返事がなくていい。自分でうなずいて次へ］""",
    },
    {
        "n": 4,
        "seconds": 30,
        "dark": True,
        "terms": ["VOD"],
        "cut": "",
        "spoken": """欲しかった温度は、これです。0分12秒、正面のピークを捨てろ。
VODは、生放送ではなく、録画してあとから見る動画のことです。ここでは自分の試合の録画。
解説動画が欲しいのではありません。自分のその秒を見てほしい。
この文は、アプリが出す言い方の例です。特定の一試合の自慢話ではありません。""",
    },
    {
        "n": 5,
        "seconds": 30,
        "dark": False,
        "terms": [],
        "cut": "五つの仕事は、カードを指しながら一語ずつ。説明を足さない。",
        "spoken": """これを一人で持つのは、少し前まで五つの専門でした。
動画を見て判断する人。指摘を文章にする人。アプリにする人。ログインと月額を付ける人。必要なときだけ声を出す人。
頼む先が、分かれていました。""",
    },
    {
        "n": 6,
        "seconds": 50,
        "dark": True,
        "terms": ["プロンプト", "チャンク", "コンテキストウィンドウ", "エージェント"],
        "cut": "三行のうち声に出すのは一行目だけ。残りは指を差す。",
        "spoken": """書いたのは仕様書ではありません。プロンプトです。プロンプトは、AIに渡す指示文のことです。
声に出すのは一行目だけ。動画を見て、ダメなところをカードで出して。
下の二行は、長い試合の切り方と、喋るタイミングです。チャンクは、処理できる大きさに分けた一塊。一度に見せられる上限を、コンテキストウィンドウと言います。だから試合は、およそ40秒ごとに切っています。
この日本語でファイルを書き、壊れたら直したのは、会話で終わるAIではありません。エージェントです。手順を自分で進めて、コードを書き、エラーも見るAIのこと。使った道具の名前はCursorです。""",
    },
    {
        "n": 7,
        "seconds": 40,
        "dark": True,
        "terms": ["マルチモーダル", "LLM"],
        "cut": "LLMの説明が長くなるなら「ChatGPTの芯と同じ種類。ただし会話で止めない」まで。",
        "spoken": """できた名前が、VODCoach.AIです。画面に出しているコピーは、AIで自分のプレイを論破しろ。
中身はマルチモーダルです。文字だけではなく、動画も一緒に扱う、という意味です。
判断の芯は大規模言語モデル。短い名前はLLM。膨大な文章から、次に来やすい言葉を予測するモデルで、ChatGPTやGeminiの会話の芯も同じ種類です。こちらは会話で止めず、映像を見せてカードにします。
対象はApex LegendsとVALORANT。15秒のクリップ、試合一本、プレイ中の画面共有。見えていた情報から、次の一手だけ出します。
［場が固いときは「論破」を「具体的に反論する」と言い換えてよい］""",
    },
    {
        "n": 8,
        "seconds": 40,
        "dark": True,
        "terms": ["推論", "TTS", "レイテンシ"],
        "cut": "",
        "spoken": """プレイ中、画面はおよそ2.5秒ごとに見ています。学習を終えたモデルに、今の画面を渡して判断させる作業を、推論と言います。モデルを新しく鍛えることとは別です。
毎回は喋りません。戦闘のあとと、動きが止まったときだけ声にします。文字を声にするのがTTSです。
レイテンシ、つまり返事が返るまでの遅さも見ます。それ以上に、うるさいことが試合中は邪魔でした。同じ注意は繰り返しません。""",
    },
    {
        "n": 9,
        "seconds": 35,
        "dark": False,
        "terms": ["ハルシネーション"],
        "cut": "",
        "spoken": """負けの場面から、短い動画のタイトルとツッコミも出ます。編集者は雇っていません。
ただし、映っていないことは書かせません。モデルは、ないことを本当らしく言うことがあります。それをハルシネーションと言います。
タイトルもツッコミも、映像から言えないなら空欄のままです。画面の文は、出てくる言い方の例です。""",
    },
    {
        "n": 10,
        "seconds": 35,
        "dark": True,
        "terms": ["ファインチューニング", "コンテキスト"],
        "cut": "12言語の名前は読まない。指を差して「画面のとおり」でいい。",
        "spoken": """言語は画面の12個です。名前は読み上げません。
モデルの中身を追加データで更新することを、ファインチューニングと言います。それはしていません。
その一回にモデルへ見せている材料を、コンテキストと言います。やったのは、コンテキストの中の指摘を翻訳したことです。日本語で作ったダメ出しが、他の言語でも同じ内容になります。""",
    },
    {
        "n": 11,
        "seconds": 45,
        "dark": False,
        "terms": ["SaaS", "サブスクリプション", "Webhook", "フェイルクローズ", "冪等"],
        "cut": "冪等は省略してよい。売上の質問が来ても、このスライドの最後の二文から出ない。",
        "spoken": """お金は、設計の話だけをします。
形はSaaSです。自分のPCにインストールして買い切るのではなく、ブラウザ越しに使うソフトのことです。
Proは月額980円。サブスクリプション、つまり月ごとに払う形です。
支払った、という知らせはWebhook。こちらから取りにいくのではなく、決済の側から届く通知です。その通知の前に、Proは開きません。
必要な設定が欠けていたら、有料機能は閉じたままです。これをフェイルクローズと言います。
［余力があれば］同じ通知が二回来ても結果を変えないことを、冪等と言います。
今日の主張は売上ではありません。自分だけの悩みは日記です。同じことで困る人がほかにいるなら、商品になります。週に1本は無料で、制限を外したい人だけが月額です。""",
    },
    {
        "n": 12,
        "seconds": 40,
        "dark": True,
        "terms": ["API", "タイムアウト"],
        "cut": "",
        "spoken": """途中で壊れました。
アップロードが0パーセントで止まった。解析中が表示のまま終わらなかった。Safariだけ、進み具合が動かなかった。
ソフト同士の窓口をAPIと言います。その窓口が詰まる。待ちすぎたら打ち切る。打ち切ることをタイムアウトと言います。
直し方の言葉も日本語でした。止まっている。原因を見て、直して。
動いたかどうかは、自分で触って確かめています。そこを渡してしまうと、動いたふりが残ります。""",
    },
    {
        "n": 13,
        "seconds": 35,
        "dark": False,
        "terms": ["期待値"],
        "cut": "",
        "spoken": """ゲームの外でも、頼む文の型は同じです。
見てほしい。具体的にしてほしい。次の一手だけ言ってほしい。
この次の一手は、一回勝ったか負けたかではありません。同じ判断を繰り返したときに得かどうか。それを期待値として見ています。
部活のフォームでも、小テストの間違い方でも、文化祭の列でも、一文にできれば入口は同じです。""",
    },
    {
        "n": 14,
        "seconds": 30,
        "dark": True,
        "terms": ["プロンプト", "エージェント"],
        "cut": "",
        "spoken": """今夜10分やるなら、検索では終わらせません。
見てほしいことを一文にする。それがプロンプトの種です。
答えの文章で止めず、動く画面になるまで頼む。進めるのはエージェントです。
壊れたら、その現象を日本語で返す。専門用語は、直ったあとに覚えれば足ります。""",
    },
    {
        "n": 15,
        "seconds": 25,
        "dark": True,
        "terms": [],
        "cut": "ここで終える。スライド16は出さない。質問が来てから開く。",
        "spoken": """奥妙という字は、奥が深くて、うまく言いにくい、という側の言葉です。
今日やったことの中身は三つです。頼んで、触って、直した。
聞きたいのは感想より、自分なら何を見てもらうか、です。
［沈黙があっていい。自分から補足し始めない］""",
    },
]


QA = [
    {
        "q": "ChatGPTやGeminiと、何が違うのか。",
        "a": "会話が欲しいなら、いつもの生成AIで足ります。違うのは、録画や画面という別の種類の入力を見て、時刻つきの次の一手にして、ログインと月額まで一つの道具にしたことです。会話のモデルを、エージェントとアプリの形まで進めた、という違いです。",
        "terms": ["生成AI", "エージェント", "マルチモーダル"],
    },
    {
        "q": "プログラミングができなくてもいいのか。",
        "a": "最初の一文は日本語で足ります。ただし、出てきたものが動くかを自分で触る仕事は残ります。そこを飛ばすと、それらしい画面で終わります。専門用語は、壊れたあとにその現象と一緒に調べれば間に合います。",
        "terms": ["プロンプト", "エージェント"],
    },
    {
        "q": "本当にお金になったのか。",
        "a": "月額980円で払える仕組みは付けました。売れた金額は、今日の発表の根拠にしていません。見るのは、困っている人が自分以外にいるかどうかです。自分だけの悩みは日記のままです。",
        "terms": ["SaaS", "サブスクリプション"],
    },
    {
        "q": "画面共有が真っ黒になるのは、故障か。",
        "a": "ゲーム側のアンチチート、不正を防ぐ仕組みが、画面の取得を止めることがあります。VALORANTでは起き得ます。そのときはライブを無理に続けず、録画したVODを見ます。",
        "terms": ["アンチチート", "VOD"],
    },
    {
        "q": "AIの指摘は正しいのか。",
        "a": "正しく見える文でも、映像にないことがあります。それがハルシネーションです。だから、映像から言えない台本は空欄にしています。最後に、その指摘が自分の試合と一致するかは自分の目で見ます。",
        "terms": ["ハルシネーション", "コンテキスト"],
    },
    {
        "q": "ログインのパスワードは、そのアプリが持っているのか。",
        "a": "メールのリンクに加えて、Google、Apple、Discordで入れます。パスワードをこのアプリに預けず、そのサービスに本人かを聞く方式をOAuthと言います。",
        "terms": ["OAuth"],
    },
]


def note_for(slide: dict) -> str:
    term_lines = []
    for name in slide["terms"]:
        term = TERMS[name]
        term_lines.append(f"・{name}（{term['reading']}）: {term['one']}")
    block = "\n".join(term_lines) if term_lines else "・このスライドで新しく定義する用語はない。"
    cut = f"\n急ぐとき: {slide['cut']}\n" if slide["cut"] else "\n"
    return f"""【スライド {slide['n']:02d} / 15 · 目安 {slide['seconds']}秒】
用語の定義はスライドに書いていない。言い換えはセリフに入っている。下の一文は抜き書きなので、重ねて読まない。詳しい解説は発表原稿。
{cut}
セリフ:
{slide['spoken'].strip()}

この場の用語（セリフに入っている一文）:
{block}
"""


def build_slides(prs: Presentation) -> None:
    # 01 title
    s = new_slide(prs, True)
    write(s, 0.72, 1.72, 11.5, 0.34, ["探究発表　　7〜10分"], 16, GOLD, bold=True)
    write(s, 0.72, 2.15, 12, 1.35, ["奥妙なAI領域"], 66, CREAM, bold=True)
    rect(s, 0.74, 3.62, 2.15, 0.035, VERM)
    write(
        s,
        0.72,
        3.9,
        11.2,
        1.35,
        ["日本語で頼んだら、", "専門の仕事が、動く形になった。"],
        28,
        CREAM,
        spacing=1.15,
    )
    write(s, 0.72, 6.35, 10, 0.4, ["自分の試合を、見る道具の話。"], 16, MUTED_ON_INK)
    notes(s, note_for(SLIDES[0]))

    # 02
    s = new_slide(prs, False)
    kicker(s, "生成AI")
    write(s, 0.72, 1.35, 12, 2.5, ["「また生成AIか」", "って思った人へ。"], 52, INK_TEXT, bold=True, spacing=1.02)
    write(s, 0.72, 4.15, 11, 0.7, ["その感覚で、合っている。"], 28, INK_TEXT)
    rect(s, 0.72, 5.55, 11.9, 1.15, INK, rounded=0.08)
    write(s, 1.0, 5.55, 11.3, 1.15, ["今日の本題は、自分の動画を見る道具。"], 26, CREAM, bold=True, anchor="ctr")
    footer(s, 2, False)
    notes(s, note_for(SLIDES[1]))

    # 03
    s = new_slide(prs, True)
    kicker(s, "一個だけ聞く")
    write(s, 0.72, 1.7, 12, 2.8, ["見てほしかった", "瞬間は、ある？"], 60, CREAM, bold=True, spacing=1.0)
    write(s, 0.72, 5.15, 11, 0.8, ["試合でも、部活でも、バイトでも。"], 24, MUTED_ON_INK)
    footer(s, 3, True)
    notes(s, note_for(SLIDES[2]))

    # 04
    s = new_slide(prs, True)
    kicker(s, "VOD")
    write(s, 0.72, 1.25, 12, 0.5, ["欲しかった一言。"], 18, MUTED_ON_INK)
    rect(s, 0.72, 2.05, 11.9, 2.25, INK_CARD, rounded=0.06)
    rect(s, 0.72, 2.05, 0.1, 2.25, VERM)
    write(s, 1.15, 2.15, 11, 2.05, ["00:12、", "正面ピーク捨てろ。"], 48, CREAM, bold=True, spacing=1.0, anchor="ctr")
    write(s, 0.72, 4.65, 11.5, 1.2, ["自分のその秒を、見てほしい。", "この文は、アプリが出す言い方の例。"], 22, MUTED_ON_INK, spacing=1.25)
    footer(s, 4, True)
    notes(s, note_for(SLIDES[3]))

    # 05
    s = new_slide(prs, False)
    kicker(s, "少し前まで")
    write(s, 0.72, 0.9, 12, 0.9, ["五つの専門だった。"], 40, INK_TEXT, bold=True)
    jobs = [
        ("01", "見る", "動画を判断する"),
        ("02", "書く", "指摘を文章にする"),
        ("03", "作る", "アプリにする"),
        ("04", "課金", "ログインと月額"),
        ("05", "喋る", "必要なときだけ"),
    ]
    gap = 0.16
    left = 0.72
    card_w = (11.9 - gap * 4) / 5
    for i, (num, name, desc) in enumerate(jobs):
        x = left + i * (card_w + gap)
        rect(s, x, 2.35, card_w, 3.35, PAPER_CARD, rounded=0.08)
        write(s, x + 0.18, 2.55, card_w - 0.36, 0.7, [num], 22, VERM, bold=True)
        write(s, x + 0.18, 3.4, card_w - 0.36, 0.9, [name], 32, INK_TEXT, bold=True)
        write(s, x + 0.18, 4.5, card_w - 0.36, 0.9, [desc], 15, MUTED_ON_PAPER)
    footer(s, 5, False)
    notes(s, note_for(SLIDES[4]))

    # 06
    s = new_slide(prs, True)
    kicker(s, "プロンプト   ·   エージェント")
    write(s, 0.72, 0.9, 12, 0.85, ["渡したのは、日本語だけ。"], 36, CREAM, bold=True)
    lines = [
        "動画を見て、ダメなところをカードで出して",
        "長い試合は、およそ40秒の塊に切って",
        "プレイ中は、戦闘のあとだけ喋って",
    ]
    for i, line in enumerate(lines):
        y = 2.15 + i * 1.05
        rect(s, 0.72, y, 11.9, 0.88, INK_CARD, rounded=0.08)
        write(s, 1.05, y, 11.3, 0.88, [line], 22, CREAM, anchor="ctr")
    write(s, 0.72, 5.5, 11.8, 1.1, ["進めたのはエージェント。", "会話の往復では、終わっていない。"], 20, GOLD, spacing=1.2)
    footer(s, 6, True)
    notes(s, note_for(SLIDES[5]))

    # 07
    s = new_slide(prs, True)
    kicker(s, "マルチモーダル   ·   LLM")
    write(s, 0.72, 1.05, 12, 0.95, ["VODCoach.AI"], 48, CREAM, bold=True)
    write(s, 0.72, 2.15, 12, 0.7, ["AIで自分のプレイを論破しろ。"], 24, GOLD)
    write(s, 0.72, 3.15, 12, 0.7, ["映像を見て、次の一手だけ言う。"], 26, CREAM)
    chips = [("15秒のクリップ", 0.72), ("試合まるごと", 4.55), ("プレイ中の画面", 8.15)]
    for label, x in chips:
        chip(s, x, 4.35, 3.5, 0.78, label, INK_CARD, CREAM, 18)
    write(s, 0.72, 5.5, 11.5, 0.8, ["Apex Legends と VALORANT。見えていた情報だけを材料にする。"], 18, MUTED_ON_INK)
    footer(s, 7, True)
    notes(s, note_for(SLIDES[6]))

    # 08
    s = new_slide(prs, True)
    kicker(s, "推論   ·   レイテンシ   ·   TTS")
    write(s, 0.72, 1.55, 12, 2.4, ["見ているのに、", "ほとんど喋らない。"], 50, CREAM, bold=True, spacing=1.02)
    write(s, 0.72, 4.5, 11.5, 1.5, ["画面は、およそ2.5秒ごと。", "声は、戦闘のあとと、動きが止まったときだけ。"], 24, MUTED_ON_INK, spacing=1.25)
    footer(s, 8, True)
    notes(s, note_for(SLIDES[7]))

    # 09
    s = new_slide(prs, False)
    kicker(s, "ハルシネーション")
    write(s, 0.72, 0.9, 12, 1.7, ["もっともらしい嘘は、", "台本にしない。"], 40, INK_TEXT, bold=True, spacing=1.02)
    rect(s, 0.72, 3.15, 7.5, 2.55, PAPER_CARD, rounded=0.08)
    rect(s, 0.72, 3.15, 0.1, 2.55, VERM)
    write(s, 1.1, 3.35, 6.8, 0.4, ["出てくる言い方の例"], 13, VERM, bold=True)
    write(s, 1.1, 3.85, 6.8, 0.7, ["オフアングル、捨ててない？"], 22, INK_TEXT, bold=True)
    write(s, 1.1, 4.6, 6.8, 0.85, ["00:12、オフアングルあるのに正面ピーク。権利は敵。"], 16, MUTED_ON_PAPER)
    write(s, 8.5, 3.4, 4.1, 2.2, ["映像から", "言えないなら、", "空欄のまま。"], 22, INK_TEXT, bold=True, spacing=1.15)
    footer(s, 9, False)
    notes(s, note_for(SLIDES[8]))

    # 10
    s = new_slide(prs, True)
    kicker(s, "コンテキスト   ·   ファインチューニング")
    write(s, 0.72, 0.88, 12, 1.55, ["モデルは、鍛え直していない。"], 36, CREAM, bold=True)
    write(s, 0.72, 1.85, 12, 0.5, ["同じ指摘を、12言語へ移しただけ。"], 20, MUTED_ON_INK)
    langs = [
        "English",
        "日本語",
        "Português",
        "한국어",
        "Deutsch",
        "Français",
        "Español",
        "Polski",
        "繁體中文",
        "Türkçe",
        "Italiano",
        "Indonesia",
    ]
    cols = 4
    pw, ph, gx, gy = 2.85, 0.62, 0.16, 0.14
    for i, name in enumerate(langs):
        x = 0.72 + (i % cols) * (pw + gx)
        y = 2.7 + (i // cols) * (ph + gy)
        chip(s, x, y, pw, ph, name, INK_CARD, CREAM, 16)
    footer(s, 10, True)
    notes(s, note_for(SLIDES[9]))

    # 11
    s = new_slide(prs, False)
    kicker(s, "SaaS   ·   Webhook   ·   フェイルクローズ")
    write(s, 0.72, 1.05, 12, 1.1, ["月額 980円"], 60, INK_TEXT, bold=True)
    write(s, 0.72, 2.4, 12, 1.5, ["自分だけの悩みは、日記。"], 36, INK_TEXT, bold=True)
    write(s, 0.72, 3.55, 11.5, 1.3, ["同じことで困る人がいるなら、商品になる。", "週に1本は無料。制限を外したい人だけが、月額。"], 20, MUTED_ON_PAPER, spacing=1.3)
    rect(s, 0.72, 5.35, 11.9, 1.25, INK, rounded=0.08)
    write(s, 1.0, 5.35, 11.3, 1.25, ["支払った、の通知が届くまで、有料は開かない。"], 22, CREAM, bold=True, anchor="ctr")
    footer(s, 11, False)
    notes(s, note_for(SLIDES[10]))

    # 12
    s = new_slide(prs, True)
    kicker(s, "API   ·   タイムアウト")
    write(
        s,
        0.72,
        1.25,
        12,
        3.3,
        ["0%で、止まった。", "解析中が、終わらなかった。", "Safariだけ、動かなかった。"],
        36,
        CREAM,
        bold=True,
        spacing=1.12,
    )
    write(s, 0.72, 5.15, 11.8, 1.2, ["直したのも、プロンプト。", "動いたかを確かめたのは、自分。"], 22, GOLD, spacing=1.25)
    footer(s, 12, True)
    notes(s, note_for(SLIDES[11]))

    # 13
    s = new_slide(prs, False)
    kicker(s, "期待値")
    write(s, 0.72, 1.15, 12, 2.6, ["見て。", "具体的に。", "次の一手だけ。"], 46, INK_TEXT, bold=True, spacing=0.98)
    items = [("部活のフォーム", 0.72), ("小テストの間違い方", 4.7), ("文化祭の、列", 8.7)]
    for label, x in items:
        rect(s, x, 5.15, 3.7, 1.15, PAPER_CARD, rounded=0.1)
        write(s, x + 0.15, 5.15, 3.4, 1.15, [label], 16, INK_TEXT, bold=True, align=PP_ALIGN.CENTER, anchor="ctr")
    footer(s, 13, False)
    notes(s, note_for(SLIDES[12]))

    # 14
    s = new_slide(prs, True)
    kicker(s, "今夜、10分")
    write(s, 0.72, 0.9, 12, 0.8, ["検索では、終わらせない。"], 36, CREAM, bold=True)
    steps = [
        ("1", "見てほしいことを、一文にする"),
        ("2", "動く画面になるまで、頼む"),
        ("3", "壊れた現象を、日本語で返す"),
    ]
    for i, (num, label) in enumerate(steps):
        y = 2.15 + i * 1.35
        write(s, 0.72, y, 1.1, 0.9, [num], 36, VERM, bold=True, anchor="ctr")
        write(s, 2.0, y, 10, 0.9, [label], 28, CREAM, anchor="ctr")
    footer(s, 14, True)
    notes(s, note_for(SLIDES[13]))

    # 15
    s = new_slide(prs, True)
    kicker(s, "ここで終える")
    write(s, 0.72, 1.55, 12, 2.5, ["頼んで、", "触って、直した。"], 54, CREAM, bold=True, spacing=1.0)
    write(s, 0.72, 4.55, 11.5, 0.7, ["奥妙の中身は、その三つ。"], 24, GOLD)
    write(s, 0.72, 5.7, 11.5, 0.7, ["自分なら、何を見てもらう？"], 26, CREAM, bold=True)
    footer(s, 15, True)
    notes(s, note_for(SLIDES[14]))

    # 16 hidden backup
    s = new_slide(prs, False)
    kicker(s, "聞かれたときだけ出す。発表では開かない")
    write(s, 0.72, 1.05, 12, 0.7, ["答えはノートと原稿にある。"], 28, INK_TEXT, bold=True)
    qs = [
        "ChatGPTと何が違う？",
        "コードが書けなくてもいい？",
        "本当に儲かった？",
        "画面が真っ黒なのは故障？",
        "AIの指摘は正しい？",
        "パスワードは預かる？",
    ]
    for i, q in enumerate(qs):
        col = i % 2
        row = i // 2
        x = 0.72 + col * 6.15
        y = 2.15 + row * 1.4
        rect(s, x, y, 5.9, 1.15, PAPER_CARD, rounded=0.1)
        write(s, x + 0.25, y, 5.4, 1.15, [q], 18, INK_TEXT, bold=True, anchor="ctr")
    s._element.set("show", "0")
    qa_notes = ["【非表示スライド。スライドショーでは出ない。質問が来たら、この答えだけ言う】", ""]
    for item in QA:
        qa_notes.append(f"Q. {item['q']}")
        qa_notes.append(item["a"])
        qa_notes.append("")
    notes(s, "\n".join(qa_notes))


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
        if skip:
            continue
        if ch.isspace():
            continue
        kept.append(ch)
    return len(kept)


def manuscript() -> str:
    total = sum(slide["seconds"] for slide in SLIDES)
    speech = sum(spoken_chars(slide["spoken"]) for slide in SLIDES)
    lines: list[str] = []
    lines.append("# 奥妙なAI領域　発表原稿")
    lines.append("")
    lines.append("探究発表。想定時間は7〜10分。スライドは15枚。16枚目は非表示で、質問が来たときだけ使う。")
    lines.append(f"セリフの目安合計は {total // 60}分{total % 60:02d}秒。読み上げ本文は約{speech}字。少し早めでも10分に収まる量にしてある。［ ］の中は動きの指示で、声に出さない。")
    lines.append("")
    lines.append("用語の定義はスライドに書いていない。言い換えの一文は、各スライドのセリフにすでに入っている。その下の「口頭の一文」は同じ文の抜き書きなので、発表で二度読まない。詳しい解説は口頭では読まない。あとで原稿を直すときの材料。")
    lines.append("")
    lines.append("事実の範囲。機能は自作の VODCoach.AI に実装したものに合わせてある。指摘の文面は、アプリが出す言い方の例であり、特定の試合の結果報告ではない。月額980円は画面に出している価格。売れた金額と利用者数は、この発表では言わない。")
    lines.append("")
    lines.append("## なぜこの中身にしたか")
    lines.append("")
    lines.append("案は三つあった。本編にしたのは一つ目。")
    lines.append("")
    lines.append("**案1　見てほしい瞬間から入る（本編）**")
    lines.append("冷めている部屋は、「またAIの話か」を先に認めた方が聞く。実例は、自分の試合動画を見て次の一手を言うアプリ。意外な使い方（黙って見る、台本を出す、12言語）、お金の設計、途中で壊れた話が全部入る。伝えたいこと、「専門の仕事が日本語の指示で形になる」が、感想ではなく実物に着地する。")
    lines.append("")
    lines.append("**案2　稼ぎ方を主軸にする（本編にはしない）**")
    lines.append("「AIでバイト代を超える」から入ると、高校生は胡散臭さで切る。月額980円の設計だけを案1の1枚に残した。売上は言わない。")
    lines.append("")
    lines.append("**案3　失敗談だけにする（本編にはしない）**")
    lines.append("アップロードが止まった話だけで笑いは取れる。ただし「日本語で専門の仕事が動く」が薄くなる。失敗は案1の1枚に圧縮した。")
    lines.append("")
    lines.append("## 話し方")
    lines.append("")
    lines.append("- 用語を言ったら、すぐ人間の話に戻る。定義を二つ続けない。")
    lines.append("- スライド3の質問のあと、3秒置く。誰も答えなくて成功。")
    lines.append("- スライド6の日本語三行は、一行目だけ声に出す。")
    lines.append("- スライド10の言語名は読まない。")
    lines.append("- スライド11の冪等は、時間がなければ言わない。")
    lines.append("- スライド15で終える。補足を自分から始めない。質問は「自分なら何を見てもらう？」に戻す。")
    lines.append("- 場が固いときは「論破」を「具体的に反論する」と言い換える。")
    lines.append("")
    lines.append("## セリフ")
    lines.append("")
    for slide in SLIDES:
        lines.append(f"### スライド {slide['n']:02d}　目安 {slide['seconds']}秒")
        lines.append("")
        if slide["cut"]:
            lines.append(f"急ぐとき。{slide['cut']}")
            lines.append("")
        lines.append(slide["spoken"].strip())
        lines.append("")
        if slide["terms"]:
            lines.append("このスライドの用語。")
            lines.append("")
            for name in slide["terms"]:
                term = TERMS[name]
                lines.append(f"**{name}**（{term['reading']}）")
                lines.append("")
                lines.append(f"口頭の一文。{term['one']}")
                lines.append("")
                lines.append(f"詳しい解説。口頭では読まない。{term['deep']}")
                lines.append("")
        else:
            lines.append("このスライドで新しく定義する用語はない。")
            lines.append("")
    lines.append("## 質問が来たとき")
    lines.append("")
    lines.append("スライド16はスライドショーでは出ない。聞かれた質問に近いものだけ答える。答え終わったら、本編の最後の問いに戻す。")
    lines.append("")
    for item in QA:
        lines.append(f"**{item['q']}**")
        lines.append("")
        lines.append(item["a"])
        lines.append("")
        for name in item["terms"]:
            term = TERMS[name]
            if name in {t for s in SLIDES for t in s["terms"]}:
                lines.append(f"関連。{name}。口頭の一文は本編と同じ。{term['one']}")
            else:
                lines.append(f"**{name}**（{term['reading']}）は本編では言っていない。聞かれたときだけ出す。")
                lines.append("")
                lines.append(f"口頭の一文。{term['one']}")
                lines.append("")
                lines.append(f"詳しい解説。{term['deep']}")
            lines.append("")
    lines.append("## 用語集")
    lines.append("")
    lines.append("発表のあとで原稿を直すとき、ここを正にする。スライドには載せていない。口頭の一文は、用語の直後に言う分。詳しい解説は、原稿を厚くするとき用で、発表中に読み上げない。")
    lines.append("")
    seen: list[str] = []
    for slide in SLIDES:
        for name in slide["terms"]:
            if name not in seen:
                seen.append(name)
    for item in QA:
        for name in item["terms"]:
            if name not in seen:
                seen.append(name)
    for name in TERMS:
        if name not in seen:
            seen.append(name)
    for name in seen:
        term = TERMS[name]
        lines.append(f"### {name}（{term['reading']}）")
        lines.append("")
        lines.append(f"口頭の一文。{term['one']}")
        lines.append("")
        lines.append(term["deep"])
        lines.append("")
    lines.append("## 聞かれたときに出せる事実")
    lines.append("")
    lines.append("- アプリの中身は TypeScript で、おおよそ1万7千行。手で全部打った量の自慢ではない。エージェントが書き、自分は動かして、違うところを日本語で戻した。")
    lines.append("- 長い試合はおよそ40秒の区間に分け、同時に走らせる推論は最大3つ。一つの処理がサーバの制限時間で死なないようにしている。")
    lines.append("- ライブは画面をおおよそ2.5秒ごとに見る。声と字幕は、言う価値があるときだけ。同じ注意は繰り返さない。")
    lines.append("- コーチの言語は12。英語、日本語、ポルトガル語、韓国語、ドイツ語、フランス語、スペイン語、ポーランド語、繁体字、トルコ語、イタリア語、インドネシア語。")
    lines.append("- ログインはメールのリンク、Google、Apple、Discord。")
    lines.append("- 月額980円のPro。週1本までは無料の設計。支払い確定の通知の前には開かない。鍵が欠けていたら開かない。")
    lines.append("- 売上と利用者数は、この原稿にもスライドにも置いていない。")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    prs.core_properties.title = "奥妙なAI領域"
    prs.core_properties.subject = "探究発表 7〜10分"
    prs.core_properties.category = "探究発表"
    build_slides(prs)
    pptx_path = OUT_DIR / "奥妙なAI領域.pptx"
    md_path = OUT_DIR / "奥妙なAI領域_発表原稿.md"
    prs.save(pptx_path)
    md_path.write_text(manuscript(), encoding="utf-8")
    speech = sum(spoken_chars(slide["spoken"]) for slide in SLIDES)
    seconds = sum(slide["seconds"] for slide in SLIDES)
    print(f"slides={len(prs.slides)} speech_chars={speech} planned_sec={seconds}")
    print(pptx_path)
    print(md_path)


if __name__ == "__main__":
    main()
