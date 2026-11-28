#!/usr/bin/env python3
"""文化祭版。鳥は Arduino IDE、的当ては Unity の SHIHOUSAIBOSS。

用語の定義はノートと原稿。濃度、点数、実在の行は、このリポジトリに無いので言わない。
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
    "Arduino IDE": {
        "reading": "あるでゅいーの あいでぃーいー",
        "one": "基板に送るプログラムを書いて、書き込んで、動かすための道具。",
        "deep": "鳥はこちらで作る。画面のゲームエンジンではない。スケッチを書き、ボードを選んで書き込み、シリアルモニタで数値を見る、という往復が作業の本体。",
    },
    "スケッチ": {
        "reading": "すけっち",
        "one": "Arduino IDE で書くプログラムのファイル。",
        "deep": "拡張子は .ino。鳥の吸う、倒れる、はここに書く。的当ての C# とはファイルが別。同じ依頼に混ぜると、ピンの話と当たり判定が一つの差分に入る。",
    },
    "書き込み": {
        "reading": "かきこみ",
        "one": "書いたスケッチを、机の上のボードへ送る操作。",
        "deep": "画面の中で正しく見えても、書き込んで、ケーブルが繋がっていないと鳥は動かない。エージェントは基板に触れない。最後の確認は、机の前でやる。",
    },
    "シリアルモニタ": {
        "reading": "しりあるもにた",
        "one": "ボードが送ってくる数字や文字を、パソコン側で見る窓。",
        "deep": "CO2の濃さは、ここで見る。いくつで倒れるかは、この資料を作った時点で実物を開いていないので言わない。聞かれても、数字は作らない。",
    },
    "Unity": {
        "reading": "ゆにてぃ",
        "one": "的当てを作っているゲームエンジン。SHIHOUSAIBOSS というプロジェクト。",
        "deep": "鳥の土台ではない。絵、入力、当たり、スクリプトを一つのプロジェクトに置く。毎フレーム、世界を更新する。日本語の指示はそのまま実行されない。",
    },
    "C#": {
        "reading": "シーシャープ",
        "one": "Unity が繰り返し実行するプログラミング言語。",
        "deep": "的に当たったあとの処理は、こちらに書く。エージェントは日本語の『当たらない』を、この言語の差分に落とす。実在の行は、このリポジトリに無いので引用しない。",
    },
    "シーン": {
        "reading": "しーん",
        "one": "的やカメラや光を置いた、Unity の一つの場。",
        "deep": "文化祭で見ている画面は、シーンが再生された結果。エージェントはシーンの見た目をマウスで触れないことが多い。触るのは、シーンが参照しているスクリプトと数値。",
    },
    "プレハブ": {
        "reading": "ぷれはぶ",
        "one": "的のように、同じ見た目の部品を何度でも置ける型。",
        "deep": "英語では Prefab。一つ直すと、置いてある的がまとめて変わる。的の絵と、当たったあとの処理は別の場所にある。",
    },
    "インスペクター": {
        "reading": "いんすぺくたー",
        "one": "選んだ部品の数値を、コードの外で変える欄。",
        "deep": "速さや大きさや、当たったとみなす距離を、ここで持つことがある。エージェントがスクリプトだけ直して、こちらの数値を見落つことがある。再生して、初めて分かる。",
    },
    "フレーム": {
        "reading": "ふれーむ",
        "one": "画面を更新する1回。そのたびに、当たったかを見る。",
        "deep": "60フレームなら1秒に60回。Update という関数が呼ばれる。的当ての判定は、この繰り返しの中にある。",
    },
    "エージェント": {
        "reading": "えーじぇんと",
        "one": "会話で終わらず、ファイルを書いて、動かして、失敗を読むAI。",
        "deep": "一問一答は、説明の文章が返ったところで止まる。エージェントは差分を出し、ターミナルを叩き、エラーを次の修正に使う。採用するか捨てるかは、見る側が決める。",
    },
    "差分": {
        "reading": "さぶん",
        "one": "足した行と、消した行。採用するか捨てるかを見るためのもの。",
        "deep": "英語では diff。緑が追加、赤が削除、と呼ぶことが多い。チャットの答えと違って、ファイルが変わる。関係ないファイルまで入っていたら、その依頼は捨てる。",
    },
    "ツール呼び出し": {
        "reading": "つーるよびだし",
        "one": "モデルが、ファイルやターミナルなどの道具を自分で選んで使うこと。",
        "deep": "読む、書く、コンパイルする、検索する、が道具にあたる。呼んでいい範囲を決めておかないと、的の修正のはずが鳥のスケッチまで開く。",
    },
    "コンテキスト": {
        "reading": "こんてきすと",
        "one": "その一回に、モデルへ見せている材料の全部。",
        "deep": "指示文だけではない。開いているファイル、直前の差分、エラーログも入る。見せていないことは知らない。見せすぎると、的と鳥が混ざる。",
    },
    "プロンプト": {
        "reading": "ぷろんぷと",
        "one": "AIに渡す指示文。見ている範囲と、やってほしいことと、やらないことを書く。",
        "deep": "気の利いた一言より、どのファイルを見るか、何を変えないか、出力は差分か、が書いてある方がぶれにくい。",
    },
    "ルール": {
        "reading": "るーる",
        "one": "次の依頼でも守らせるために、ファイルへ残した指示。",
        "deep": "チャットの履歴は次に開くと薄れる。ファイルは残る。消す前に聞け、的と鳥を同じ差分に入れるな、数字を埋めさせるな、のような文を置いておく。",
    },
    "ハルシネーション": {
        "reading": "はるしねーしょん",
        "one": "無い関数や、無いピンや、根拠の無い数字を、本当みたいに書くこと。",
        "deep": "コンパイルの赤か、書き込んだあとの無反応で分かる。それらしい行を、動いたことにしない。赤を日本語で返す。",
    },
    "CO2": {
        "reading": "シーオーツー",
        "one": "二酸化炭素。鳥が吸うと倒れる、と置いている気体。",
        "deep": "息に含まれる。炭鉱のカナリアの話の主因である一酸化炭素とは別。濃度の数値は、実物を開いていないので言わない。",
    },
    "一酸化炭素": {
        "reading": "いっさんかたんそ",
        "one": "化学式は CO。カナリアが先に倒れた話の、主な気体。",
        "deep": "この鳥が吸う気体ではない。字が似ているので、一文で分ける。長くは話さない。",
    },
}


SLIDES: list[dict] = [
    {
        "n": 1,
        "seconds": 20,
        "terms": [],
        "cut": "",
        "spoken": """奥妙なAI領域、です。
今日は文化祭の裏側です。廊下に出ていたものと、作っているときにやっていたこと。
すごい、で押し通す話にはしません。""",
    },
    {
        "n": 2,
        "seconds": 30,
        "terms": [],
        "cut": "手が無くても進む。",
        "spoken": """同じ文化祭に、二つありました。
机の上の鳥と、画面の的当てです。
見た人、いますか。
［3秒。手が無くても進む］
見た人は、もう同じ床の側です。""",
    },
    {
        "n": 3,
        "seconds": 35,
        "terms": ["Arduino IDE", "Unity"],
        "cut": "",
        "spoken": """鳥は Arduino IDE で作ります。基板にプログラムを書いて、書き込んで、動かす側です。
的当ては Unity です。SHIHOUSAIBOSS というプロジェクトで進めていたゲームです。
道具は、別々です。""",
    },
    {
        "n": 4,
        "seconds": 30,
        "terms": ["CO2", "一酸化炭素"],
        "cut": "点数と濃度の数字は作らない。",
        "spoken": """廊下で見えたものは、短いです。
鳥は、二酸化炭素を吸うと倒れる。炭鉱のカナリアは一酸化炭素の話なので、そこは混ぜません。
的は、狙って当てる。点数やボタンの並びは、実物の画面を開いてから話します。""",
    },
    {
        "n": 5,
        "seconds": 40,
        "terms": ["エージェント", "差分", "プロンプト"],
        "cut": "",
        "spoken": """作っているときの往復は、こうです。
フォルダを渡します。指示文を、プロンプトと言います。エージェントがファイルを書きます。
返ってくるのは、差分です。足した行と、消した行。
それを見て、採用するか、捨てるか。採用した行だけが、次の鳥と的に残ります。
検索で使う人には、この往復が見えません。""",
    },
    {
        "n": 6,
        "seconds": 40,
        "terms": ["ツール呼び出し"],
        "cut": "",
        "spoken": """エージェントは、会話で止まらないAIです。
ファイルを開く。書く。ターミナルでコンパイルする。エラーの赤を読む。これをツール呼び出しと言います。次に使う道具を、モデルが選びます。
コンパイルは、こちらがボタンを押す前に走ることがあります。赤が出たら、そのログが次の材料です。
呼んでいい範囲を決めておかないと、的のファイルを直してほしいのに、鳥のスケッチまで開き始めます。""",
    },
    {
        "n": 7,
        "seconds": 35,
        "terms": ["コンテキスト"],
        "cut": "",
        "spoken": """その一回に見せている材料の全部を、コンテキストと言います。
的のシーンと、鳥のスケッチを同じ依頼に入れると、当たり判定の話が、ピンのファイルに混ざります。
エラーログも、開いているファイルも、ここに入ります。入れたくないものは、依頼の外に置きます。
混ぜる原因は、見せた範囲が広いことです。""",
    },
    {
        "n": 8,
        "seconds": 40,
        "terms": ["スケッチ", "書き込み", "シリアルモニタ"],
        "cut": "濃さの数字は作らない。",
        "spoken": """鳥の側です。Arduino IDE のプログラムを、スケッチと言います。
ボードへ送る操作が、書き込みです。送ったあと、シリアルモニタで数字を見ます。濃さは、その数字の側にあります。
書き込みが終わると、ボードは一度リセットされます。そのあとで、数字が動くかと、鳥が倒れるかを、別々に見ます。
コードが正しく見えても、ケーブルが抜けていれば鳥は倒れません。エージェントは、机の上の基板に触れません。""",
    },
    {
        "n": 9,
        "seconds": 45,
        "terms": ["C#", "シーン", "プレハブ", "インスペクター", "フレーム"],
        "cut": "実在の関数名は引用しない。",
        "spoken": """的当ての側です。Unity が繰り返し実行するのは C# です。画面の更新1回を、フレームと言います。
的を置く場がシーン。同じ見た目を何度も置ける型がプレハブ。数値の欄がインスペクター。当たったあとの処理は、別のスクリプトです。
プレハブを直すと、置いてある的がまとめて変わります。スクリプトだけ直して、インスペクターの数値が古いまま、ということも起きます。
当たらない、と返すと、それらしい名前の関数を書いてくることがあります。Unity に無い関数です。コンパイルの赤で、初めて分かります。""",
    },
    {
        "n": 10,
        "seconds": 30,
        "terms": ["ルール"],
        "cut": "",
        "spoken": """同じ失敗を次で繰り返させないために、ルールをファイルに残します。
消す前に聞け。的と鳥を同じ差分に入れるな。数字は埋めさせるな。
チャットの履歴は、次に開くと薄れます。ファイルに残すと、同じ失敗を最初からやり直しにくくなります。"""
    },
    {
        "n": 11,
        "seconds": 30,
        "terms": ["ハルシネーション"],
        "cut": "",
        "spoken": """存在しないピン。存在しない関数。それらしい濃度。
根拠がないのに本当みたいなのを、ハルシネーションと言います。
赤を読んで、日本語で返す。長い教訓にはしません。""",
    },
    {
        "n": 12,
        "seconds": 25,
        "terms": [],
        "cut": "",
        "spoken": """ここまでが、作っている側の往復です。
頼んだ言葉は、日本語でした。
専門の手順は残っています。入口の言語が、変わった。""",
    },
    {
        "n": 13,
        "seconds": 25,
        "terms": [],
        "cut": "",
        "spoken": """廊下に出たのは、結果だけです。
倒れる鳥と、当たる的。差分も、シリアルモニタも、出ていません。
出ていない方が、出し物としては正しい。""",
    },
    {
        "n": 14,
        "seconds": 30,
        "terms": ["コンテキスト", "ハルシネーション", "ルール"],
        "cut": "",
        "spoken": """やることは、三つです。
見せる範囲を決める。それがコンテキストです。
赤を、日本語で返す。それが、ハルシネーションへの返し方です。
ルールは、ファイルに残す。次の自分が、同じ失敗をしないためです。""",
    },
    {
        "n": 15,
        "seconds": 25,
        "terms": [],
        "cut": "",
        "spoken": """奥妙の中身は、廊下の外側にありました。
自分の出し物の、見えていない側は何ですか。
［ここで終える］""",
    },
]


QA = [
    {
        "q": "鳥は Unity で作ったのか。",
        "a": "違います。鳥は Arduino IDE です。Unity は的当てで、プロジェクトの名前は SHIHOUSAIBOSS です。",
        "terms": ["Arduino IDE", "Unity"],
    },
    {
        "q": "的当ての操作や点数は。",
        "a": "狙って当てるゲームだ、というところまでです。ボタンの並びや点数は、実物のプロジェクトをこの資料では開いていないので言いません。",
        "terms": ["Unity", "C#"],
    },
    {
        "q": "CO2のいくつで倒れるのか。",
        "a": "数字は持っていません。シリアルモニタで濃さを見る、という作業の話です。炭鉱のカナリアは一酸化炭素で、この鳥が吸うのは二酸化炭素です。",
        "terms": ["シリアルモニタ", "CO2", "一酸化炭素"],
    },
    {
        "q": "差分って、何を見ているのか。",
        "a": "足した行と消した行です。エージェントがファイルを変えた結果を、採用するか捨てるかをそこで決めます。",
        "terms": ["差分", "エージェント"],
    },
    {
        "q": "AIが全部書いたのか。",
        "a": "書き、コンパイルし、エラーを読むところまでは進みます。基板への書き込みと、当たったかどうかの確認は、机の前で残ります。",
        "terms": ["エージェント", "書き込み", "ツール呼び出し"],
    },
]


def note_for(slide: dict) -> str:
    if slide["terms"]:
        block = "\n".join(
            f"・{name}（{TERMS[name]['reading']}）: {TERMS[name]['one']}" for name in slide["terms"]
        )
    else:
        block = "・このスライドで新しく出す用語はない。"
    cut = f"\n控えること: {slide['cut']}\n" if slide["cut"] else "\n"
    return f"""スライド {slide['n']:02d} / 15。目安 {slide['seconds']}秒。
{cut}
セリフ:
{slide['spoken'].strip()}

用語:
{block}
"""


def build(prs: Presentation) -> None:
    s = new_slide(prs, True)
    write(s, 0.72, 1.7, 11.5, 0.34, ["探究発表"], 16, GOLD, bold=True)
    write(s, 0.72, 2.15, 12, 1.2, ["奥妙なAI領域"], 60, CREAM, bold=True)
    rect(s, 0.74, 3.5, 2.05, 0.035, VERM)
    write(s, 0.72, 3.85, 11.5, 1.4, ["文化祭の、裏側。"], 36, CREAM, bold=True)
    notes(s, note_for(SLIDES[0]))

    s = new_slide(prs, False)
    kicker(s, "文化祭")
    write(s, 0.72, 1.7, 12, 2.4, ["鳥と、的。"], 60, INK_TEXT, bold=True)
    write(s, 0.72, 4.3, 11.5, 1.2, ["机の上と、画面の中。"], 28, MUTED_ON_PAPER)
    footer(s, 2, False)
    notes(s, note_for(SLIDES[1]))

    s = new_slide(prs, True)
    kicker(s, "道具")
    write(s, 0.72, 1.45, 12, 2.2, ["鳥は、Arduino。", "的は、Unity。"], 44, CREAM, bold=True, spacing=1.08)
    write(s, 0.72, 4.7, 11.5, 0.8, ["SHIHOUSAIBOSS"], 28, GOLD, bold=True)
    footer(s, 3, True)
    notes(s, note_for(SLIDES[2]))

    s = new_slide(prs, False)
    kicker(s, "見えたもの")
    write(s, 0.72, 1.7, 12, 2.6, ["吸うと、倒れる。", "狙って、当てる。"], 44, INK_TEXT, bold=True, spacing=1.08)
    footer(s, 4, False)
    notes(s, note_for(SLIDES[3]))

    s = new_slide(prs, True)
    kicker(s, "差分")
    write(s, 0.72, 1.8, 12, 2.4, ["返ってくるのは、", "差分。"], 52, CREAM, bold=True, spacing=1.02)
    write(s, 0.72, 4.8, 11.5, 0.8, ["足した行と、消した行。"], 22, MUTED_ON_INK)
    footer(s, 5, True)
    notes(s, note_for(SLIDES[4]))

    s = new_slide(prs, True)
    kicker(s, "エージェント   ·   ツール呼び出し")
    write(s, 0.72, 1.8, 12, 2.2, ["手を、動かす。"], 52, CREAM, bold=True)
    write(s, 0.72, 4.5, 11.5, 1.2, ["開く。書く。コンパイルする。", "赤を、読む。"], 24, MUTED_ON_INK, spacing=1.25)
    footer(s, 6, True)
    notes(s, note_for(SLIDES[5]))

    s = new_slide(prs, False)
    kicker(s, "コンテキスト")
    write(s, 0.72, 1.8, 12, 2.4, ["見せた範囲しか、", "知らない。"], 44, INK_TEXT, bold=True, spacing=1.05)
    footer(s, 7, False)
    notes(s, note_for(SLIDES[6]))

    s = new_slide(prs, True)
    kicker(s, "スケッチ   ·   書き込み")
    write(s, 0.72, 1.7, 12, 2.2, ["書いて、", "書き込む。"], 52, CREAM, bold=True, spacing=1.02)
    write(s, 0.72, 4.6, 11.5, 0.8, ["シリアルモニタで、数字を見る。"], 22, GOLD)
    footer(s, 8, True)
    notes(s, note_for(SLIDES[7]))

    s = new_slide(prs, False)
    kicker(s, "C#   ·   プレハブ   ·   インスペクター")
    write(s, 0.72, 1.7, 12, 2.2, ["当たらない、", "を返す。"], 48, INK_TEXT, bold=True, spacing=1.02)
    write(s, 0.72, 4.6, 11.5, 0.8, ["無い関数は、コンパイルが教える。"], 22, MUTED_ON_PAPER)
    footer(s, 9, False)
    notes(s, note_for(SLIDES[8]))

    s = new_slide(prs, True)
    kicker(s, "ルール")
    write(s, 0.72, 1.8, 12, 2.4, ["次の自分に、", "残す。"], 52, CREAM, bold=True, spacing=1.02)
    footer(s, 10, True)
    notes(s, note_for(SLIDES[9]))

    s = new_slide(prs, False)
    kicker(s, "ハルシネーション")
    write(s, 0.72, 1.8, 12, 2.2, ["それらしい行は、", "出る。"], 48, INK_TEXT, bold=True, spacing=1.02)
    footer(s, 11, False)
    notes(s, note_for(SLIDES[10]))

    s = new_slide(prs, True)
    write(s, 0.72, 2.05, 12, 2.4, ["頼んだのは、", "日本語。"], 52, CREAM, bold=True, spacing=1.02)
    footer(s, 12, True)
    notes(s, note_for(SLIDES[11]))

    s = new_slide(prs, False)
    write(s, 0.72, 1.8, 12, 2.6, ["廊下に出たのは、", "結果だけ。"], 44, INK_TEXT, bold=True, spacing=1.05)
    footer(s, 13, False)
    notes(s, note_for(SLIDES[12]))

    s = new_slide(prs, True)
    steps = [
        ("1", "見せる範囲を、決める"),
        ("2", "赤を、日本語で返す"),
        ("3", "ルールを、ファイルに残す"),
    ]
    for i, (num, label) in enumerate(steps):
        y = 1.55 + i * 1.5
        write(s, 0.72, y, 1.1, 1.0, [num], 36, VERM, bold=True, anchor="ctr")
        write(s, 2.15, y, 10, 1.0, [label], 32, CREAM, bold=True, anchor="ctr")
    footer(s, 14, True)
    notes(s, note_for(SLIDES[13]))

    s = new_slide(prs, True)
    write(s, 0.72, 1.7, 12, 2.2, ["見えていない側は、", "何？"], 44, CREAM, bold=True, spacing=1.05)
    footer(s, 15, True)
    extra = "\n".join(f"Q. {item['q']}\n{item['a']}" for item in QA)
    notes(s, note_for(SLIDES[14]) + "\n\n聞かれたときの答え。\n\n" + extra)



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
        "探究発表の別版。想定は7〜10分。スライドは15枚。",
        f"セリフの目安合計は {total // 60}分{total % 60:02d}秒。読み上げ本文は約{speech}字。［ ］は声に出さない。",
        "",
        "同じ学校の文化祭に、二つある。机の上の鳥は Arduino IDE。画面の的当ては Unity で、プロジェクト名は SHIHOUSAIBOSS。鳥を Unity の話にしない。",
        "",
        "確認できているのは、その切り分けと、鳥は CO2 を吸うと倒れること、的は狙って当てるゲームであること。濃度の数値、点数、操作、ピン番号、実在のスクリプトの行は、このリポジトリに無い。聞かれても作らない。作業の話（差分、ツール呼び出し、コンテキスト、ルール）は、その開発の進め方として話してよい。",
        "",
        "用語の意味はセリフに入っている。下の説明は、準備のとき用。",
        "",
        "## 話し方",
        "",
        "- すごい、を繰り返さない。作業が見えれば足りる。",
        "- スライド2のあと3秒。手が無くても進む。",
        "- 濃度と点数は作らない。",
        "- カナリアの話は一文で分ける。",
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
            lines.append(term["deep"])
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
