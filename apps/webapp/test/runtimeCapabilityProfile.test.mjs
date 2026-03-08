import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveCapabilityProfile,
  resolveDeviceClass,
  resolvePerfTier
} from "../src/core/runtime/capabilityProfile.js";

test("resolvePerfTier and device class classify constrained mobile devices", () => {
  assert.equal(resolvePerfTier({ cores: 4, memoryGb: 4, viewportWidth: 390 }), "low");
  assert.equal(resolveDeviceClass({ viewportWidth: 390, touch: true }), "mobile");
});

test("resolveCapabilityProfile degrades low-end mobile into lite compact mode", () => {
  const profile = resolveCapabilityProfile({
    viewportWidth: 390,
    viewportHeight: 844,
    dpr: 2.75,
    cores: 4,
    memoryGb: 4,
    touch: true,
    saveData: true,
    prefersReducedMotion: false,
    reducedMotion: false,
    largeText: false,
    qualityMode: "auto",
    connectionType: "3g"
  });

  assert.equal(profile.perf_tier, "low");
  assert.equal(profile.device_class, "mobile");
  assert.equal(profile.effective_quality, "low");
  assert.equal(profile.effective_hud_density, "compact");
  assert.equal(profile.effective_reduced_motion, true);
  assert.equal(profile.scene_profile, "lite");
  assert.equal(profile.low_end_mode, true);
});

test("resolveCapabilityProfile preserves explicit high quality override on capable desktop", () => {
  const profile = resolveCapabilityProfile({
    viewportWidth: 1600,
    viewportHeight: 1000,
    dpr: 1.5,
    cores: 12,
    memoryGb: 16,
    touch: false,
    saveData: false,
    prefersReducedMotion: false,
    reducedMotion: false,
    largeText: false,
    qualityMode: "high",
    connectionType: "4g"
  });

  assert.equal(profile.perf_tier, "high");
  assert.equal(profile.device_class, "desktop");
  assert.equal(profile.requested_quality, "high");
  assert.equal(profile.effective_quality, "high");
  assert.equal(profile.effective_hud_density, "normal");
  assert.equal(profile.effective_reduced_motion, false);
  assert.equal(profile.scene_profile, "cinematic");
  assert.equal(profile.low_end_mode, false);
});
