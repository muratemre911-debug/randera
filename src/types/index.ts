export interface Tenant {
  id: string;
  name: string;
  slug: string;
  sector: string;
  cover_image_url: string | null;
  profile_image_url: string | null;
  address: string | null;
  description: string | null;
  province: string | null;
  district: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  full_name: string | null;
  phone: string | null;
  role: "owner" | "staff" | "customer";
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  customer_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  custom_fields: {
    customer_name: string;
    note: string;
    phone: string;
  };
  created_at: string;
  updated_at: string;
  services?: Service;
  profiles?: Profile;
  customer_name?: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  tenant_id: string;
  endpoint: string;
  auth: string;
  p256dh: string;
  created_at: string;
}

export interface Sector {
  id: string;
  name: string;
  value: string;
  created_at: string;
}

export interface Post {
  id: string;
  tenant_id: string;
  image_url: string;
  description: string | null;
  created_at: string;
  like_count?: number;
  comment_count?: number;
  user_has_liked?: boolean;
  tenant?: Pick<Tenant, "id" | "name" | "profile_image_url">;
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  text: string;
  created_at: string;
  avatar_url?: string | null;
}

export interface DashboardStats {
  dailyRevenue: number;
  pendingAppointments: number;
  newCustomers: number;
  nextAppointment: Appointment | null;
}

export interface CreateTenantRequest {
  tenantName: string;
  fullName: string;
  sector: string;
  email: string;
  password: string;
}

export interface BookAppointmentRequest {
  tenant_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  note?: string;
}

export interface SendNotificationRequest {
  title: string;
  message: string;
  targetType: "all" | "sector" | "single";
  targetValue?: string;
}

export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  sentCount?: number;
}

export interface User {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
  };
}