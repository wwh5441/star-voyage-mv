export const MV_DURATION = 289.35;

// 33 high-density zero-repeat shots grounded in SpaceX's 2026 IPO (Form S-1 / SPCX) narrative
export const ACTS = [
  // Intro (00:00 - 00:40.7) -> 4 escalating pre-launch beats
  { id: "s01_rail", t0: 0.0, t1: 10.0, label: "S01 · 星海铁轨", scene: "launchpad", submode: "approach", heroTitle: [2.5, 9.4], inkStrength: 1.0, bloomStrength: 0.62 },
  { id: "s02a_control", t0: 10.0, t1: 13.4, label: "S02A · 监控室全员确认", scene: "mission_control", submode: "s02a", inkStrength: 1.06, bloomStrength: 0.52 },
  { id: "s02b_clamp", t0: 13.4, t1: 16.8, label: "S02B · 箭体液压固定", scene: "cabin_prep", submode: "clamp_lock", inkStrength: 1.05, bloomStrength: 0.56 },
  { id: "s02c_preign", t0: 16.8, t1: 20.2, label: "S02C · 引擎集群预点火", scene: "cabin_prep", submode: "pilot_lock", inkStrength: 1.05, bloomStrength: 0.44 },
  // S03A -> S03B -> S03C: 10.3s Unbroken ONE-TAKE on the EXACT SAME launchpad asset as S01 / S04 / S05!
  { id: "s03a_bottom", t0: 20.2, t1: 23.6, label: "S03A · 一镜到底底部仰升", scene: "launchpad", submode: "s03_bottom", inkStrength: 1.05, bloomStrength: 0.62 },
  { id: "s03b_top", t0: 23.6, t1: 27.0, label: "S03B · 一镜到底箭顶环视", scene: "launchpad", submode: "s03_top", inkStrength: 1.05, bloomStrength: 0.62 },
  { id: "s03c_bloom", t0: 27.0, t1: 30.5, label: "S03C · 一镜到底四臂绽放撤离", scene: "launchpad", submode: "s03_bloom", inkStrength: 1.06, bloomStrength: 0.66 },
  { id: "s04_reactor", t0: 30.5, t1: 40.7, label: "S04 · 发射塔蓄能", scene: "launchpad", submode: "closeup", inkStrength: 1.08, bloomStrength: 0.72 },

  // Verse 1: Every 2 lines a brand-new plot beat!
  { id: "s05_liftoff", t0: 40.7, t1: 49.0, label: "S05 · 脱轨点火越尘埃", scene: "launchpad", submode: "liftoff", inkStrength: 1.05, bloomStrength: 0.95 },
  { id: "s06_gravity", t0: 49.0, t1: 57.1, label: "S06 · 级间分离破引力井", scene: "gravitybreak", inkStrength: 1.08, bloomStrength: 0.84 },

  // Pre-Chorus 1
  { id: "s07_starchart", t0: 57.1, t1: 65.0, label: "S07 · 星图展开散迷雾", scene: "starchart", submode: "unfold", inkStrength: 1.04, bloomStrength: 0.74 },
  { id: "s08a_future", t0: 65.0, t1: 68.8, label: "S08A · 探未来深空扫描", scene: "cosmic_veins", submode: "explore_future", inkStrength: 1.04, bloomStrength: 0.72 },
  { id: "s08b_veins", t0: 68.8, t1: 73.5, label: "S08B · 推演宇宙命脉", scene: "cosmic_veins", submode: "deduce_veins", inkStrength: 1.02, bloomStrength: 0.82 },

  // Chorus 1: True unbroken ONE-TAKE (一镜到底):
  // S09 (73.5-86.6s): White light wraps Ark ring -> tunnel rings fade away -> pure white light illuminates the night!
  // S10 (86.6-90.5s): Same unbroken camera & Ark cleanly SMASHES & SHATTERS the hexagonal boundary wall!
  { id: "s09_light", t0: 73.5, t1: 86.6, label: "S09 · 意识之光点燃长夜", scene: "voyage", submode: "boundary", inkStrength: 1.06, bloomStrength: 0.90 },
  { id: "s10_shatter", t0: 86.6, t1: 90.5, label: "S10 · 突破这边界", scene: "voyage", submode: "boundary_break", inkStrength: 1.08, bloomStrength: 0.92 },

  // Interlude 1: Gas Giant Ring Skim (until 01:33) -> Gravitational Slingshot to New Rocky Gravity System -> Reentry!
  { id: "s11a_giant", t0: 90.5, t1: 93.0, label: "S11A · 孤帆掠过气态星环", scene: "voyage", submode: "gasgiant", inkStrength: 1.02, bloomStrength: 0.62 },
  { id: "s11b_slingshot", t0: 93.0, t1: 98.5, label: "S11B · 引力弹弓跃入新星系", scene: "voyage", submode: "slingshot_transfer", inkStrength: 1.04, bloomStrength: 0.78 },
  { id: "s12_reentry", t0: 98.5, t1: 106.3, label: "S12 · 突入异星大气层", scene: "reentry_descent", inkStrength: 1.06, bloomStrength: 0.86 },

  // Verse 2A: Mars Base Alpha + Starlink V3 Constellation
  { id: "s13_touchdown", t0: 106.3, t1: 114.6, label: "S13 · 荒原建城邦钢铁吻土", scene: "s13_steel_soil", inkStrength: 1.0, bloomStrength: 0.62 },
  { id: "s14_network", t0: 114.6, t1: 122.9, label: "S14 · 星链降临星火膨胀", scene: "s14_starlink", inkStrength: 1.0, bloomStrength: 0.68 },

  // Verse 2B: 1-Bit Quantization -> Orbital AI Compute -> Raptor Engines Singing at Full Thrust
  { id: "s15_onebit", t0: 122.9, t1: 131.2, label: "S15 · 极简一比特量化狂热", scene: "onebit", operatorBadge: "QUANTIZATION // 1-BIT BINARY CORE", inkStrength: 1.12, bloomStrength: 0.74 },
  { id: "s16a_galaxy", t0: 131.2, t1: 135.2, label: "S16A · 轨道算力穿透银河", scene: "s16_orbital_compute", inkStrength: 1.0, bloomStrength: 0.72 },
  { id: "s16b_engine", t0: 135.2, t1: 139.4, label: "S16B · 猛禽引擎高歌", scene: "s16b_engine_song", inkStrength: 1.04, bloomStrength: 0.88 },

  // Pre-Chorus 2
  { id: "s17a_fleet", t0: 139.4, t1: 143.0, label: "S17A · 星图再展舰队启航", scene: "fleet_plate", submode: "unfold_fleet", inkStrength: 1.0, bloomStrength: 0.68 },
  { id: "s17b_mist", t0: 143.0, t1: 147.4, label: "S17B · 迷雾全散开", scene: "fleet_plate", submode: "mist_clear", inkStrength: 1.02, bloomStrength: 0.84 },
  { id: "s18_veins2", t0: 147.4, t1: 156.0, label: "S18 · 舰桥星盘推演命脉", scene: "s18_bridge_holo", inkStrength: 1.0, bloomStrength: 0.66 },

  // Chorus 2
  { id: "s19_accel", t0: 156.0, t1: 165.95, label: "S19 · 意识之光星云远航", scene: "s19_nebula_cruise", inkStrength: 1.0, bloomStrength: 0.72 },
  { id: "s20_flare", t0: 165.95, t1: 174.5, label: "S20 · 点燃长夜破界裂隙", scene: "s20_supernova_gate", inkStrength: 1.0, bloomStrength: 0.78 },

  // Instrumental Bridge -> Original 4-Act Cosmic Genesis & Singularity Odyssey (growing directly out of S20's lone pinpoint -> S23 AI Operators!)
  { id: "s21a_genesis", t0: 174.5, t1: 178.0, label: "S21A · 孤点蓄能奇点初现", scene: "s21_genesis_odyssey", submode: "genesis", inkStrength: 1.02, bloomStrength: 0.84 },
  { id: "s21b_devour", t0: 178.0, t1: 184.0, label: "S21B · 黑洞成长潮汐爆发", scene: "s21_genesis_odyssey", submode: "devour", inkStrength: 1.06, bloomStrength: 0.96 },
  { id: "s21c_wormhole", t0: 184.0, t1: 191.0, label: "S21C · 坠入视界虫洞光廊", scene: "s21_genesis_odyssey", submode: "wormhole", inkStrength: 1.06, bloomStrength: 0.94 },
  { id: "s22_tesseract", t0: 191.0, t1: 197.1, label: "S22 · 奇点内部算子觉醒", scene: "s21_genesis_odyssey", submode: "tesseract", inkStrength: 1.08, bloomStrength: 0.92 },

  // Climax Rap: Four Deep-Learning Operators (every 1 line = distinct operator!)
  { id: "s23_resnet_attn", t0: 197.1, t1: 205.8, label: "S23 · 残差剥离与注意力黑洞", scene: "operators", submode: "quad", inkStrength: 1.12, bloomStrength: 0.92 },
  { id: "s24_svd_8b", t0: 205.8, t1: 214.6, label: "S24 · SVD降维与八十亿脉动", scene: "operators", submode: "quad", inkStrength: 1.12, bloomStrength: 0.94 },

  // Climax Bridge Pt. 2: Seamless ONE-TAKE Interstellar Runner (drum-locked!) -> Stardust Morphs into Pen Writing "Sign" in Mid-Air!
  { id: "s25a_runner", t0: 214.6, t1: 218.3, label: "S25A · 星际长跑没有终点", scene: "s25a_star_runner", submode: "runner", inkStrength: 1.0, bloomStrength: 0.88 },
  { id: "s25b_sign", t0: 218.3, t1: 222.5, label: "S25B · 落笔无悔一签", scene: "s25a_star_runner", submode: "sign", inkStrength: 1.0, bloomStrength: 0.38 },
  { id: "s26a_abyss", t0: 222.5, t1: 226.4, label: "S26A · 跨越无垠深渊", scene: "s26_abyss_lightyear", submode: "abyss", inkStrength: 1.0, bloomStrength: 0.65 },
  // 22.8s Seamless ONE-TAKE Odyssey: S26B (Carve 「人」) -> S27 (Armada Voyage) -> S28A (THE ONE Strong-Light Galactic Ignition!)
  { id: "s26b_lightyear", t0: 226.4, t1: 235.5, label: "S26B · 将人类名字刻在光年", scene: "s26b_lightyear_odyssey", submode: "lightyear", inkStrength: 1.0, bloomStrength: 0.38 },
  { id: "s27_warp", t0: 235.5, t1: 244.1, label: "S27 · 意识之光星辰流浪", scene: "s26b_lightyear_odyssey", submode: "voyage", inkStrength: 1.04, bloomStrength: 0.42 },
  { id: "s28a_ignite", t0: 244.1, t1: 249.2, label: "S28A · 点燃长夜银河齐燃", scene: "s26b_lightyear_odyssey", submode: "ignite", inkStrength: 1.02, bloomStrength: 0.85 },
  { id: "s28b_break", t0: 249.2, t1: 257.0, label: "S28B · 终极突破边界", scene: "s26b_lightyear_odyssey", submode: "horizon_break", inkStrength: 1.02, bloomStrength: 0.48 },

  // Outro: S29 (180 101010... Micro-Light Threads) -> S30 (Warp + Exponential Swell) -> S31 (Instant Pitch-Black Cut!)
  { id: "s29_glimmer", t0: 257.0, t1: 265.6, label: "S29 · 一比特的微光", scene: "finale", submode: "glimmer", inkStrength: 1.02, bloomStrength: 0.50 },
  { id: "s30_leap", t0: 265.6, t1: 278.45, label: "S30 · 向尽头跃迁·意识不灭", scene: "finale", submode: "leap", inkStrength: 1.02, bloomStrength: 0.82 },
  { id: "s31_endcard", t0: 278.45, t1: MV_DURATION, label: "S31 · 瞬间死寂黑屏", scene: "finale", submode: "endcard", endCard: true, inkStrength: 1.0, bloomStrength: 0.0 }
];

export function getActAt(t) {
  const clamped = Math.max(0, Math.min(MV_DURATION - 0.001, t));
  for (let i = 0; i < ACTS.length; i++) {
    const a = ACTS[i];
    if (clamped >= a.t0 && clamped < a.t1) {
      return { act: a, index: i, u: (clamped - a.t0) / (a.t1 - a.t0), localT: clamped - a.t0 };
    }
  }
  const last = ACTS[ACTS.length - 1];
  return { act: last, index: ACTS.length - 1, u: 1, localT: last.t1 - last.t0 };
}
