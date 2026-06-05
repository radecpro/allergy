import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/api/city-search", "routes/api.city-search.ts"),
  route("/api/current-pollen", "routes/api.current-pollen.ts"),
] satisfies RouteConfig;
