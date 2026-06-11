import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/destination", "routes/destination-search.tsx"),
  route("/register", "routes/register.tsx"),
  route("/login", "routes/login.tsx"),
  route("/logout", "routes/logout.ts"),
  route("/api/city-search", "routes/api.city-search.ts"),
  route("/api/current-pollen", "routes/api.current-pollen.ts"),
] satisfies RouteConfig;
