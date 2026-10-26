import type { CoachLanguage } from "../coach-language.ts";

export type LiveSpokenKind = "scan" | "apex" | "valorant";

const LINES: Record<Exclude<CoachLanguage, "ja" | "en">, Record<LiveSpokenKind, string>> = {
  pt: {
    scan: "{rank} {character}, o scan mostra dois times a oeste. Anel 4, 40 segundos. Terceira agora. Não entra na briga da frente.",
    apex: "{rank} {character}, duas linhas no médio. Tem espaço no ring. Corta e vai na pedra. Empurrar é isca.",
    valorant: "{rank} {character}, você swingou com o heaven aberto. Volta na parede. Fecha só com um ângulo.",
  },
  ko: {
    scan: "{rank} {character}, 스캔에 서쪽 두 스쿼드. 4링 40초 남음. 지금은 서드. 정면 싸움에 들어가지 마.",
    apex: "{rank} {character}, 중거리에서 시야가 두 개. 링 안에 공간 있어. 끊고 바위로. 밀면 밥이야.",
    valorant: "{rank} {character}, 헤븐 열어 둔 채 스윙했어. 벽으로 돌아가. 각 하나만 보고 끝내.",
  },
  de: {
    scan: "{rank} {character}, Scan zeigt zwei Squads im Westen. Ring 4, 40 Sekunden. Jetzt Third-Party. Nicht in den Frontfight.",
    apex: "{rank} {character}, zwei Sichtlinien auf Mittel. Platz im Ring. Abbrechen, zum Felsen. Push ist Köder.",
    valorant: "{rank} {character}, du swingst mit offenem Heaven. Zurück an die Wand. Close erst mit einem Winkel.",
  },
  fr: {
    scan: "{rank} {character}, le scan montre deux squads à l’ouest. Anneau 4, 40 secondes. Third maintenant. Ne plonge pas devant.",
    apex: "{rank} {character}, deux lignes en mid. De la place dans le ring. Coupe et va au rocher. Pousser, c’est un appât.",
    valorant: "{rank} {character}, tu swing avec heaven ouvert. Retour au mur. Close avec un seul angle.",
  },
  es: {
    scan: "{rank} {character}, el scan muestra dos equipos al oeste. Anillo 4, 40 segundos. Third ahora. No entres al frente.",
    apex: "{rank} {character}, dos líneas en media. Hay sitio en el ring. Corta y ve a la roca. Empujar es cebo.",
    valorant: "{rank} {character}, swingueaste con heaven abierto. Vuelve al muro. Cierra con un solo ángulo.",
  },
  pl: {
    scan: "{rank} {character}, skan pokazuje dwie drużyny na zachodzie. Ring 4, 40 sekund. Teraz third. Nie wchodź z przodu.",
    apex: "{rank} {character}, dwie linie na średnim. Jest miejsce w ringu. Tnij i idź do skały. Push to przynęta.",
    valorant: "{rank} {character}, swingujesz z otwartym heaven. Wróć do ściany. Domknij jeden kąt.",
  },
  "zh-TW": {
    scan: "{rank} {character}，掃描西邊兩隊。第4圈剩40秒。現在漁夫。不要衝正面。",
    apex: "{rank} {character}，中距離兩條視線。圈內有空間。切斷，去石頭。硬推是餌。",
    valorant: "{rank} {character}，天堂還開著就探出去。回牆。只留一個角度再收。",
  },
  tr: {
    scan: "{rank} {character}, tarama batıda iki takım gösteriyor. 4. halka, 40 saniye. Şimdi third. Ön kapışmaya girme.",
    apex: "{rank} {character}, orta menzilde iki hat. Halka içinde yer var. Kes ve kayaya git. İtmek yem.",
    valorant: "{rank} {character}, heaven açıkken salladın. Duvara dön. Tek açıdan kapat.",
  },
  it: {
    scan: "{rank} {character}, la scan mostra due squadre a ovest. Anello 4, 40 secondi. Third ora. Non entrare davanti.",
    apex: "{rank} {character}, due linee a media. C’è spazio nel ring. Taglia e vai alla roccia. Spingere è un’esca.",
    valorant: "{rank} {character}, hai swingato con heaven aperto. Torna al muro. Chiudi con un solo angolo.",
  },
  id: {
    scan: "{rank} {character}, scan menunjukkan dua skuad di barat. Ring 4, 40 detik. Third sekarang. Jangan masuk ke depan.",
    apex: "{rank} {character}, dua garis di jarak menengah. Ada ruang di dalam ring. Putus dan ke batu. Mendorong itu umpan.",
    valorant: "{rank} {character}, kamu swing saat heaven masih terbuka. Kembali ke dinding. Tutup dengan satu sudut.",
  },
};

export function liveSpokenLine(
  language: CoachLanguage,
  kind: LiveSpokenKind,
  rank: string,
  character: string,
  japanese: string,
  english: string,
) {
  if (language === "ja") return japanese;
  if (language === "en") return english;
  return LINES[language][kind].replaceAll("{rank}", rank).replaceAll("{character}", character);
}
