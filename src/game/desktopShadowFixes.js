import * as THREE from 'three';
import { RoadQuestGame } from './RoadQuestGame.js';

// Restore lightweight desktop shadows after the stage-balance performance guard.
// Mobile keeps shadows disabled, but desktop/laptop should keep enough contact
// shadow to preserve the voxel depth and premium look.
if (!RoadQuestGame.__ayamDesktopShadowFixesAppliedV1) {
  RoadQuestGame.__ayamDesktopShadowFixesAppliedV1 = true;

  const proto = RoadQuestGame.prototype;
  const originalApplyQualityProfile = proto._applyMobileQualityProfile;

  const isDesktopGame = (game) => game.renderProfile?.name === 'desktop-premium';
  const desktopMode = (game) => game.__ayamDesktopPerformanceMode || 'normal';

  const configureShadowMapSize = (sunlight, size) => {
    if (!sunlight?.shadow?.mapSize || !size) return;
    const currentWidth = sunlight.shadow.mapSize.width;
    const currentHeight = sunlight.shadow.mapSize.height;
    if (currentWidth === size && currentHeight === size) return;

    sunlight.shadow.mapSize.set(size, size);
    sunlight.shadow.map?.dispose?.();
    sunlight.shadow.map = null;
    sunlight.shadow.needsUpdate = true;
  };

  const restoreDesktopShadows = (game) => {
    if (!isDesktopGame(game) || !game.renderer) return;

    const mode = desktopMode(game);
    if (mode === 'severe') {
      game.renderer.shadowMap.enabled = false;
      if (game.sunlight) game.sunlight.castShadow = false;
      return;
    }

    const shadowSize = mode === 'pressure' ? 512 : 1024;
    game.renderer.shadowMap.enabled = true;
    game.renderer.shadowMap.type = THREE.PCFShadowMap;

    if (game.sunlight) {
      game.sunlight.castShadow = true;
      configureShadowMapSize(game.sunlight, shadowSize);
    }
  };

  proto._applyMobileQualityProfile = function applyQualityProfileWithDesktopShadows() {
    originalApplyQualityProfile?.call(this);
    restoreDesktopShadows(this);
  };
}
