import { mountReactWebAppV1 } from "./react/runtime";

void mountReactWebAppV1().catch((err) => {
  console.error("react-webapp-bootstrap-failed", err);
});
