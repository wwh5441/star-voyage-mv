import { LYRICS } from "../../data/lyrics.js";

export class OverlayController {
  constructor() {
    this.subBox = document.getElementById("subtitle-box");
    this.subZh = document.getElementById("sub-zh");
    this.subEn = document.getElementById("sub-en");
    this.heroTitle = document.getElementById("hero-title");
    this.opBadge = document.getElementById("operator-badge");
    this.endLayer = document.getElementById("black-card-layer");
    this.lastLyricIdx = -2;
  }

  update(t, actInfo) {
    const { act } = actInfo;

    // 1. Hero Title ("星 航 / STAR VOYAGE")
    if (act.heroTitle && t >= act.heroTitle[0] && t <= act.heroTitle[1]) {
      this.heroTitle.classList.add("is-visible");
    } else {
      this.heroTitle.classList.remove("is-visible");
    }

    // 2. Operator HUD Badge (1-Bit & Climax 4-Operator Sequence)
    let badgeText = act.operatorBadge || null;
    if (act.id === "s23_resnet_attn" || act.id === "s24_svd_8b") {
      if (t < 201.69) badgeText = "OP 01 // RESNET · 剥离残差波动";
      else if (t < 205.83) badgeText = "OP 02 // ATTENTION · 拆解注意力黑洞";
      else if (t < 210.10) badgeText = "OP 03 // SVD · 奇异值分解星空";
      else badgeText = "OP 04 // 8B PULSES · 八十亿次脉动";
    }
    if (badgeText) {
      if (this.opBadge.textContent !== badgeText) this.opBadge.textContent = badgeText;
      this.opBadge.classList.add("is-visible");
    } else {
      this.opBadge.classList.remove("is-visible");
    }

    // 3. Finale Pure Blackout (0.20s after S31 starts) -> Animated "星 航" Closing Title (1.75s into pure black!)
    if (act.endCard && t >= act.t0 + 0.20) {
      this.endLayer.classList.add("is-visible");
      if (t >= act.t0 + 1.75) {
        this.endLayer.classList.add("is-title-shown");
      } else {
        this.endLayer.classList.remove("is-title-shown");
      }
    } else {
      this.endLayer.classList.remove("is-visible");
      this.endLayer.classList.remove("is-title-shown");
    }

    // 4. Bottom Letterbox Lyrics
    let activeIdx = -1;
    for (let i = 0; i < LYRICS.length; i++) {
      if (t >= LYRICS[i].t0 && t <= LYRICS[i].t1) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx !== this.lastLyricIdx) {
      this.lastLyricIdx = activeIdx;
      if (activeIdx === -1) {
        this.subBox.classList.remove("is-visible");
      } else {
        const line = LYRICS[activeIdx];
        this.subZh.innerHTML = line.zh;
        this.subEn.textContent = line.en;
        this.subBox.classList.add("is-visible");
      }
    }
  }
}
