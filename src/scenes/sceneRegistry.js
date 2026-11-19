import { buildLaunchpadScene } from "../builders/launchpadScene.js";
import { buildMissionControlScene } from "../builders/missionControlScene.js";
import { buildCabinCockpitScene } from "../builders/cabinCockpitScene.js";
import { buildGravityBreakScene } from "../builders/gravityBreakScene.js";
import { buildStarchartScene } from "../builders/starchartScene.js";
import { buildCosmicVeinsScene } from "../builders/cosmicVeinsScene.js";
import { buildVoyageScene } from "../builders/voyageScene.js";
import { buildReentryScene } from "../builders/reentryScene.js";
import { buildMarsTouchdownScene } from "../builders/crewAndMarsScenes.js";
import { buildStarlinkScene } from "../builders/starlinkScene.js";
import { buildOneBitScene } from "../builders/onebitScene.js";
import { buildOrbitalComputeScene } from "../builders/orbitalComputeScene.js";
import { buildRaptorSymphonyScene } from "../builders/raptorSymphonyScene.js";
import { buildCleanFleetScene } from "../builders/fleetDepartureScene.js";
import { buildBridgeAstrolabeScene } from "../builders/bridgeAstrolabeScene.js";
import { buildNebulaCruiseScene } from "../builders/nebulaCruiseScene.js";
import { buildSupernovaGateScene } from "../builders/galacticBreakthroughScene.js";
import { buildSingularityGenesisScene } from "../builders/singularityGenesisScene.js";
import { buildOperatorsScene } from "../builders/operatorsScene.js";
import { buildStarRunnerScene } from "../builders/starRunnerScene.js";
import { buildAbyssToLightyearScene } from "../builders/abyssToLightyearScene.js";
import { buildLightyearOdysseyScene } from "../builders/lightyearOdysseyScene.js";
import { buildFinaleOneBitScene } from "../builders/finaleScene.js";

// 100% Pure-Code Three.js WebGL2 3D Scene Registry (23 Active Scenes)
export function createSceneRegistry() {
  return {
    launchpad: buildLaunchpadScene(),
    mission_control: buildMissionControlScene(),
    cabin_prep: buildCabinCockpitScene(),
    gravitybreak: buildGravityBreakScene(),
    starchart: buildStarchartScene(),
    cosmic_veins: buildCosmicVeinsScene(),
    voyage: buildVoyageScene(),
    reentry_descent: buildReentryScene(),
    s13_steel_soil: buildMarsTouchdownScene(),
    s14_starlink: buildStarlinkScene(),
    onebit: buildOneBitScene(),
    s16_orbital_compute: buildOrbitalComputeScene(),
    s16b_engine_song: buildRaptorSymphonyScene(),
    fleet_plate: buildCleanFleetScene(),
    s18_bridge_holo: buildBridgeAstrolabeScene(),
    s19_nebula_cruise: buildNebulaCruiseScene(),
    s20_supernova_gate: buildSupernovaGateScene(),
    s21_genesis_odyssey: buildSingularityGenesisScene(),
    operators: buildOperatorsScene(),
    s25a_star_runner: buildStarRunnerScene(),
    s26_abyss_lightyear: buildAbyssToLightyearScene(),
    s26b_lightyear_odyssey: buildLightyearOdysseyScene(),
    finale: buildFinaleOneBitScene()
  };
}
