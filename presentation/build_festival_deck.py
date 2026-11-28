#!/usr/bin/env python3
"""文化祭版。CO2を吸うと倒れる鳥を主軸にした探究発表デッキ。

用語はスライドでは名前だけ。定義はノートと原稿。
Unityのソースはこのリポジトリに無いので、濃度の数値やコードの行は言わない。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pptx import Presentation
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches

from build_deck import (
    CREAM,
    GOLD,
    INK,
    INK_CARD,
    INK_TEXT,
    MUTED_ON_INK,
    MUTED_ON_PAPER,
    PAPER_CARD,
    VERM,
    W,
    H,
    footer,
    kicker,
    new_slide,
    notes,
    rect,
    write,
)

OUT_DIR = Path(__file__).resolve().parent

TERMS: dict[str, dict[str, str]] = {
    "文化祭": {
        "reading": "ぶんかさい",
        "one": "同じ学校の、同じ日の出し物。この話の話し手も客も、その床にいた側。",
        "deep": "外から来た人が学校を解説する形にしない。見た人、通りがかった人、作った人を、同じ当事者として扱う。来場者数は数えていないので言わない。",
    },
    "CO2": {
        "reading": "シーオーツー",
        "one": "二酸化炭素。呼吸で出る気体。一酸化炭素とは別物。",
        "deep": "化学式は CO2。炭素1、酸素2。自分たちが吐く息に含まれる。濃度が極端に高いと呼吸のリズムが乱れるが、血の中で酸素の席を奪う一酸化炭素とは仕組みが違う。ゲームが吸わせているのはこちら。",
    },
    "一酸化炭素": {
        "reading": "いっさんかたんそ",
        "one": "化学式は CO。炭鉱のカナリアが先に倒れた話の、主な気体。",
        "deep": "ヘモグロビンに酸素より強く結びつき、酸素を体へ運べなくする。無色無臭。炭鉱では人間が気づく前にカナリアの具合が悪くなった、という安全の歴史で有名。このゲームの気体ではない。口頭で必ず CO2 と分ける。",
    },
    "カナリア": {
        "reading": "かなりあ",
        "one": "炭鉱で、人間より先に毒の気体へ反応した鳥として教材に出てくる。",
        "deep": "見た目の『先に倒れる鳥』は、このゲームと似ている。歴史上の主因は一酸化炭素。ゲームのルールは二酸化炭素。似ているところと、気体が違うところを同じ文で言わない。",
    },
    "Unity": {
        "reading": "ゆにてぃ",
        "one": "ゲームエンジンの一つ。絵、音、入力、落ちる計算を一つのプロジェクトに置く。",
        "deep": "画面を作るだけの道具ではない。毎フレーム、世界の状態を更新する土台。動きは C# で書く。日本語の指示はそのまま実行されない。",
    },
    "ゲームエンジン": {
        "reading": "げーむえんじん",
        "one": "ゲームの世界を、毎フレーム更新し続ける土台のこと。",
        "deep": "描画、入力、物理、音声、スクリプトの実行をまとめて持つ。Unity のほかに Unreal、Godot がある。エンジンが無いと、落下や当たりを全部自分で計算するところからになる。",
    },
    "C#": {
        "reading": "シーシャープ",
        "one": "Unity で動きを書くプログラミング言語。",
        "deep": "プロンプトの日本語は、プレイヤーが見るルール。Unity が毎フレーム実行するのは C#。エージェントを使うなら、日本語のルールをこの言語のスクリプトへ落とし、変だったら日本語で戻す。この原稿は、実在のスクリプトの行を引用していない。",
    },
    "プロンプト": {
        "reading": "ぷろんぷと",
        "one": "AIに渡す指示文。このゲームなら『濃くなったら、吸って、倒れて』。",
        "deep": "役割、禁止、出力の形が入るほどブレにくい。濃度の数字をモデルに埋めさせない、状態は三つだけ、倒れるは絵の切り替えではなく落下、まで書くと、それらしい嘘が減る。",
    },
    "エージェント": {
        "reading": "えーじぇんと",
        "one": "会話で終わらず、ファイルを書き、動かして、失敗を読んで直すAI。",
        "deep": "一問一答は、説明の文章が返ってくるところで止まる。エージェントは Unity のスクリプトを足し、再生して、鳥が倒れない・床をすり抜ける、といった現象を次の修正に使う。確認して踏むのは人間。",
    },
    "状態機械": {
        "reading": "じょうたいきかい",
        "one": "今の状態だけを覚えて、条件で次の状態へ移る書き方。",
        "deep": "平常、吸う、倒れる。同時に全部やらない。吸っている途中で倒れるアニメを重ねると、見た目が壊れる。ゲームのキャラクターの動きは、この分け方で書くことが多い。英語では state machine。",
    },
    "しきい値": {
        "reading": "しきいち",
        "one": "振る舞いが変わる境の値。線の手前は平常、超えたら倒れる。",
        "deep": "濃度がいくつで倒れるかは、この資料を作った時点で実物のプロジェクトを確認していない。だから発表では数字を言わない。線があることだけを言う。実物の値を後で入れるなら、単位も一緒に。ppm なら、空気中の百万分のいくつ、という濃度の単位。",
    },
    "物理演算": {
        "reading": "ぶつりえんざん",
        "one": "重力や衝突を、フレームごとに計算すること。",
        "deep": "絵を『倒れた画像』に差し替えるだけだと、床に着く瞬間が無い。Rigidbody のような部品を付けると、エンジンが落下を計算する。倒れる、を体が落ちることにするための語。",
    },
    "コライダー": {
        "reading": "こらいだー",
        "one": "当たり判定の形。見た目の絵とは別に持つ。",
        "deep": "羽の絵の輪郭と、床に当たる箱は一致しなくていい。一致させすぎると、羽の先が床に引っかかって倒れ方が壊れる。見た目と判定を分ける、という専門の仕事。",
    },
    "フレーム": {
        "reading": "ふれーむ",
        "one": "画面を更新する1回。Unity はそのたびに、今の濃度と状態を見る。",
        "deep": "60フレームなら1秒に60回。Update という関数が、そのたびに呼ばれる。しきい値を超えたかの確認は、この繰り返しの中で行う。",
    },
    "シミュレーション": {
        "reading": "しみゅれーしょん",
        "one": "現実の全部ではなく、決めたルールだけを動かして見せること。",
        "deep": "鳥の肺、血液、教室の換気を全部は写していない。写しているのは『濃さが線を超えたら吸って倒れる』。簡易モデルと呼ぶ。機械学習の『モデル』とは別の語なので、口頭で混ざったら『単純化したルール』と言い換える。",
    },
    "ハルシネーション": {
        "reading": "はるしねーしょん",
        "one": "根拠がないことを、本当らしく言ったり、それらしい数値にしたりすること。",
        "deep": "濃度を空欄のままモデルに書かせると、教科書っぽい数字が出ることがある。その数字で鳥を倒すと、ゲームは動くが、自分のルールではなくなる。線は人間が決めて、倒れるタイミングを自分で踏む。",
    },
    "当事者": {
        "reading": "とうじしゃ",
        "one": "その場にいた人。作った人だけじゃない。同じ床で鳥が落ちるのを見た人も入る。",
        "deep": "探究の聞き手が同じ学校の文化祭にいた前提で話すための語。外から『あなたたちも環境問題を』と始めない。見た、という経験を入口にする。",
    },
}


SLIDES: list[dict] = [
    {
        "n": 1,
        "seconds": 20,
        "terms": [],
        "cut": "",
        "spoken": """奥妙なAI領域、です。
今日の入口は文化祭です。同じ学校の、同じ日の話です。外から来た人の解説ではありません。
廊下の出し物を、AIの用語でほどきます。用語は、鳥が倒れるまでに必要な分だけです。""",
    },
    {
        "n": 2,
        "seconds": 35,
        "terms": ["文化祭", "当事者"],
        "cut": "挙手が無くても進む。",
        "spoken": """同じ廊下にいました。
CO2を吸うと倒れる鳥、見た人はいますか。
［3秒待つ。手が無くていい］
見た人は、もう当事者です。当事者は、作った人だけではありません。同じ床にいた人のことです。
通りがかっただけでも、今日の話の内側にいます。作った側の自慢からは入りません。""",
    },
    {
        "n": 3,
        "seconds": 30,
        "terms": ["CO2"],
        "cut": "",
        "spoken": """ルールはこれだけです。
二酸化炭素、CO2を吸うと、鳥は倒れる。
気体は目に見えません。倒れる体は、見えます。
文化祭で足が止まるのは、説明を読み終えたあとではなく、ここです。""",
    },
    {
        "n": 4,
        "seconds": 30,
        "terms": ["Unity", "ゲームエンジン"],
        "cut": "",
        "spoken": """土台は Unity です。ゲームエンジンの一つで、絵と音と入力と、落ちる計算を、一つのプロジェクトに置く道具です。
エンジンは、ボタンを並べるソフトではありません。毎フレーム、世界を更新する係です。
その上に置いたルールは、一文でした。濃くなったら、吸って、倒れる。""",
    },
    {
        "n": 5,
        "seconds": 30,
        "terms": [],
        "cut": "四枚は指を差すだけ。",
        "spoken": """鳥が倒れるだけに見えて、少し前まで仕事は分かれていました。
姿を描く。重力で落とす。当たりを判定する。状態を次へ移す。
文化祭の廊下では、その四つは見えません。見えるのは、落ちる瞬間です。""",
    },
    {
        "n": 6,
        "seconds": 45,
        "terms": ["プロンプト", "C#", "エージェント"],
        "cut": "コードの行は引用しない。",
        "spoken": """渡したのは日本語です。プロンプト、AIへの指示文にすると、CO2が濃くなったら吸って、倒れて。
Unity はその日本語を直接は実行しません。中の言語は C#、シーシャープです。毎フレーム走っているのは、そちらです。
日本語からその C# を書いて、変な動きを直すところまで進めるのがエージェントです。会話の答えが返っただけでは、鳥は倒れません。
特定のソースの行は、今日は引用しません。実物のファイルが手元にあるときだけ、画面で見せてください。""",
    },
    {
        "n": 7,
        "seconds": 35,
        "terms": ["状態機械"],
        "cut": "",
        "spoken": """鳥の中身は状態機械です。今どの状態かだけを覚えて、条件で次へ移る書き方です。
平常。吸う。倒れる。
三つを同時にはやりません。吸っている途中に、倒れた絵を重ねると、動きが壊れます。""",
    },
    {
        "n": 8,
        "seconds": 30,
        "terms": ["しきい値"],
        "cut": "数字を聞かれても、確認していないなら言わない。",
        "spoken": """境目を、しきい値と言います。線の手前は平常。線を超えたら倒れる。
今日、その数字は出しません。実物の値を、この資料を作った時点で確認していないからです。
言うのは、線があることだけです。""",
    },
    {
        "n": 9,
        "seconds": 35,
        "terms": ["物理演算", "コライダー", "フレーム"],
        "cut": "フレームは一文で切る。",
        "spoken": """倒れるを、絵の差し替えだけにはしません。倒れた画像に切り替えるだけだと、床に着く瞬間がありません。
物理演算で、体を落とします。物理演算は、重力や衝突を計算することです。落ちて、当たって、止まる。
画面の更新1回をフレームと言います。そのたびに、今の濃さと、体の位置を見ます。
床に当たる形はコライダー。見た目の羽と、当たる形は別です。羽の先まで当たりにすると、床に引っかかって倒れ方が壊れます。""",
    },
    {
        "n": 10,
        "seconds": 45,
        "terms": ["カナリア", "一酸化炭素", "CO2"],
        "cut": "ここを急がない。混ぜない、がこのスライドの全部。",
        "spoken": """ここで、混ぜない話をします。
炭鉱でカナリアが人間より先に倒れた、という話は有名です。カナリアは、その鳥です。主因は一酸化炭素、COです。血が酸素を運ぶのを邪魔します。
このゲームが吸わせているのは二酸化炭素、CO2です。息に含まれる、別の気体です。
字は似ています。同じ気体ではありません。先に倒れる鳥、という見た目だけが似ています。
同じ学校の床でここを混ぜると、知っている人に切られます。""",
    },
    {
        "n": 11,
        "seconds": 35,
        "terms": ["シミュレーション"],
        "cut": "",
        "spoken": """やっていることはシミュレーションです。現実の全部を写すんじゃなく、決めたルールだけを動かします。
教室で自分たちが吐いている気体を、ゲームの中の濃さにしました。換気も、血液も、入れていません。
入れたのは、線を超えたら倒れる、だけです。鳥の肺はコピーしていません。
機械学習でいうモデルとも違います。今日いうのは簡易モデル、単純化したルールの組です。""",
    },
    {
        "n": 12,
        "seconds": 30,
        "terms": ["ハルシネーション"],
        "cut": "",
        "spoken": """濃度をAIに書かせると、それらしい数字が出ます。根拠がないのに本当らしい。それをハルシネーションと言います。
線は、自分で決めて、自分で踏んで確認します。
倒れるのが早い、遅い、床をすり抜ける。その現象を、日本語で返します。""",
    },
    {
        "n": 13,
        "seconds": 30,
        "terms": ["当事者"],
        "cut": "人数は言わない。",
        "spoken": """文化祭で見せたかったのは、ポスターの文章より、落ちる瞬間です。
環境の話を、説教から始めません。同じ出し物として、落ちた、を先に置きます。
説明を読みに来た人より、鳥が落ちたところで立ち止まった人の方が、ルールを持って帰ります。
何人止まったかは数えていません。今日は言いません。同じ床にいた、で足ります。""",
    },
    {
        "n": 14,
        "seconds": 30,
        "terms": ["プロンプト", "エージェント"],
        "cut": "",
        "spoken": """今夜やるなら、自分の出し物の、落ちる瞬間を一文にします。それがプロンプトの種です。
説明の文章で止めず、動くところまで頼む。進めるのはエージェントです。
変な落ち方をしたら、その現象を日本語で返します。""",
    },
    {
        "n": 15,
        "seconds": 25,
        "terms": [],
        "cut": "ここで終える。16は出さない。",
        "spoken": """奥妙の中身は手順です。頼んで、触って、直した。
聞きたいのは、自分の出し物なら、何が落ちるか、です。
［沈黙があっていい。自分から補足しない］""",
    },
]


QA = [
    {
        "q": "炭鉱のカナリアと、何が違うのか。",
        "a": "見た目は、先に倒れる鳥で似ています。カナリアの話の主因は一酸化炭素です。このゲームが吸わせるのは二酸化炭素です。同じ話としてつなげません。",
        "terms": ["カナリア", "一酸化炭素", "CO2"],
    },
    {
        "q": "CO2で、鳥は本当に倒れるのか。",
        "a": "濃度が極端に高いと、呼吸は乱れます。ただしこのゲームは肺のコピーではありません。線を超えたら倒れる、と決めたシミュレーションです。医学の実験結果としては話しません。",
        "terms": ["シミュレーション", "しきい値", "CO2"],
    },
    {
        "q": "Unityは、AIが書いたのか。",
        "a": "ルールの日本語はプロンプトです。Unityが実行するのはC#です。エージェントは、そのあいだを書いて直す役です。この原稿は、実在のスクリプトの行を引用していません。ファイルが手元にある発表なら、その画面を出した方が強いです。",
        "terms": ["Unity", "C#", "エージェント", "プロンプト"],
    },
    {
        "q": "文化祭で、何人遊んだのか。",
        "a": "数えていません。今日の根拠にしません。同じ学校の同じ床にいた、というところまでです。",
        "terms": ["文化祭", "当事者"],
    },
    {
        "q": "前の、試合を見るAIの話と、どっちで話すのか。",
        "a": "タイトルは同じです。この版は文化祭の鳥が主軸です。試合のコーチの話は、この15枚では出しません。部屋がゲームを見ているなら、こちらです。",
        "terms": [],
    },
]


def note_for(slide: dict) -> str:
    if slide["terms"]:
        block = "\n".join(
            f"・{name}（{TERMS[name]['reading']}）: {TERMS[name]['one']}" for name in slide["terms"]
        )
    else:
        block = "・このスライドで新しく定義する用語はない。"
    cut = f"\n急ぐとき: {slide['cut']}\n" if slide["cut"] else "\n"
    return f"""【スライド {slide['n']:02d} / 15 · 目安 {slide['seconds']}秒】
用語の定義はスライドに書いていない。言い換えはセリフに入っている。下の一文は抜き書きなので、重ねて読まない。詳しくは発表原稿。
{cut}
セリフ:
{slide['spoken'].strip()}

この場の用語（セリフに入っている一文）:
{block}
"""


def build(prs: Presentation) -> None:
    s = new_slide(prs, True)
    write(s, 0.72, 1.55, 11.5, 0.34, ["探究発表　　7〜10分"], 16, GOLD, bold=True)
    write(s, 0.72, 2.05, 12, 1.2, ["奥妙なAI領域"], 60, CREAM, bold=True)
    rect(s, 0.74, 3.4, 2.15, 0.035, VERM)
    write(s, 0.72, 3.7, 11.5, 1.5, ["同じ学校の文化祭で、", "鳥が、倒れた。"], 32, CREAM, spacing=1.12)
    write(s, 0.72, 6.25, 11, 0.4, ["外から来た話ではない。"], 16, MUTED_ON_INK)
    notes(s, note_for(SLIDES[0]))

    s = new_slide(prs, False)
    kicker(s, "文化祭")
    write(s, 0.72, 1.2, 12, 2.2, ["同じ廊下に、", "いた。"], 58, INK_TEXT, bold=True)
    write(s, 0.72, 3.7, 11.5, 0.8, ["あの鳥、見た？"], 32, INK_TEXT, bold=True)
    rect(s, 0.72, 5.35, 11.9, 1.2, INK, rounded=0.08)
    write(s, 1.0, 5.35, 11.3, 1.2, ["見た人は、もう当事者。"], 28, CREAM, bold=True, anchor="ctr")
    footer(s, 2, False)
    notes(s, note_for(SLIDES[1]))

    s = new_slide(prs, True)
    kicker(s, "CO2")
    write(s, 0.72, 1.55, 12, 2.5, ["吸うと、", "倒れる。"], 64, CREAM, bold=True)
    write(s, 0.72, 4.7, 11.5, 1.3, ["気体は、見えない。", "体は、見える。"], 26, MUTED_ON_INK, spacing=1.2)
    footer(s, 3, True)
    notes(s, note_for(SLIDES[2]))

    s = new_slide(prs, True)
    kicker(s, "Unity   ·   ゲームエンジン")
    write(s, 0.72, 1.35, 12, 1.6, ["土台は、Unity。", "ルールは、一文。"], 44, CREAM, bold=True, spacing=1.05)
    rect(s, 0.72, 4.15, 11.9, 1.55, INK_CARD, rounded=0.08)
    rect(s, 0.72, 4.15, 0.1, 1.55, VERM)
    write(s, 1.15, 4.15, 11.1, 1.55, ["濃くなったら、吸って、倒れる。"], 28, CREAM, bold=True, anchor="ctr")
    footer(s, 4, True)
    notes(s, note_for(SLIDES[3]))

    s = new_slide(prs, False)
    kicker(s, "少し前まで")
    write(s, 0.72, 0.9, 12, 0.8, ["四つに、分かれていた。"], 40, INK_TEXT, bold=True)
    jobs = [
        ("01", "描く", "姿"),
        ("02", "落とす", "重力"),
        ("03", "判定", "当たり"),
        ("04", "移す", "状態"),
    ]
    gap = 0.18
    card_w = (11.9 - gap * 3) / 4
    for i, (num, name, desc) in enumerate(jobs):
        x = 0.72 + i * (card_w + gap)
        rect(s, x, 2.25, card_w, 3.4, PAPER_CARD, rounded=0.08)
        write(s, x + 0.22, 2.5, card_w - 0.4, 0.6, [num], 20, VERM, bold=True)
        write(s, x + 0.22, 3.35, card_w - 0.4, 0.9, [name], 36, INK_TEXT, bold=True)
        write(s, x + 0.22, 4.5, card_w - 0.4, 0.6, [desc], 18, MUTED_ON_PAPER)
    footer(s, 5, False)
    notes(s, note_for(SLIDES[4]))

    s = new_slide(prs, True)
    kicker(s, "プロンプト   ·   C#   ·   エージェント")
    write(s, 0.72, 0.95, 12, 0.8, ["日本語は、そのまま実行されない。"], 32, CREAM, bold=True)
    rect(s, 0.72, 2.15, 11.9, 1.35, INK_CARD, rounded=0.08)
    write(s, 1.0, 2.15, 11.3, 1.35, ["CO2が濃くなったら、吸って、倒れて。"], 26, CREAM, bold=True, anchor="ctr")
    write(s, 0.72, 3.9, 11.8, 2.0, ["動かす言語は、C#。", "進めるのは、エージェント。"], 28, GOLD, spacing=1.25)
    footer(s, 6, True)
    notes(s, note_for(SLIDES[5]))

    s = new_slide(prs, True)
    kicker(s, "状態機械")
    write(s, 0.72, 0.95, 12, 0.7, ["同時には、やらない。"], 32, CREAM, bold=True)
    states = [("平常", 0.72), ("吸う", 4.7), ("倒れる", 8.68)]
    for label, x in states:
        rect(s, x, 2.3, 3.7, 2.3, INK_CARD, rounded=0.08)
        write(s, x, 2.3, 3.7, 2.3, [label], 32, CREAM, bold=True, align=PP_ALIGN.CENTER, anchor="ctr")
    write(s, 0.72, 5.15, 11.5, 0.8, ["平常　→　吸う　→　倒れる"], 22, GOLD)
    footer(s, 7, True)
    notes(s, note_for(SLIDES[6]))

    s = new_slide(prs, False)
    kicker(s, "しきい値")
    write(s, 0.72, 1.25, 12, 2.4, ["線の手前は、生きている。", "線の向こうで、倒れる。"], 36, INK_TEXT, bold=True, spacing=1.15)
    write(s, 0.72, 4.5, 11.5, 1.2, ["今日、数字は出さない。", "線があることだけを言う。"], 22, MUTED_ON_PAPER, spacing=1.25)
    footer(s, 8, False)
    notes(s, note_for(SLIDES[7]))

    s = new_slide(prs, True)
    kicker(s, "物理演算   ·   コライダー")
    write(s, 0.72, 1.4, 12, 2.3, ["倒れるは、絵じゃない。", "体が、落ちる。"], 44, CREAM, bold=True, spacing=1.05)
    write(s, 0.72, 4.6, 11.5, 1.3, ["羽の見た目と、床に当たる形は、別。", "更新の1回を、フレームという。"], 22, MUTED_ON_INK, spacing=1.25)
    footer(s, 9, True)
    notes(s, note_for(SLIDES[8]))

    s = new_slide(prs, False)
    kicker(s, "カナリア")
    write(s, 0.72, 0.95, 12, 0.9, ["炭鉱の鳥と、混ぜない。"], 40, INK_TEXT, bold=True)
    rect(s, 0.72, 2.3, 5.7, 3.3, PAPER_CARD, rounded=0.08)
    write(s, 1.0, 2.55, 5.15, 0.4, ["カナリア"], 16, VERM, bold=True)
    write(s, 1.0, 3.15, 5.15, 1.8, ["先に倒れたのは、", "一酸化炭素。"], 28, INK_TEXT, bold=True, spacing=1.1)
    rect(s, 6.7, 2.3, 5.9, 3.3, INK, rounded=0.08)
    write(s, 6.98, 2.55, 5.35, 0.4, ["このゲーム"], 16, GOLD, bold=True)
    write(s, 6.98, 3.15, 5.35, 1.8, ["吸わせるのは、", "CO2。"], 28, CREAM, bold=True, spacing=1.1)
    footer(s, 10, False)
    notes(s, note_for(SLIDES[9]))

    s = new_slide(prs, True)
    kicker(s, "シミュレーション")
    write(s, 0.72, 1.35, 12, 2.2, ["肺は、コピーしていない。"], 40, CREAM, bold=True)
    write(s, 0.72, 3.2, 11.8, 1.5, ["教室で吐いている気体を、", "ゲームの中のルールにした。"], 26, MUTED_ON_INK, spacing=1.2)
    write(s, 0.72, 5.2, 11.5, 0.8, ["機械学習のモデル、とは別の話。"], 20, GOLD)
    footer(s, 11, True)
    notes(s, note_for(SLIDES[10]))

    s = new_slide(prs, True)
    kicker(s, "ハルシネーション")
    write(s, 0.72, 1.4, 12, 2.2, ["それらしい濃度は、", "使わない。"], 44, CREAM, bold=True, spacing=1.02)
    write(s, 0.72, 4.4, 11.5, 1.4, ["線は、自分で決める。", "倒れるところを、自分で踏む。"], 24, GOLD, spacing=1.25)
    footer(s, 12, True)
    notes(s, note_for(SLIDES[11]))

    s = new_slide(prs, False)
    kicker(s, "当事者")
    write(s, 0.72, 1.3, 12, 2.4, ["ポスターより、", "落ちる瞬間。"], 48, INK_TEXT, bold=True, spacing=1.02)
    write(s, 0.72, 4.5, 11.5, 1.4, ["立ち止まった人数は、数えていない。", "同じ床にいた、で足る。"], 22, MUTED_ON_PAPER, spacing=1.25)
    footer(s, 13, False)
    notes(s, note_for(SLIDES[12]))

    s = new_slide(prs, True)
    kicker(s, "今夜")
    write(s, 0.72, 0.95, 12, 0.8, ["自分の出し物の、落ちる瞬間。"], 32, CREAM, bold=True)
    steps = [
        ("1", "その瞬間を、一文にする"),
        ("2", "動くところまで、頼む"),
        ("3", "変な落ち方を、日本語で返す"),
    ]
    for i, (num, label) in enumerate(steps):
        y = 2.15 + i * 1.35
        write(s, 0.72, y, 1.0, 0.9, [num], 36, VERM, bold=True, anchor="ctr")
        write(s, 2.0, y, 10.2, 0.9, [label], 28, CREAM, anchor="ctr")
    footer(s, 14, True)
    notes(s, note_for(SLIDES[13]))

    s = new_slide(prs, True)
    kicker(s, "ここで終える")
    write(s, 0.72, 1.5, 12, 2.3, ["頼んで、", "触って、直した。"], 52, CREAM, bold=True)
    write(s, 0.72, 4.5, 11.5, 0.7, ["奥妙の中身は、その三つ。"], 24, GOLD)
    write(s, 0.72, 5.6, 11.5, 0.7, ["自分の出し物なら、何が落ちる？"], 26, CREAM, bold=True)
    footer(s, 15, True)
    notes(s, note_for(SLIDES[14]))

    s = new_slide(prs, False)
    kicker(s, "聞かれたときだけ。発表では開かない")
    write(s, 0.72, 1.0, 12, 0.6, ["答えはノートと原稿。"], 28, INK_TEXT, bold=True)
    qs = [item["q"] for item in QA]
    for i, q in enumerate(qs):
        col = i % 2
        row = i // 2
        x = 0.72 + col * 6.15
        y = 2.05 + row * 1.45
        rect(s, x, y, 5.9, 1.25, PAPER_CARD, rounded=0.1)
        write(s, x + 0.25, y, 5.4, 1.25, [q], 18, INK_TEXT, bold=True, anchor="ctr")
    s._element.set("show", "0")
    qa_notes = ["【非表示。質問が来たら、この答えだけ。人数と濃度の数字は作らない】", ""]
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
        if skip or ch.isspace():
            continue
        kept.append(ch)
    return len(kept)


def manuscript() -> str:
    total = sum(slide["seconds"] for slide in SLIDES)
    speech = sum(spoken_chars(slide["spoken"]) for slide in SLIDES)
    lines = [
        "# 奥妙なAI領域　発表原稿（文化祭・鳥）",
        "",
        "探究発表の別版。想定は7〜10分。スライド15枚。16枚目は非表示。",
        f"セリフの目安合計は {total // 60}分{total % 60:02d}秒。読み上げ本文は約{speech}字。［ ］は声に出さない。",
        "",
        "前の版は、試合の動画を見る道具が主軸。この版は、同じ学校の文化祭で、CO2を吸うと倒れる鳥が主軸。タイトルと、用語をスライドに定義しない置き方は同じ。",
        "",
        "確認できた事実は、依頼の範囲だけ。Unityで作ったゲームであること。同じ学校の文化祭の当事者として話すこと。鳥はCO2を吸うと倒れること。濃度の数値、操作、タイトル画面の文言、来場者数、スクリプトの行は、このリポジトリに実物が無かったので入れていない。聞かれても作らない。",
        "",
        "用語の言い換えはセリフに入っている。各スライドの「口頭の一文」は抜き書きなので二度読まない。詳しい解説は口頭では読まない。",
        "",
        "## 話し方",
        "",
        "- 最初の一文で、外から来た人の話ではないと置く。",
        "- スライド2のあと3秒。挙手が無くても成功。",
        "- スライド8で数字を言わない。",
        "- スライド3と10のあと、一拍置く。早口だと7分を切る。",
        "- スライド10は急がない。一酸化炭素と二酸化炭素を混ぜない。",
        "- スライド13で人数を言わない。",
        "- 15で終える。",
        "",
        "## セリフ",
        "",
    ]
    for slide in SLIDES:
        lines.append(f"### スライド {slide['n']:02d}　目安 {slide['seconds']}秒")
        lines.append("")
        if slide["cut"]:
            lines.append(f"急ぐとき。{slide['cut']}")
            lines.append("")
        lines.append(slide["spoken"].strip())
        lines.append("")
        if not slide["terms"]:
            lines.append("このスライドで新しく定義する用語はない。")
            lines.append("")
            continue
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
    lines.append("## 質問が来たとき")
    lines.append("")
    for item in QA:
        lines.append(f"**{item['q']}**")
        lines.append("")
        lines.append(item["a"])
        lines.append("")
        for name in item["terms"]:
            term = TERMS[name]
            lines.append(f"関連。{name}（{term['reading']}）。{term['one']}")
            lines.append("")
    lines.append("## 用語集")
    lines.append("")
    lines.append("スライドには載せていない。口頭の一文はセリフに入っている分。詳しい解説は、原稿を厚くするとき用。")
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
    for name in seen:
        term = TERMS[name]
        lines.append(f"### {name}（{term['reading']}）")
        lines.append("")
        lines.append(f"口頭の一文。{term['one']}")
        lines.append("")
        lines.append(term["deep"])
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    prs.core_properties.title = "奥妙なAI領域（文化祭）"
    prs.core_properties.subject = "探究発表 7〜10分 文化祭の鳥"
    prs.core_properties.category = "探究発表"
    build(prs)
    pptx_path = OUT_DIR / "奥妙なAI領域_文化祭.pptx"
    md_path = OUT_DIR / "奥妙なAI領域_文化祭_発表原稿.md"
    prs.save(pptx_path)
    md_path.write_text(manuscript(), encoding="utf-8")
    speech = sum(spoken_chars(slide["spoken"]) for slide in SLIDES)
    seconds = sum(slide["seconds"] for slide in SLIDES)
    print(f"slides={len(prs.slides)} speech_chars={speech} planned_sec={seconds}")
    print(pptx_path)
    print(md_path)


if __name__ == "__main__":
    main()
