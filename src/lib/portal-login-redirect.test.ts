import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authenticatedLoginRedirect,
  roleDashboardPath,
} from "./portal-login-redirect";

describe("roleDashboardPath", () => {
  it("maps portal roles to their own dashboard", () => {
    assert.equal(roleDashboardPath("admin"), "/portal/admin");
    assert.equal(roleDashboardPath("coordinator"), "/portal/school");
    assert.equal(roleDashboardPath("student"), "/portal/student");
    assert.equal(roleDashboardPath(null), "/portal/student");
  });
});

describe("authenticatedLoginRedirect", () => {
  it("redirects authenticated users away from the public login screen", () => {
    assert.equal(
      authenticatedLoginRedirect({ id: "user-1" }, "/portal", "admin"),
      "/portal/admin",
    );
  });

  it("keeps anonymous users on the login screen", () => {
    assert.equal(authenticatedLoginRedirect(null, "/portal"), null);
  });

  it("falls back to the portal home for unsafe redirects", () => {
    assert.equal(
      authenticatedLoginRedirect({ id: "user-1" }, "/portal/login", "coordinator"),
      "/portal/school",
    );
    assert.equal(
      authenticatedLoginRedirect({ id: "user-1" }, "https://evil.test", "admin"),
      "/portal/admin",
    );
  });

  it("honors safe deep links after sign-in", () => {
    assert.equal(
      authenticatedLoginRedirect(
        { id: "user-1" },
        "/portal/admin/resources?page=2",
        "admin",
      ),
      "/portal/admin/resources?page=2",
    );
  });
});
