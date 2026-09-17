import { z } from "zod";

export const createTenantSchema = z.object({
  tenantName: z.string().min(2, "İşletme adı en az 2 karakter olmalı").max(100),
  fullName: z.string().min(2, "Ad soyad en az 2 karakter olmalı").max(100),
  sector: z.string().min(1, "Sektör seçilmeli"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

export const bookAppointmentSchema = z.object({
  tenant_id: z.string().uuid("Geçersiz işletme ID"),
  service_id: z.string().uuid("Geçersiz hizmet ID"),
  /** Randevuyu verecek eleman (services.staff_id ile eşleşmeli) */
  staff_id: z.string().uuid("Geçersiz eleman ID").nullable().optional(),
  start_time: z.string().datetime("Geçersiz başlangıç zamanı"),
  end_time: z.string().datetime("Geçersiz bitiş zamanı"),
  note: z.string().max(500, "Not en fazla 500 karakter olmalı").optional(),
});

export const sendNotificationSchema = z.object({
  title: z.string().min(1, "Başlık gereklidir").max(100),
  message: z.string().min(1, "Mesaj gereklidir").max(1000),
  targetType: z.enum(["all", "sector", "single"]),
  targetValue: z.string().optional(),
});

export const updateTenantSchema = z.object({
  tenantId: z.string().uuid("Geçersiz işletme ID"),
  userId: z.string().uuid("Geçersiz kullanıcı ID"),
  tenantName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

export const updateTenantProfileSchema = z.object({
  tenantId: z.string().uuid("Geçersiz işletme ID"),
  name: z.string().min(2, "İşletme adı en az 2 karakter").max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email("Geçerli e-posta").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  province: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  street: z.string().max(200).optional(),
  building_no: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  theme_palette: z.string().max(30).optional(),
  profile_image_url: z.string().url().optional().or(z.literal("")),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  sector: z.string().max(50).optional(),
  working_hours: z
    .record(
      z.string(),
      z.object({
        isOpen: z.boolean(),
        openTime: z.string(),
        closeTime: z.string(),
      }),
    )
    .optional(),
  booking_rules: z
    .object({
      slotDuration: z.number().int().min(15).max(120).optional(),
      autoApprove: z.boolean().optional(),
      notifyEmail: z.boolean().optional(),
      notifySms: z.boolean().optional(),
      notifyWhatsapp: z.boolean().optional(),
      cancelDeadlineHours: z.number().int().min(0).max(168).optional(),
    })
    .optional(),
});

export const adminMembershipSchema = z
  .object({
    action: z.enum([
      "load-trial",
      "load-monthly",
      "load-custom",
      "adjust",
      "suspend",
      "activate",
    ]),
    tenantId: z.string().uuid("Geçersiz işletme ID").optional(),
    userId: z.string().uuid("Geçersiz kullanıcı ID").optional(),
    days: z.number().int().min(-3650).max(3650).optional(),
    tenantName: z.string().min(2).max(100).optional(),
    sector: z.string().min(1).max(50).optional(),
  })
  .refine((v) => v.action !== "load-custom" || (v.days ?? 0) > 0, {
    message: "Gün sayısı girilmelidir",
    path: ["days"],
  })
  .refine(
    (v) => v.action !== "adjust" || (v.days !== undefined && v.days !== 0),
    {
      message: "Düşürülecek gün sayısı girilmelidir",
      path: ["days"],
    },
  )
  .refine(
    (v) => {
      // adjust/suspend/activate var olan işletmeyi hedefler;
      // süre yükleme işlemleri ya işletmeyi ya da (yetki verilecek) müşteri hesabını hedefler.
      if (["adjust", "suspend", "activate"].includes(v.action))
        return Boolean(v.tenantId);
      return (
        Boolean(v.tenantId) || Boolean(v.userId && v.tenantName && v.sector)
      );
    },
    { message: "Hedef hesap belirtilmelidir", path: ["tenantId"] },
  );

export const createSectorSchema = z.object({
  name: z.string().min(2).max(50),
  value: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/, "Sadece küçük harf, rakam ve alt çizgi"),
});

export const registerSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  fullName: z.string().min(2, "Ad soyad en az 2 karakter olmalı").max(100),
});

export const createCommentSchema = z.object({
  text: z
    .string()
    .min(1, "Yorum boş olamaz")
    .max(500, "Yorum en fazla 500 karakter olmalı"),
});

export const likeToggleSchema = z.object({
  postId: z.string().uuid("Geçersiz gönderi ID"),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type UpdateTenantProfileInput = z.infer<
  typeof updateTenantProfileSchema
>;
export type AdminMembershipInput = z.infer<typeof adminMembershipSchema>;
export type CreateSectorInput = z.infer<typeof createSectorSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type LikeToggleInput = z.infer<typeof likeToggleSchema>;

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const zodError = result.error as z.ZodError;
    const errorMessage = zodError.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return { success: false, error: errorMessage };
  }
  return { success: true, data: result.data };
}
