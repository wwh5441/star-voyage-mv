import { LYRICS } from "../../data/lyrics.js";

export class OverlayController {
  constructor() {
    this.subBox = document.getElementById("subtitle-box");
    this.subZh = document.getElementById("sub-zh");
    this.subEn = document.getElementById("sub-en");
    this.heroTitle = document.getElementById("hero-title");
    this.endLayer = document.getElementById("black-card-layer");
    this.lastLyricIdx = -2;
  }

  update(t, actInfo) {
    const { act } = actInfo;

    if (act.heroTitle && t >= act.heroTitle[0] && t <= act.heroTitle[1]) {
      this.heroTitle.classList.add("is-visible");
    } else {
      this.heroTitle.classList.remove("is-visible");
    }

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
