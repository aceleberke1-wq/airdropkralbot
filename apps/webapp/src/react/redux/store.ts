import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { webappApi } from "./api/webappApi";
import {
  adminReducer,
  monetizationReducer,
  playerReducer,
  pvpReducer,
  sceneReducer,
  sessionReducer,
  telemetryReducer,
  uiReducer,
  vaultReducer,
  walletReducer
} from "./slices/shellSlices";

export const appStore = configureStore({
  reducer: {
    session: sessionReducer,
    ui: uiReducer,
    player: playerReducer,
    pvp: pvpReducer,
    vault: vaultReducer,
    wallet: walletReducer,
    monetization: monetizationReducer,
    admin: adminReducer,
    telemetry: telemetryReducer,
    scene: sceneReducer,
    [webappApi.reducerPath]: webappApi.reducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(webappApi.middleware)
});

setupListeners(appStore.dispatch);

export type RootState = ReturnType<typeof appStore.getState>;
export type AppDispatch = typeof appStore.dispatch;

