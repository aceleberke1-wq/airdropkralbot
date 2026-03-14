import * as playerCommandNavigation from "../shared/playerCommandNavigation.js";

const { resolvePlayerCommandNavigation } = playerCommandNavigation;

export function resolvePlayerCommandTarget(commandKey) {
  return resolvePlayerCommandNavigation(commandKey);
}
