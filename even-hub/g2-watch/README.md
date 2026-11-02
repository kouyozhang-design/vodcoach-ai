# Wrist Remote

Even Hub に追加する単体アプリです。G1 の代わりに、手持ちの Apple Watch Series 8 で Even G2 のこのページを操作します。レンズは Even Hub SDK が描きます。

G2 を開くと 4 文字のコードが出ます。Watch にそのコードとリレーのアドレスを入れると、タップ、ダブルタップ、デジタルクラウン、長押し、明るさがレンズに届きます。コメカミの操作も同じです。

## 開発

```bash
cd even-hub/g2-watch
npm install
npm test
npm run relay
npm run dev
npx evenhub-simulator http://localhost:5173
```

実機では、電話から届くアドレスを `app.json` の `network.whitelist` と `src/relay-origin.ts` に足します。ワイルドカードは使えません。

```bash
npx evenhub qr --url "http://<LAN-IP>:5173/?api=http://<LAN-IP>:8787"
```

パッケージは `npm run build` のあと `npx evenhub pack app.json dist -o wrist-remote.ehpk` です。開発者ポータルへこの `.ehpk` を追加します。

`watch/WristRemoteApp.swift` は watchOS 10 のターゲットに入れます。Series 8 の API 欄はリレーのアドレス（既定ポート 8787）です。
