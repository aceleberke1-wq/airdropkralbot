# AirdropKralBot Web3 Core Architecture V1

Kaynak blueprint: `apps/bot/src/architecture/web3CoreBlueprint.js`

Bu dokuman AirdropKralBot'un Web3 cekirdek sistem kararlarini kilitler. Merkez karar su: urun TON-first kalir, oyun hizi ve entitlement otoritesi offchain kalir, onchain yuzeyler ise trust, portability ve premium ownership kaniti icin secici olarak kullanilir.

## 1. Non-Negotiable Decisions

1. TON tek primary identity chain'dir.
2. Gameplay, progression, anti-fraud ve entitlement hesaplama offchain authoritative kalir.
3. Runtime private key tutmaz; ana uygulama treasury hot wallet calistirmaz.
4. NXT utility ve settlement rayidir; ana oyun reward loop'u degildir.
5. Bitcoin primary session wallet degil, payout destination rail'idir.
6. EVM ve Solana optional secondary rail'dir; TON-exclusive degerler bilerek korunur.
7. Payout her zaman reserve, risk, velocity ve duplicate kontrolleri ile gated kalir.

## 2. Alternative Decisions Rejected And Why

1. Chain-neutral identity first reddedildi.
   Birden fazla esit primary chain, Telegram-native urunu parcalar.
2. Fully onchain gameplay reddedildi.
   Gas ve latency maliyeti retention'i bozar.
3. App-managed hot wallet reddedildi.
   Runtime compromise dogrudan treasury incident'ina donusur.
4. Liquid farming reward modeli reddedildi.
   Oyun extraction-first davranisa kayar.
5. NFT-everything reddedildi.
   Mikro item'lar zincire yazilmaya degmez.
6. Bitcoin as full connect wallet reddedildi.
   Genel kullanici icin yeterince tutarli Telegram wallet UX'i yoktur.

## 3. Implementation Risks

1. Wallet verification gap
   Bugun wallet proof katmani format-only seviyesinde; production icin TON proof ve chain-native verify gerekir.
2. Ledger / treasury drift
   Entitlement liability ile gercek reserve ayrisirse payout trust'i zarar gorur.
3. Wallet rebind abuse
   Ayni wallet'in hesaplar arasinda dolasilmasi referral ve payout abuse dogurur.
4. Onchain / offchain divergence
   Badge veya pass mint edilip oyun katmanina zamaninda yansimazsa support yuku patlar.
5. Token speculation overhang
   NXT dagitimi gevsek olursa urun ekonomisini token davranisi domine eder.
6. Operator key concentration
   Warm wallet limiti ve dual-control olmadan treasury riski kabul edilemez.

## 4. MVP Subset

1. TON Connect primary wallet linking
2. EVM ve SOL secondary linking advanced settings arkasinda
3. BTC payout destination only
4. SC / RC / HC tamamen offchain
5. NXT mevcut utility/settlement flow ile kalir ama gameplay emission olmaz
6. BTC primary payout rail + manual review + limited safe auto
7. TON identity credential yalniz pilot seviyesinde
8. No gameplay micro-event minting

## 5. Scale-Ready Subset

1. TON identity credential verified kullanicilar icin varsayilan olur
2. Season badge, premium pass ve selected event ticket TON'a tasinir
3. Claim attestation registry partner/campaign trust icin acilir
4. NXT governed settlement rail olarak net treasury policy ile yonetilir
5. TON payout rail verified cohort icin acilir
6. Secili EVM/SOL payout rails campaign bazli acilir
7. Dynamic auto-policy segment ve chain bazli calisir
8. Reserve-vs-liability dashboard ve chain-by-chain reconciliation zorunlu hale gelir

## 6. Critical Open Questions You Resolved Yourself

1. Token olmali mi
   Evet. Ama NXT yalniz utility/settlement asset olacak, gameplay faucet olmayacak.
2. Gameplay onchain olmali mi
   Hayir. Yalniz trust artiran credential ve claim proof onchain'e tasinacak.
3. Multi-chain esit mi olmali
   Hayir. TON primary, EVM/SOL secondary, BTC payout-oriented.
4. Badge ve credential transfer edilebilir mi
   Identity ve season soulbound; ticket ve pass restricted.
5. BTC wallet primary olabilir mi
   Hayir.
6. Payout full-auto olabilir mi
   Hayir. Auto path sadece safe segmentlerde acilir.

## 7. Exact Engineering Handoff Checklist

1. `packages/shared/src/v5/walletAuthEngine.js` icindeki format-only modelini kaldir.
2. Server-side TON Connect proof verification ekle.
3. EVM ve Solana icin chain-native signature verify ekle.
4. Wallet challenge nonce'larini domain + expiry + action scope ile tut.
5. TON'u tek primary wallet field'i olarak kilitle.
6. Secondary wallets icin ayri linked-wallets yapisi kur.
7. Wallet binding history ve relink cooldown ekle.
8. Unlink ve primary switch audit trail yaz.
9. Gameplay eventlerini onchain'e yazma.
10. TON identity credential issuer flow'unu feature flag ile ac.
11. SC/RC/HC ve entitlements icin append-only ledger referanslarini zorunlu yap.
12. Reserve-vs-liability rollup ve reconciliation job'lari ekle.
13. BTC'yi MVP payout rail olarak koru.
14. TON/EVM/SOL payout rails reconciliation tooling olmadan acma.
15. Payout request'te duplicate destination, velocity ve recent-auth kontrollerini zorunlu yap.
16. Final payout execution'i external operator path ile sinirla.
17. `request_id`, `operator_id`, `tx_hash`, `reconciliation_status` kaydini zorunlu yap.
18. Review reason enum'larini ops, support ve analytics ile ortaklastir.
19. Chain risk tier ve auto-limitleri admin policy tables uzerinden yonet.
20. Claim registry'yi yalniz gercek partner proof ihtiyacinda ac.
21. Contract event indexer olmadan ownership-sensitive benefit verme.
22. Wallet status, payout status ve proof state trust surface'lerini goster.
23. Beginner path'i wallet-light tut; secondary chains'i gizle.
24. Wallet hop, shared destination ve referral spike watchdog kur.
25. Pause payouts / disable auto / raise chain risk tier runbook'unu yaz.

## 8. Web3-First System Philosophy

1. Tek primary chain, coklu optional rail.
2. Kullanici anahtarini tutar; urun proof ve transaction talep eder.
3. Oyun hizi offchain kalir; onchain yalniz trust artirdigi yerde vardir.
4. Treasury gercegi marketing dilinden once gelir.
5. Web3 complexity, value gorulmeden kullaniciya zorla yuklenmez.

## 9. TON-First Architecture

### TON'un gorevi

1. Primary wallet identity
2. Identity credential rayi
3. Season badge ve premium ownership rayi
4. NXT utility token rayi

### Wallet connect flow

1. User `Connect TON` der.
2. Mini App TON Connect provider acilir.
3. Wallet proof doner.
4. Server proof, nonce, domain ve expiry'yi verify eder.
5. Wallet primary olarak bind edilir.
6. Session'a wallet trust context'i yazilir.

### Mint kararlari

Mint edilir:

1. verified wallet link tamamlandiginda identity credential
2. season completion finalize oldugunda badge
3. premium purchase tamamlandiginda pass proof
4. event finalization oldugunda ticket
5. claim batch finalize oldugunda attestation

Mint edilmez:

1. task accept
2. task complete
3. loot reveal micro-reward
4. pvp tick veya action
5. referral click

## 10. Offchain vs Onchain Boundary Map

### Offchain kalacaklar

1. Telegram account state
2. gameplay sessions
3. anti-fraud and risk scoring
4. entitlement ledger
5. payout approval pipeline
6. premium effect logic
7. campaign eligibility logic

### Onchain tasinacaklar

1. TON identity credential
2. season badge
3. premium pass ownership proof
4. selected event tickets
5. selected claim attestations
6. NXT utility token

### Mirror mantigi

1. Gameplay onchain'e tasinmaz; sonuc bazli prestige veya proof tasinir.
2. Payout logic contract'a itilmez; final settlement tx kanit olarak zincire cikar.
3. Campaign logic tam tasinmaz; root veya attestation enough kabul edilir.

## 11. Multi-Chain Wallet Strategy

1. TON primary wallet'tir.
2. EVM ve SOL secondary wallet'tir.
3. BTC payout destination'dir.
4. Primary TON card her zaman ayri gosterilir.
5. Secondary rails advanced settings altinda tutulur.
6. Primary switch cooldown ve trust reset warning'i verir.
7. TON-exclusive yuzeyler: identity credential, season badge, premium pass ownership, fastest auto-review path.
8. EVM/SOL partner campaign ve optional payout rail olarak kullanilir.
9. BTC reserve-friendly settlement ve payout destination olarak kalir.

## 12. Smart Contract / Module Blueprint

1. `nxt_jetton`
   Transferable utility and settlement rail. Token immutable, distributor governed.
2. `identity_credential`
   Soulbound verified TON-linked identity proof. Minimal issue/revoke surface.
3. `season_badge`
   Soulbound season prestige proof.
4. `event_ticket`
   Restricted until redeemed; campaign and live event access proof.
5. `premium_pass`
   Restricted portable premium ownership proof.
6. `claim_attestation_registry`
   Append-only root or attestation registry for partner trust.
7. `reputation_anchor`
   Su an yok. Privacy ve operator abuse maliyeti faydadan buyuk.

## 13. Cryptoeconomic Model

1. SC: offchain labor/progression currency
2. RC: offchain scarcity/crafting currency
3. HC: offchain premium and payout-gated utility currency
4. NXT: TON utility and settlement asset

### Temel kararlar

1. SC/RC/HC public token gibi davranmaz.
2. NXT gameplay micro-emission asset'i degildir.
3. Entitlement ledger reserve'den ayri raporlanir.
4. Pending route value kullaniciya garanti likidite gibi sunulmaz.
5. Anti-inflation daily caps, fatigue, sinks, release gates ve payout drip caps ile saglanir.

## 14. Payout And Treasury Architecture

### Payout flow

1. earn offchain
2. ledger record
3. payout request
4. risk and duplicate checks
5. safe auto or manual review
6. operator transfer
7. tx proof record
8. reconciliation close

### Treasury model

1. cold reserve
2. warm operator wallet
3. no runtime hot wallet
4. chain-by-chain reserve view
5. dual-control for limit changes

### Chain rules

1. BTC: MVP primary payout rail, manual-first
2. TON: future verified-user payout rail
3. EVM: optional fee-sensitive payout rail
4. SOL: optional campaign payout rail

## 15. Web3 UX Inside Telegram Mini App

1. Value first, wallet second.
2. TON Connect recommended path.
3. Signature requests acikca "not a payment" diye anlatilir.
4. Transaction requests asset, amount, chain ve reason ile gosterilir.
5. Cancel her zaman safe state'e doner.
6. Signature fail olursa urun tamamen kilitlenmez.
7. Secondary chain controls beginner path'te gosterilmez.

## 16. Security And Adversarial Defense

1. nonce-bound wallet proof
2. short-lived challenge
3. primary wallet uniqueness
4. relink cooldown
5. many accounts / one wallet graph check
6. many wallets / one device cluster check
7. shared payout destination detection
8. referral tree velocity spike detection
9. first payout hold
10. relinked wallet hold
11. reserve protection hold
12. server-side verification only
13. contract event reconciliation before ownership-sensitive credits
14. emergency controls: pause payouts, pause claim publications, disable high-risk auto, raise chain risk tier

## 17. Rollout Phases From MVP To Full Web3 Depth

### Phase 1

1. TON Connect primary wallet
2. offchain authoritative economy
3. BTC payout rail
4. manual review + limited auto

### Phase 2

1. TON identity credential pilot
2. reserve-vs-liability dashboard
3. season badge
4. wallet graph scoring

### Phase 3

1. EVM/SOL secondary linking
2. partner chain routing
3. TON premium and event modules

### Phase 4

1. NXT governed settlement rail
2. claim attestation registry
3. TON payout rail for verified cohorts
4. dynamic auto policy by segment and chain
5. full reconciliation stack
