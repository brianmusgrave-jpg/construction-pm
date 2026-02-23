import { describe, it, expect } from "vitest";
import { can, canAny, canCreateProject, canManagePhase, canReviewPhase } from "@/lib/permissions";

describe("Permissions", () => {
  describe("can()", () => {
    describe("ADMIN role", () => {
      it("can do everything on projects", () => {
        expect(can("ADMIN", "view", "project")).toBe(true);
        expect(can("ADMIN", "create", "project")).toBe(true);
        expect(can("ADMIN", "update", "project")).toBe(true);
        expect(can("ADMIN", "delete", "project")).toBe(true);
        expect(can("ADMIN", "manage", "project")).toBe(true);
      });

      it("can manage phases", () => {
        expect(can("ADMIN", "manage", "phase")).toBe(true);
      });

      it("can manage members", () => {
        expect(can("ADMIN", "create", "member")).toBe(true);
        expect(can("ADMIN", "delete", "member")).toBe(true);
      });
    });

    describe("PROJECT_MANAGER role", () => {
      it("can create but not delete projects", () => {
        expect(can("PROJECT_MANAGER", "create", "project")).toBe(true);
        expect(can("PROJECT_MANAGER", "delete", "project")).toBe(false);
      });

      it("can create members but not delete them", () => {
        expect(can("PROJECT_MANAGER", "create", "member")).toBe(true);
        expect(can("PROJECT_MANAGER", "delete", "member")).toBe(false);
      });

      it("can manage phases", () => {
        expect(can("PROJECT_MANAGER", "manage", "phase")).toBe(true);
      });
    });

    describe("CONTRACTOR role", () => {
      it("can view and update phases", () => {
        expect(can("CONTRACTOR", "view", "phase")).toBe(true);
        expect(can("CONTRACTOR", "update", "phase")).toBe(true);
      });

      it("cannot create or delete projects", () => {
        expect(can("CONTRACTOR", "create", "project")).toBe(false);
        expect(can("CONTRACTOR", "delete", "project")).toBe(false);
      });

      it("can upload documents and photos", () => {
        expect(can("CONTRACTOR", "create", "document")).toBe(true);
        expect(can("CONTRACTOR", "create", "photo")).toBe(true);
      });

      it("cannot manage members", () => {
        expect(can("CONTRACTOR", "create", "member")).toBe(false);
        expect(can("CONTRACTOR", "delete", "member")).toBe(false);
      });

      it("can update checklists", () => {
        expect(can("CONTRACTOR", "update", "checklist")).toBe(true);
      });
    });

    describe("STAKEHOLDER role", () => {
      it("can only view everything", () => {
        expect(can("STAKEHOLDER", "view", "project")).toBe(true);
        expect(can("STAKEHOLDER", "view", "phase")).toBe(true);
        expect(can("STAKEHOLDER", "view", "document")).toBe(true);
        expect(can("STAKEHOLDER", "create", "project")).toBe(false);
        expect(can("STAKEHOLDER", "update", "phase")).toBe(false);
      });
    });

    describe("VIEWER role", () => {
      it("can view basic resources", () => {
        expect(can("VIEWER", "view", "project")).toBe(true);
        expect(can("VIEWER", "view", "phase")).toBe(true);
      });

      it("cannot access staff or members", () => {
        expect(can("VIEWER", "view", "staff")).toBe(false);
        expect(can("VIEWER", "view", "member")).toBe(false);
      });
    });

    describe("Unknown role", () => {
      it("returns false for any permission", () => {
        expect(can("UNKNOWN", "view", "project")).toBe(false);
        expect(can("UNKNOWN", "create", "phase")).toBe(false);
      });
    });
  });

  describe("canAny()", () => {
    it("returns true if any action is allowed", () => {
      expect(canAny("CONTRACTOR", ["create", "update"], "phase")).toBe(true);
    });

    it("returns false if no actions are allowed", () => {
      expect(canAny("VIEWER", ["create", "delete"], "project")).toBe(false);
    });
  });

  describe("canCreateProject()", () => {
    it("ADMIN can create projects", () => {
      expect(canCreateProject("ADMIN")).toBe(true);
    });

    it("PROJECT_MANAGER can create projects", () => {
      expect(canCreateProject("PROJECT_MANAGER")).toBe(true);
    });

    it("CONTRACTOR cannot create projects", () => {
      expect(canCreateProject("CONTRACTOR")).toBe(false);
    });
  });

  describe("canManagePhase()", () => {
    it("ADMIN can manage phases", () => {
      expect(canManagePhase("ADMIN")).toBe(true);
    });

    it("CONTRACTOR cannot manage phases", () => {
      expect(canManagePhase("CONTRACTOR")).toBe(false);
    });
  });

  describe("canReviewPhase()", () => {
    it("ADMIN can review phases", () => {
      expect(canReviewPhase("ADMIN")).toBe(true);
    });

    it("PROJECT_MANAGER can review phases", () => {
      expect(canReviewPhase("PROJECT_MANAGER")).toBe(true);
    });

    it("CONTRACTOR cannot review phases", () => {
      expect(canReviewPhase("CONTRACTOR")).toBe(false);
    });
  });
});
