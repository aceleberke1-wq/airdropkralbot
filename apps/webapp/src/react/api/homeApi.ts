import type { HomeFeed, WebAppApiResponse, WebAppAuth } from "../types";
import { getJson, withAuthQuery } from "./common";
import { parseHomeFeedResponse } from "../../core/contracts/v2Validators.js";

export async function fetchHomeFeedV2(auth: WebAppAuth): Promise<WebAppApiResponse<HomeFeed>> {
  const query = withAuthQuery(auth);
  const response = await getJson<WebAppApiResponse<HomeFeed>>(`/webapp/api/v2/home/feed?${query}`);
  return parseHomeFeedResponse(response) as WebAppApiResponse<HomeFeed>;
}
