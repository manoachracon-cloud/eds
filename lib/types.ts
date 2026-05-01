export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
};

export type Service = {
  id: string;
  category_id?: string;
  name: string;
  slug: string;
  short_description: string;
  long_description?: string | null;
  duration_minutes: number;
  price_cents: number;
  service_type: "individual" | "collective" | "gift_card";
  capacity_max: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  payment_mode?: "pay_on_site" | "deposit_required" | "full_payment_required";
  deposit_cents?: number;
  image_url?: string | null;
  contraindications?: string | null;
  is_featured?: boolean;
  is_active?: boolean;
  display_order?: number;
  category?: ServiceCategory | null;
};

export type EmployeeOption = {
  id: string;
  public_display_name: string;
  role_title: string;
};

export type EmployeeServiceRow = {
  service_id: string;
  employees: EmployeeOption | null;
};

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "done"
  | "no_show"
  | "rescheduled";
