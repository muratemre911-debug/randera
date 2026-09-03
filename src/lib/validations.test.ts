import { describe, it, expect } from "vitest";
import { 
  createTenantSchema, 
  bookAppointmentSchema, 
  sendNotificationSchema,
  updateTenantSchema,
  createSectorSchema,
  registerSchema,
  validateRequest 
} from "@/lib/validations";

describe("Validation Schemas", () => {
  describe("createTenantSchema", () => {
    it("should validate valid tenant data", () => {
      const validData = {
        tenantName: "Test İşletme",
        fullName: "Test Sahibi",
        sector: "berber",
        email: "test@example.com",
        password: "123456",
      };

      const result = validateRequest(createTenantSchema, validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tenantName).toBe("Test İşletme");
      }
    });

    it("should reject invalid email", () => {
      const invalidData = {
        tenantName: "Test",
        fullName: "Test",
        sector: "berber",
        email: "invalid-email",
        password: "123456",
      };

      const result = validateRequest(createTenantSchema, invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject short password", () => {
      const invalidData = {
        tenantName: "Test",
        fullName: "Test",
        sector: "berber",
        email: "test@example.com",
        password: "123",
      };

      const result = validateRequest(createTenantSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("bookAppointmentSchema", () => {
    it("should validate valid appointment data", () => {
      const validData = {
        tenant_id: "550e8400-e29b-41d4-a716-446655440000",
        service_id: "550e8400-e29b-41d4-a716-446655440001",
        start_time: "2026-01-15T10:00:00.000Z",
        end_time: "2026-01-15T10:30:00.000Z",
        note: "Test notu",
      };

      const result = validateRequest(bookAppointmentSchema, validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const invalidData = {
        tenant_id: "invalid-uuid",
        service_id: "550e8400-e29b-41d4-a716-446655440001",
        start_time: "2026-01-15T10:00:00.000Z",
        end_time: "2026-01-15T10:30:00.000Z",
      };

      const result = validateRequest(bookAppointmentSchema, invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid datetime", () => {
      const invalidData = {
        tenant_id: "550e8400-e29b-41d4-a716-446655440000",
        service_id: "550e8400-e29b-41d4-a716-446655440001",
        start_time: "invalid-date",
        end_time: "2026-01-15T10:30:00.000Z",
      };

      const result = validateRequest(bookAppointmentSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("sendNotificationSchema", () => {
    it("should validate valid notification data", () => {
      const validData = {
        title: "Test Bildirimi",
        message: "Bu bir test mesajıdır",
        targetType: "all" as const,
      };

      const result = validateRequest(sendNotificationSchema, validData);
      expect(result.success).toBe(true);
    });

    it("should reject empty title", () => {
      const invalidData = {
        title: "",
        message: "Test",
        targetType: "all" as const,
      };

      const result = validateRequest(sendNotificationSchema, invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject invalid targetType", () => {
      const invalidData = {
        title: "Test",
        message: "Test",
        targetType: "invalid" as const,
      };

      const result = validateRequest(sendNotificationSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("createSectorSchema", () => {
    it("should validate valid sector data", () => {
      const validData = {
        name: "Berber",
        value: "berber",
      };

      const result = validateRequest(createSectorSchema, validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid value format", () => {
      const invalidData = {
        name: "Berber",
        value: "Berber Shop", 
      };

      const result = validateRequest(createSectorSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("should validate valid registration data", () => {
      const validData = {
        email: "user@example.com",
        password: "123456",
        fullName: "Test User",
      };

      const result = validateRequest(registerSchema, validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const invalidData = {
        email: "invalid",
        password: "123456",
        fullName: "Test",
      };

      const result = validateRequest(registerSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });
});