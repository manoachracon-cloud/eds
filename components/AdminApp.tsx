"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NotificationCenter from "@/components/NotificationCenter";
import SystemStatus from "@/components/SystemStatus";
import { DemoBadge, EmptyState, PremiumNotice } from "@/components/ui/Polish";
import { canAccessSection, canManageSecurity, getDefaultSection, roleLabels, type AdminRole } from "@/lib/permissions";

type AdminSection =
  | "dashboard"
  | "planning"
  | "bookings"
  | "requests"
  | "services"
  | "employees"
  | "resources"
  | "aquasport"
  | "hours"
  | "clients"
  | "gift_cards"
  | "analytics"
  | "notifications"
  | "system"
  | "security"
  | "settings";

type PeriodFilter = "all" | "today" | "7d" | "30d" | "month";

type ServiceForm = {
  id?: string;
  name: string;
  slug: string;
  category_id: string;
  short_description: string;
  long_description: string;
  duration_minutes: number;
  price_euros: number;
  service_type: "individual" | "collective" | "gift_card";
  capacity_max: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  payment_mode: "pay_on_site" | "deposit_required" | "full_payment_required";
  deposit_euros: number;
  image_url: string;
  contraindications: string;
  is_featured: boolean;
  is_active: boolean;
  employee_ids: string[];
};

const emptyServiceForm: ServiceForm = {
  name: "",
  slug: "",
  category_id: "",
  short_description: "",
  long_description: "",
  duration_minutes: 45,
  price_euros: 0,
  service_type: "individual",
  capacity_max: 1,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  payment_mode: "pay_on_site",
  deposit_euros: 0,
  image_url: "",
  contraindications: "",
  is_featured: false,
  is_active: true,
  employee_ids: []
};

type EmployeeForm = {
  id?: string;
  first_name: string;
  last_name: string;
  role_title: string;
  bio: string;
  photo_url: string;
  google_calendar_id: string;
  is_bookable: boolean;
  is_active: boolean;
  service_ids: string[];
};

const emptyEmployeeForm: EmployeeForm = {
  first_name: "",
  last_name: "",
  role_title: "",
  bio: "",
  photo_url: "",
  google_calendar_id: "",
  is_bookable: true,
  is_active: true,
  service_ids: []
};

type EmployeeWorkingHourForm = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
};

const dayLabels = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

type BusinessHourForm = {
  day_of_week: number;
  opening_time: string;
  closing_time: string;
  is_closed: boolean;
};

type BusinessBreakForm = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string;
  is_active: boolean;
};

type BusinessClosureForm = {
  title: string;
  start_at: string;
  end_at: string;
  scope: "all" | "esthetic" | "aquasport";
  reason: string;
  is_active: boolean;
};

const defaultBusinessHours: BusinessHourForm[] = [
  { day_of_week: 0, opening_time: "09:00", closing_time: "13:00", is_closed: false },
  { day_of_week: 1, opening_time: "09:00", closing_time: "18:00", is_closed: false },
  { day_of_week: 2, opening_time: "09:00", closing_time: "18:00", is_closed: false },
  { day_of_week: 3, opening_time: "09:00", closing_time: "18:00", is_closed: false },
  { day_of_week: 4, opening_time: "09:00", closing_time: "18:00", is_closed: false },
  { day_of_week: 5, opening_time: "09:00", closing_time: "18:00", is_closed: false },
  { day_of_week: 6, opening_time: "09:00", closing_time: "13:00", is_closed: true }
];

const emptyBusinessBreakForm: BusinessBreakForm = {
  day_of_week: 1,
  start_time: "12:00",
  end_time: "13:00",
  label: "Pause déjeuner",
  is_active: true
};

const emptyBusinessClosureForm: BusinessClosureForm = {
  title: "",
  start_at: "",
  end_at: "",
  scope: "all",
  reason: "",
  is_active: true
};

type ResourceForm = {
  id?: string;
  name: string;
  resource_type: "treatment_room" | "aquasport_pool" | "equipment" | "other";
  location: string;
  capacity: number;
  description: string;
  is_active: boolean;
  is_bookable: boolean;
  service_ids: string[];
};

const emptyResourceForm: ResourceForm = {
  name: "",
  resource_type: "treatment_room",
  location: "",
  capacity: 1,
  description: "",
  is_active: true,
  is_bookable: true,
  service_ids: []
};

type AquasportClassForm = {
  id?: string;
  service_id: string;
  coach_employee_id: string;
  resource_id: string;
  title: string;
  level: string;
  start_at: string;
  end_at: string;
  capacity_max: number;
  status: "open" | "full" | "closed" | "cancelled" | "done";
  registration_closes_at: string;
  instructions: string;
  internal_note: string;
};

const emptyAquasportClassForm: AquasportClassForm = {
  service_id: "",
  coach_employee_id: "",
  resource_id: "",
  title: "",
  level: "tous niveaux",
  start_at: "",
  end_at: "",
  capacity_max: 10,
  status: "open",
  registration_closes_at: "",
  instructions: "",
  internal_note: ""
};

const defaultEmployeeWorkingHours: EmployeeWorkingHourForm[] = [
  { day_of_week: 0, start_time: "09:00", end_time: "13:00", is_closed: true },
  { day_of_week: 1, start_time: "09:00", end_time: "18:00", is_closed: false },
  { day_of_week: 2, start_time: "09:00", end_time: "18:00", is_closed: false },
  { day_of_week: 3, start_time: "09:00", end_time: "18:00", is_closed: false },
  { day_of_week: 4, start_time: "09:00", end_time: "18:00", is_closed: false },
  { day_of_week: 5, start_time: "09:00", end_time: "18:00", is_closed: false },
  { day_of_week: 6, start_time: "09:00", end_time: "13:00", is_closed: true }
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function money(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format((cents || 0) / 100);
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function dateOnlyLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "America/Guadeloupe"
  }).format(new Date(value));
}

function statusBadge(status: string) {
  const map: Record<string, [string, string]> = {
    confirmed: ["Confirmé", "success"],
    pending: ["En attente", "warning"],
    cancelled: ["Annulé", "danger"],
    done: ["Terminé", "dark"],
    no_show: ["Absent", "danger"],
    rescheduled: ["Reporté", "warning"],
    paid: ["Payé", "success"],
    unpaid: ["Non payé", "warning"],
    partially_paid: ["Partiel", "warning"],
    failed: ["Échec", "danger"],
    active: ["Active", "success"],
    used: ["Utilisée", "dark"],
    expired: ["Expirée", "danger"]
  };

  const [label, tone] = map[status] || [status, "dark"];
  return <span className={`badge ${tone}`}>{label}</span>;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    alert("Aucune donnée à exporter.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };

  const csv = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(";"))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function filterByPeriod<T extends { start_at?: string; created_at?: string }>(
  rows: T[],
  period: PeriodFilter,
  field: "start_at" | "created_at" = "start_at"
) {
  if (period === "all") return rows;

  const now = new Date();
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  }

  if (period === "7d") {
    start.setDate(now.getDate() - 7);
  }

  if (period === "30d") {
    start.setDate(now.getDate() - 30);
  }

  if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return rows.filter((row) => {
    const value = row[field];
    if (!value) return false;
    return new Date(value).getTime() >= start.getTime();
  });
}

export default function AdminApp() {
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<any | null>(null);
  const [currentProfile, setCurrentProfile] = useState<any | null>(null);
  const [profileError, setProfileError] = useState("");
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [bookings, setBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeServices, setEmployeeServices] = useState<any[]>([]);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyServiceForm);
  const [serviceFormMode, setServiceFormMode] = useState<"create" | "edit">("create");
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceMessage, setServiceMessage] = useState("");
  const [serviceError, setServiceError] = useState("");

  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyEmployeeForm);
  const [employeeFormMode, setEmployeeFormMode] = useState<"create" | "edit">("create");
  const [employeeWorkingHours, setEmployeeWorkingHours] = useState<EmployeeWorkingHourForm[]>(defaultEmployeeWorkingHours);
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [employeeError, setEmployeeError] = useState("");
  const [timeOffEmployeeId, setTimeOffEmployeeId] = useState("");
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("");

  const [businessHours, setBusinessHours] = useState<BusinessHourForm[]>(defaultBusinessHours);
  const [businessBreaks, setBusinessBreaks] = useState<any[]>([]);
  const [businessClosures, setBusinessClosures] = useState<any[]>([]);
  const [businessBreakForm, setBusinessBreakForm] = useState<BusinessBreakForm>(emptyBusinessBreakForm);
  const [businessClosureForm, setBusinessClosureForm] = useState<BusinessClosureForm>(emptyBusinessClosureForm);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursMessage, setHoursMessage] = useState("");
  const [hoursError, setHoursError] = useState("");

  const [resources, setResources] = useState<any[]>([]);
  const [resourceServices, setResourceServices] = useState<any[]>([]);
  const [resourceTimeOffRows, setResourceTimeOffRows] = useState<any[]>([]);
  const [resourceForm, setResourceForm] = useState<ResourceForm>(emptyResourceForm);
  const [resourceFormMode, setResourceFormMode] = useState<"create" | "edit">("create");
  const [resourceSaving, setResourceSaving] = useState(false);
  const [resourceMessage, setResourceMessage] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [resourceTimeOffId, setResourceTimeOffId] = useState("");
  const [resourceTimeOffStart, setResourceTimeOffStart] = useState("");
  const [resourceTimeOffEnd, setResourceTimeOffEnd] = useState("");
  const [resourceTimeOffReason, setResourceTimeOffReason] = useState("");

  const [aquasportClasses, setAquasportClasses] = useState<any[]>([]);
  const [aquasportParticipants, setAquasportParticipants] = useState<any[]>([]);
  const [aquasportWaitlist, setAquasportWaitlist] = useState<any[]>([]);
  const [aquasportForm, setAquasportForm] = useState<AquasportClassForm>(emptyAquasportClassForm);
  const [aquasportFormMode, setAquasportFormMode] = useState<"create" | "edit">("create");
  const [aquasportSaving, setAquasportSaving] = useState(false);
  const [aquasportMessage, setAquasportMessage] = useState("");
  const [aquasportError, setAquasportError] = useState("");

  const [clients, setClients] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [employeeWorkingHoursRows, setEmployeeWorkingHoursRows] = useState<any[]>([]);
  const [employeeTimeOffRows, setEmployeeTimeOffRows] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setSessionReady(true);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadCurrentProfile();
      loadAdminData();
    } else {
      setCurrentProfile(null);
    }
  }, [session]);

  const currentRole = (currentProfile?.role || null) as AdminRole | null;
  const currentRoleLabel = currentRole ? roleLabels[currentRole] : "Non défini";

  async function loadCurrentProfile() {
    setProfileError("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setCurrentProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id,role,first_name,last_name,is_active")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      setProfileError(error.message);
      setCurrentProfile(null);
      return;
    }

    if (!data || !data.is_active) {
      setProfileError("Compte interne introuvable ou inactif.");
      setCurrentProfile(null);
      return;
    }

    setCurrentProfile(data);
    const defaultSection = getDefaultSection(data.role as AdminRole) as AdminSection;

    if (!canAccessSection(data.role as AdminRole, section)) {
      setSection(defaultSection);
    }
  }

  function goToSection(nextSection: AdminSection) {
    if (!currentRole || !canAccessSection(currentRole, nextSection)) {
      setSection(getDefaultSection(currentRole) as AdminSection);
      return;
    }

    setSection(nextSection);
  }

  async function signIn() {
    setAuthError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setAuthError(error.message);
    }
  }

  async function adminFetch(url: string, init: RequestInit = {}) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    return fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setBookings([]);
    setServices([]);
    setClients([]);
    setChangeRequests([]);
    setGiftCards([]);
    setRedemptions([]);
    setPayments([]);
    setEmployeeWorkingHoursRows([]);
    setEmployeeTimeOffRows([]);
    setBusinessBreaks([]);
    setBusinessClosures([]);
    setResources([]);
    setResourceServices([]);
    setResourceTimeOffRows([]);
    setAquasportClasses([]);
    setAquasportParticipants([]);
    setAquasportWaitlist([]);
    setCurrentProfile(null);
  }

  async function loadAdminData() {
    setLoadingData(true);
    setDataError("");

    const [
      bookingsResult,
      servicesResult,
      clientsResult,
      requestsResult,
      giftCardsResult,
      redemptionsResult,
      paymentsResult,
      categoriesResult,
      employeesResult,
      employeeServicesResult,
      employeeWorkingHoursResult,
      employeeTimeOffResult,
      businessHoursResult,
      businessBreaksResult,
      businessClosuresResult,
      resourcesResult,
      resourceServicesResult,
      resourceTimeOffResult,
      aquasportClassesResult,
      aquasportParticipantsResult,
      aquasportWaitlistResult
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id,booking_reference,start_at,end_at,created_at,status,price_cents,payment_status,payment_amount_cents,payment_due_cents,gift_card_code,gift_card_amount_cents,client_comment,clients(id,first_name,last_name,phone,email),services(id,name,duration_minutes,price_cents,payment_mode,category:service_categories(name,slug)),employees(public_display_name,role_title),resources(name,resource_type)"
        )
        .order("start_at", { ascending: true }),
      supabase
        .from("services")
        .select("id,name,slug,category_id,short_description,long_description,duration_minutes,price_cents,service_type,capacity_max,buffer_before_minutes,buffer_after_minutes,payment_mode,deposit_cents,image_url,contraindications,is_featured,is_active,category:service_categories(name,slug)")
        .order("name", { ascending: true }),
      supabase
        .from("clients")
        .select("id,first_name,last_name,email,phone,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("booking_change_requests")
        .select("id,requested_date,requested_time,message,status,created_at,bookings(booking_reference,start_at,clients(first_name,last_name,phone,email),services(name))")
        .order("created_at", { ascending: false }),
      supabase
        .from("gift_cards")
        .select("id,code,buyer_name,buyer_email,recipient_name,recipient_email,amount_cents,balance_cents,currency,status,expires_at,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("gift_card_redemptions")
        .select("id,amount_cents,created_at,gift_cards(code),bookings(booking_reference),clients(first_name,last_name,email)")
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id,booking_id,amount_cents,currency,payment_provider,status,paid_at,created_at,bookings(booking_reference,clients(first_name,last_name,email),services(name))")
        .order("created_at", { ascending: false }),
      supabase
        .from("service_categories")
        .select("id,name,slug,description,display_order,is_active")
        .order("display_order", { ascending: true }),
      supabase
        .from("employees")
        .select("id,user_id,public_display_name,first_name,last_name,role_title,bio,photo_url,google_calendar_id,is_active,is_bookable,created_at")
        .order("first_name", { ascending: true }),
      supabase
        .from("employee_services")
        .select("employee_id,service_id"),
      supabase
        .from("employee_working_hours")
        .select("id,employee_id,day_of_week,start_time,end_time,is_closed")
        .order("day_of_week", { ascending: true }),
      supabase
        .from("employee_time_off")
        .select("id,employee_id,start_at,end_at,reason,created_at,employees(public_display_name,role_title),resources(name,resource_type)")
        .order("start_at", { ascending: false }),
      supabase
        .from("business_hours")
        .select("id,day_of_week,opening_time,closing_time,is_closed")
        .order("day_of_week", { ascending: true }),
      supabase
        .from("business_breaks")
        .select("id,day_of_week,start_time,end_time,label,is_active,created_at")
        .order("day_of_week", { ascending: true }),
      supabase
        .from("business_closures")
        .select("id,title,start_at,end_at,scope,reason,is_active,created_at")
        .order("start_at", { ascending: false }),
      supabase
        .from("resources")
        .select("id,name,resource_type,location,capacity,description,is_active,is_bookable,created_at")
        .order("name", { ascending: true }),
      supabase
        .from("resource_services")
        .select("resource_id,service_id"),
      supabase
        .from("resource_time_off")
        .select("id,resource_id,start_at,end_at,reason,created_at,resources(name,resource_type)")
        .order("start_at", { ascending: false }),
      supabase
        .from("aquasport_classes")
        .select("id,service_id,coach_employee_id,resource_id,title,level,start_at,end_at,capacity_max,registered_count,waitlist_count,status,registration_closes_at,instructions,internal_note,cancellation_reason,services(name,price_cents),employees(public_display_name,role_title),resources(name,resource_type)")
        .order("start_at", { ascending: true }),
      supabase
        .from("aquasport_participants")
        .select("id,aquasport_class_id,booking_id,client_id,attendance_status,health_notes,created_at,clients(first_name,last_name,email,phone),bookings(booking_reference,status)")
        .order("created_at", { ascending: true }),
      supabase
        .from("aquasport_waitlist")
        .select("id,aquasport_class_id,client_id,desired_level,health_notes,message,status,contacted_at,created_at,clients(first_name,last_name,email,phone)")
        .order("created_at", { ascending: true })
    ]);

    const error =
      bookingsResult.error ||
      servicesResult.error ||
      clientsResult.error ||
      requestsResult.error ||
      giftCardsResult.error ||
      redemptionsResult.error ||
      paymentsResult.error ||
      categoriesResult.error ||
      employeesResult.error ||
      employeeServicesResult.error ||
      employeeWorkingHoursResult.error ||
      employeeTimeOffResult.error ||
      businessHoursResult.error ||
      businessBreaksResult.error ||
      businessClosuresResult.error ||
      resourcesResult.error ||
      resourceServicesResult.error ||
      resourceTimeOffResult.error ||
      aquasportClassesResult.error ||
      aquasportParticipantsResult.error ||
      aquasportWaitlistResult.error;

    if (error) {
      setDataError(error.message || "Erreur lors du chargement admin.");
    } else {
      setBookings(bookingsResult.data || []);
      setServices(servicesResult.data || []);
      setClients(clientsResult.data || []);
      setChangeRequests(requestsResult.data || []);
      setGiftCards(giftCardsResult.data || []);
      setRedemptions(redemptionsResult.data || []);
      setPayments(paymentsResult.data || []);
      setCategories(categoriesResult.data || []);
      setEmployees(employeesResult.data || []);
      setEmployeeServices(employeeServicesResult.data || []);
      setEmployeeWorkingHoursRows(employeeWorkingHoursResult.data || []);
      setEmployeeTimeOffRows(employeeTimeOffResult.data || []);

      const loadedHours = defaultBusinessHours.map((defaultRow) => {
        const existing = (businessHoursResult.data || []).find((row: any) => row.day_of_week === defaultRow.day_of_week);
        return existing
          ? {
              day_of_week: existing.day_of_week,
              opening_time: existing.opening_time || defaultRow.opening_time,
              closing_time: existing.closing_time || defaultRow.closing_time,
              is_closed: Boolean(existing.is_closed)
            }
          : defaultRow;
      });

      setBusinessHours(loadedHours);
      setBusinessBreaks(businessBreaksResult.data || []);
      setBusinessClosures(businessClosuresResult.data || []);
      setResources(resourcesResult.data || []);
      setResourceServices(resourceServicesResult.data || []);
      setResourceTimeOffRows(resourceTimeOffResult.data || []);
      setAquasportClasses(aquasportClassesResult.data || []);
      setAquasportParticipants(aquasportParticipantsResult.data || []);
      setAquasportWaitlist(aquasportWaitlistResult.data || []);
    }

    setLoadingData(false);
  }

  async function updateBookingStatus(id: string, status: string) {
    const response = await adminFetch("/api/bookings/update-status", {
      method: "POST",
      body: JSON.stringify({
        bookingId: id,
        status
      })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      alert(result?.error || "Impossible de modifier le statut.");
      return;
    }

    await loadAdminData();
  }

  function resetServiceForm() {
    setServiceForm(emptyServiceForm);
    setServiceFormMode("create");
    setServiceMessage("");
    setServiceError("");
  }

  function updateServiceForm<K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) {
    setServiceForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" && serviceFormMode === "create"
        ? { slug: slugify(String(value)) }
        : {})
    }));
  }

  function toggleServiceEmployee(employeeId: string) {
    setServiceForm((current) => {
      const exists = current.employee_ids.includes(employeeId);
      return {
        ...current,
        employee_ids: exists
          ? current.employee_ids.filter((id) => id !== employeeId)
          : [...current.employee_ids, employeeId]
      };
    });
  }

  function editService(service: any) {
    const linkedEmployees = employeeServices
      .filter((row) => row.service_id === service.id)
      .map((row) => row.employee_id);

    setServiceFormMode("edit");
    setServiceMessage("");
    setServiceError("");
    setServiceForm({
      id: service.id,
      name: service.name || "",
      slug: service.slug || "",
      category_id: service.category_id || "",
      short_description: service.short_description || "",
      long_description: service.long_description || "",
      duration_minutes: service.duration_minutes || 45,
      price_euros: Number(service.price_cents || 0) / 100,
      service_type: service.service_type || "individual",
      capacity_max: service.capacity_max || 1,
      buffer_before_minutes: service.buffer_before_minutes || 0,
      buffer_after_minutes: service.buffer_after_minutes || 0,
      payment_mode: service.payment_mode || "pay_on_site",
      deposit_euros: Number(service.deposit_cents || 0) / 100,
      image_url: service.image_url || "",
      contraindications: service.contraindications || "",
      is_featured: Boolean(service.is_featured),
      is_active: Boolean(service.is_active),
      employee_ids: linkedEmployees
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateServiceForm() {
    if (!serviceForm.name.trim()) return "Le nom de la prestation est obligatoire.";
    if (!serviceForm.slug.trim()) return "Le slug est obligatoire.";
    if (!serviceForm.category_id) return "La catégorie est obligatoire.";
    if (!serviceForm.short_description.trim()) return "La description courte est obligatoire.";
    if (!serviceForm.duration_minutes || serviceForm.duration_minutes <= 0) return "La durée doit être supérieure à 0.";
    if (serviceForm.price_euros < 0) return "Le prix ne peut pas être négatif.";
    if (serviceForm.service_type === "collective" && serviceForm.capacity_max < 2) return "Une prestation collective doit avoir au moins 2 places.";
    if (serviceForm.payment_mode === "deposit_required" && serviceForm.deposit_euros <= 0) return "Un acompte doit être supérieur à 0 €.";
    return "";
  }

  async function saveService() {
    setServiceSaving(true);
    setServiceMessage("");
    setServiceError("");

    const validationError = validateServiceForm();

    if (validationError) {
      setServiceError(validationError);
      setServiceSaving(false);
      return;
    }

    const payload = {
      category_id: serviceForm.category_id,
      name: serviceForm.name.trim(),
      slug: slugify(serviceForm.slug || serviceForm.name),
      short_description: serviceForm.short_description.trim(),
      long_description: serviceForm.long_description.trim() || null,
      duration_minutes: Number(serviceForm.duration_minutes),
      price_cents: Math.round(Number(serviceForm.price_euros) * 100),
      service_type: serviceForm.service_type,
      capacity_max: serviceForm.service_type === "collective" ? Number(serviceForm.capacity_max) : 1,
      buffer_before_minutes: Number(serviceForm.buffer_before_minutes || 0),
      buffer_after_minutes: Number(serviceForm.buffer_after_minutes || 0),
      payment_mode: serviceForm.payment_mode,
      deposit_cents:
        serviceForm.payment_mode === "deposit_required"
          ? Math.round(Number(serviceForm.deposit_euros) * 100)
          : 0,
      image_url: serviceForm.image_url.trim() || null,
      contraindications: serviceForm.contraindications.trim() || null,
      is_featured: serviceForm.is_featured,
      is_active: serviceForm.is_active
    };

    let serviceId = serviceForm.id;

    if (serviceFormMode === "create") {
      const { data, error } = await supabase
        .from("services")
        .insert(payload)
        .select("id")
        .single();

      if (error || !data) {
        setServiceError(error?.message || "Impossible de créer la prestation.");
        setServiceSaving(false);
        return;
      }

      serviceId = data.id;
    } else {
      const { error } = await supabase
        .from("services")
        .update(payload)
        .eq("id", serviceForm.id);

      if (error) {
        setServiceError(error.message);
        setServiceSaving(false);
        return;
      }
    }

    if (serviceId) {
      const { error: deleteError } = await supabase
        .from("employee_services")
        .delete()
        .eq("service_id", serviceId);

      if (deleteError) {
        setServiceError(deleteError.message);
        setServiceSaving(false);
        return;
      }

      if (serviceForm.employee_ids.length > 0) {
        const rows = serviceForm.employee_ids.map((employeeId) => ({
          employee_id: employeeId,
          service_id: serviceId
        }));

        const { error: insertError } = await supabase.from("employee_services").insert(rows);

        if (insertError) {
          setServiceError(insertError.message);
          setServiceSaving(false);
          return;
        }
      }
    }

    setServiceSaving(false);
    setServiceMessage(serviceFormMode === "create" ? "Prestation créée." : "Prestation mise à jour.");
    resetServiceForm();
    await loadAdminData();
  }

  async function toggleServiceActive(service: any) {
    const { error } = await supabase
      .from("services")
      .update({ is_active: !service.is_active })
      .eq("id", service.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }



  function resetEmployeeForm() {
    setEmployeeForm(emptyEmployeeForm);
    setEmployeeFormMode("create");
    setEmployeeWorkingHours(defaultEmployeeWorkingHours);
    setEmployeeMessage("");
    setEmployeeError("");
  }

  function updateEmployeeForm<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) {
    setEmployeeForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function toggleEmployeeService(serviceId: string) {
    setEmployeeForm((current) => {
      const exists = current.service_ids.includes(serviceId);
      return {
        ...current,
        service_ids: exists
          ? current.service_ids.filter((id) => id !== serviceId)
          : [...current.service_ids, serviceId]
      };
    });
  }

  function updateWorkingHour(dayOfWeek: number, key: keyof EmployeeWorkingHourForm, value: any) {
    setEmployeeWorkingHours((current) =>
      current.map((row) =>
        row.day_of_week === dayOfWeek
          ? {
              ...row,
              [key]: value
            }
          : row
      )
    );
  }

  function editEmployee(employee: any) {
    const linkedServices = employeeServices
      .filter((row) => row.employee_id === employee.id)
      .map((row) => row.service_id);

    const existingHours = defaultEmployeeWorkingHours.map((defaultRow) => {
      const existing = employeeWorkingHoursRows.find(
        (row) => row.employee_id === employee.id && row.day_of_week === defaultRow.day_of_week
      );

      return existing
        ? {
            day_of_week: existing.day_of_week,
            start_time: existing.start_time || defaultRow.start_time,
            end_time: existing.end_time || defaultRow.end_time,
            is_closed: Boolean(existing.is_closed)
          }
        : defaultRow;
    });

    setEmployeeFormMode("edit");
    setEmployeeMessage("");
    setEmployeeError("");
    setEmployeeForm({
      id: employee.id,
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      role_title: employee.role_title || "",
      bio: employee.bio || "",
      photo_url: employee.photo_url || "",
      google_calendar_id: employee.google_calendar_id || "",
      is_bookable: Boolean(employee.is_bookable),
      is_active: Boolean(employee.is_active),
      service_ids: linkedServices
    });
    setEmployeeWorkingHours(existingHours);
    setTimeOffEmployeeId(employee.id);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateEmployeeForm() {
    if (!employeeForm.first_name.trim()) return "Le prénom est obligatoire.";
    if (!employeeForm.last_name.trim()) return "Le nom est obligatoire.";
    if (!employeeForm.role_title.trim()) return "Le rôle est obligatoire.";
    return "";
  }

  async function saveEmployee() {
    setEmployeeSaving(true);
    setEmployeeMessage("");
    setEmployeeError("");

    const validationError = validateEmployeeForm();

    if (validationError) {
      setEmployeeError(validationError);
      setEmployeeSaving(false);
      return;
    }

    const payload = {
      first_name: employeeForm.first_name.trim(),
      last_name: employeeForm.last_name.trim(),
      role_title: employeeForm.role_title.trim(),
      bio: employeeForm.bio.trim() || null,
      photo_url: employeeForm.photo_url.trim() || null,
      google_calendar_id: employeeForm.google_calendar_id.trim() || null,
      is_bookable: employeeForm.is_bookable,
      is_active: employeeForm.is_active
    };

    let employeeId = employeeForm.id;

    if (employeeFormMode === "create") {
      const { data, error } = await supabase
        .from("employees")
        .insert(payload)
        .select("id")
        .single();

      if (error || !data) {
        setEmployeeError(error?.message || "Impossible de créer l’employé.");
        setEmployeeSaving(false);
        return;
      }

      employeeId = data.id;
    } else {
      const { error } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", employeeForm.id);

      if (error) {
        setEmployeeError(error.message);
        setEmployeeSaving(false);
        return;
      }
    }

    if (employeeId) {
      const { error: deleteServicesError } = await supabase
        .from("employee_services")
        .delete()
        .eq("employee_id", employeeId);

      if (deleteServicesError) {
        setEmployeeError(deleteServicesError.message);
        setEmployeeSaving(false);
        return;
      }

      if (employeeForm.service_ids.length > 0) {
        const rows = employeeForm.service_ids.map((serviceId) => ({
          employee_id: employeeId,
          service_id: serviceId
        }));

        const { error: insertServicesError } = await supabase.from("employee_services").insert(rows);

        if (insertServicesError) {
          setEmployeeError(insertServicesError.message);
          setEmployeeSaving(false);
          return;
        }
      }

      await supabase.from("employee_working_hours").delete().eq("employee_id", employeeId);

      const workingRows = employeeWorkingHours.map((row) => ({
        employee_id: employeeId,
        day_of_week: row.day_of_week,
        start_time: row.is_closed ? null : row.start_time,
        end_time: row.is_closed ? null : row.end_time,
        is_closed: row.is_closed
      }));

      const { error: workingError } = await supabase.from("employee_working_hours").insert(workingRows);

      if (workingError) {
        setEmployeeError(workingError.message);
        setEmployeeSaving(false);
        return;
      }
    }

    setEmployeeSaving(false);
    setEmployeeMessage(employeeFormMode === "create" ? "Employé créé." : "Employé mis à jour.");
    resetEmployeeForm();
    await loadAdminData();
  }

  async function toggleEmployeeActive(employee: any) {
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !employee.is_active })
      .eq("id", employee.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }

  async function addEmployeeTimeOff() {
    setEmployeeError("");
    setEmployeeMessage("");

    if (!timeOffEmployeeId || !timeOffStart || !timeOffEnd) {
      setEmployeeError("Merci de choisir un employé, une date de début et une date de fin.");
      return;
    }

    if (new Date(timeOffEnd).getTime() <= new Date(timeOffStart).getTime()) {
      setEmployeeError("La date de fin doit être après la date de début.");
      return;
    }

    const { error } = await supabase.from("employee_time_off").insert({
      employee_id: timeOffEmployeeId,
      start_at: new Date(timeOffStart).toISOString(),
      end_at: new Date(timeOffEnd).toISOString(),
      reason: timeOffReason.trim() || null
    });

    if (error) {
      setEmployeeError(error.message);
      return;
    }

    setTimeOffStart("");
    setTimeOffEnd("");
    setTimeOffReason("");
    setEmployeeMessage("Indisponibilité ajoutée.");
    await loadAdminData();
  }

  async function deleteEmployeeTimeOff(id: string) {
    const { error } = await supabase.from("employee_time_off").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }


  function updateBusinessHour(dayOfWeek: number, key: keyof BusinessHourForm, value: any) {
    setBusinessHours((current) =>
      current.map((row) =>
        row.day_of_week === dayOfWeek
          ? {
              ...row,
              [key]: value
            }
          : row
      )
    );
  }

  async function saveBusinessHours() {
    setHoursSaving(true);
    setHoursError("");
    setHoursMessage("");

    const rows = businessHours.map((row) => ({
      day_of_week: row.day_of_week,
      opening_time: row.is_closed ? null : row.opening_time,
      closing_time: row.is_closed ? null : row.closing_time,
      is_closed: row.is_closed
    }));

    const { error } = await supabase
      .from("business_hours")
      .upsert(rows, { onConflict: "day_of_week" });

    setHoursSaving(false);

    if (error) {
      setHoursError(error.message);
      return;
    }

    setHoursMessage("Horaires d’ouverture mis à jour.");
    await loadAdminData();
  }

  async function addBusinessBreak() {
    setHoursError("");
    setHoursMessage("");

    if (!businessBreakForm.start_time || !businessBreakForm.end_time) {
      setHoursError("Merci de renseigner le début et la fin de la pause.");
      return;
    }

    if (businessBreakForm.end_time <= businessBreakForm.start_time) {
      setHoursError("La fin de la pause doit être après le début.");
      return;
    }

    const { error } = await supabase.from("business_breaks").insert({
      day_of_week: businessBreakForm.day_of_week,
      start_time: businessBreakForm.start_time,
      end_time: businessBreakForm.end_time,
      label: businessBreakForm.label || null,
      is_active: businessBreakForm.is_active
    });

    if (error) {
      setHoursError(error.message);
      return;
    }

    setBusinessBreakForm(emptyBusinessBreakForm);
    setHoursMessage("Pause ajoutée.");
    await loadAdminData();
  }

  async function toggleBusinessBreak(row: any) {
    const { error } = await supabase
      .from("business_breaks")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }

  async function deleteBusinessBreak(id: string) {
    const { error } = await supabase.from("business_breaks").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }

  async function addBusinessClosure() {
    setHoursError("");
    setHoursMessage("");

    if (!businessClosureForm.title || !businessClosureForm.start_at || !businessClosureForm.end_at) {
      setHoursError("Merci de renseigner un titre, un début et une fin.");
      return;
    }

    if (new Date(businessClosureForm.end_at).getTime() <= new Date(businessClosureForm.start_at).getTime()) {
      setHoursError("La fin doit être après le début.");
      return;
    }

    const { error } = await supabase.from("business_closures").insert({
      title: businessClosureForm.title.trim(),
      start_at: new Date(businessClosureForm.start_at).toISOString(),
      end_at: new Date(businessClosureForm.end_at).toISOString(),
      scope: businessClosureForm.scope,
      reason: businessClosureForm.reason.trim() || null,
      is_active: businessClosureForm.is_active
    });

    if (error) {
      setHoursError(error.message);
      return;
    }

    setBusinessClosureForm(emptyBusinessClosureForm);
    setHoursMessage("Fermeture exceptionnelle ajoutée.");
    await loadAdminData();
  }

  async function toggleBusinessClosure(row: any) {
    const { error } = await supabase
      .from("business_closures")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }

  async function deleteBusinessClosure(id: string) {
    const { error } = await supabase.from("business_closures").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }


  function resetResourceForm() {
    setResourceForm(emptyResourceForm);
    setResourceFormMode("create");
    setResourceMessage("");
    setResourceError("");
  }

  function updateResourceForm<K extends keyof ResourceForm>(key: K, value: ResourceForm[K]) {
    setResourceForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function toggleResourceService(serviceId: string) {
    setResourceForm((current) => {
      const exists = current.service_ids.includes(serviceId);
      return {
        ...current,
        service_ids: exists
          ? current.service_ids.filter((id) => id !== serviceId)
          : [...current.service_ids, serviceId]
      };
    });
  }

  function editResource(resource: any) {
    const linkedServices = resourceServices
      .filter((row) => row.resource_id === resource.id)
      .map((row) => row.service_id);

    setResourceFormMode("edit");
    setResourceMessage("");
    setResourceError("");
    setResourceForm({
      id: resource.id,
      name: resource.name || "",
      resource_type: resource.resource_type || "treatment_room",
      location: resource.location || "",
      capacity: resource.capacity || 1,
      description: resource.description || "",
      is_active: Boolean(resource.is_active),
      is_bookable: Boolean(resource.is_bookable),
      service_ids: linkedServices
    });
    setResourceTimeOffId(resource.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateResourceForm() {
    if (!resourceForm.name.trim()) return "Le nom de la ressource est obligatoire.";
    if (!resourceForm.capacity || resourceForm.capacity < 1) return "La capacité doit être supérieure ou égale à 1.";
    return "";
  }

  async function saveResource() {
    setResourceSaving(true);
    setResourceMessage("");
    setResourceError("");

    const validationError = validateResourceForm();

    if (validationError) {
      setResourceError(validationError);
      setResourceSaving(false);
      return;
    }

    const payload = {
      name: resourceForm.name.trim(),
      resource_type: resourceForm.resource_type,
      location: resourceForm.location.trim() || null,
      capacity: Number(resourceForm.capacity),
      description: resourceForm.description.trim() || null,
      is_active: resourceForm.is_active,
      is_bookable: resourceForm.is_bookable
    };

    let resourceId = resourceForm.id;

    if (resourceFormMode === "create") {
      const { data, error } = await supabase.from("resources").insert(payload).select("id").single();

      if (error || !data) {
        setResourceError(error?.message || "Impossible de créer la ressource.");
        setResourceSaving(false);
        return;
      }

      resourceId = data.id;
    } else {
      const { error } = await supabase.from("resources").update(payload).eq("id", resourceForm.id);

      if (error) {
        setResourceError(error.message);
        setResourceSaving(false);
        return;
      }
    }

    if (resourceId) {
      const { error: deleteError } = await supabase
        .from("resource_services")
        .delete()
        .eq("resource_id", resourceId);

      if (deleteError) {
        setResourceError(deleteError.message);
        setResourceSaving(false);
        return;
      }

      if (resourceForm.service_ids.length > 0) {
        const rows = resourceForm.service_ids.map((serviceId) => ({
          resource_id: resourceId,
          service_id: serviceId
        }));

        const { error: insertError } = await supabase.from("resource_services").insert(rows);

        if (insertError) {
          setResourceError(insertError.message);
          setResourceSaving(false);
          return;
        }
      }
    }

    setResourceSaving(false);
    setResourceMessage(resourceFormMode === "create" ? "Ressource créée." : "Ressource mise à jour.");
    resetResourceForm();
    await loadAdminData();
  }

  async function toggleResourceActive(resource: any) {
    const { error } = await supabase
      .from("resources")
      .update({ is_active: !resource.is_active })
      .eq("id", resource.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }

  async function addResourceTimeOff() {
    setResourceError("");
    setResourceMessage("");

    if (!resourceTimeOffId || !resourceTimeOffStart || !resourceTimeOffEnd) {
      setResourceError("Merci de choisir une ressource, une date de début et une date de fin.");
      return;
    }

    if (new Date(resourceTimeOffEnd).getTime() <= new Date(resourceTimeOffStart).getTime()) {
      setResourceError("La date de fin doit être après la date de début.");
      return;
    }

    const { error } = await supabase.from("resource_time_off").insert({
      resource_id: resourceTimeOffId,
      start_at: new Date(resourceTimeOffStart).toISOString(),
      end_at: new Date(resourceTimeOffEnd).toISOString(),
      reason: resourceTimeOffReason.trim() || null
    });

    if (error) {
      setResourceError(error.message);
      return;
    }

    setResourceTimeOffStart("");
    setResourceTimeOffEnd("");
    setResourceTimeOffReason("");
    setResourceMessage("Indisponibilité ressource ajoutée.");
    await loadAdminData();
  }

  async function deleteResourceTimeOff(id: string) {
    const { error } = await supabase.from("resource_time_off").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdminData();
  }


  const aquasportServices = useMemo(() => {
    return services.filter((service) => {
      const categoryName = service.category?.name?.toLowerCase() || "";
      const categorySlug = service.category?.slug?.toLowerCase() || "";
      const name = service.name?.toLowerCase() || "";
      return categoryName.includes("aqua") || categorySlug.includes("aqua") || name.includes("aqua");
    });
  }, [services]);

  const aquasportCoaches = useMemo(() => {
    return employees.filter((employee) => {
      const role = employee.role_title?.toLowerCase() || "";
      return role.includes("coach") || role.includes("aqua") || employee.is_bookable;
    });
  }, [employees]);

  const aquasportResources = useMemo(() => {
    return resources.filter((resource) => {
      return ["aquasport_pool", "equipment", "other"].includes(resource.resource_type);
    });
  }, [resources]);

  function resetAquasportForm() {
    setAquasportForm(emptyAquasportClassForm);
    setAquasportFormMode("create");
    setAquasportMessage("");
    setAquasportError("");
  }

  function updateAquasportForm<K extends keyof AquasportClassForm>(key: K, value: AquasportClassForm[K]) {
    setAquasportForm((current) => ({ ...current, [key]: value }));
  }

  function editAquasportClass(classItem: any) {
    setAquasportFormMode("edit");
    setAquasportMessage("");
    setAquasportError("");
    setAquasportForm({
      id: classItem.id,
      service_id: classItem.service_id || "",
      coach_employee_id: classItem.coach_employee_id || "",
      resource_id: classItem.resource_id || "",
      title: classItem.title || "",
      level: classItem.level || "tous niveaux",
      start_at: classItem.start_at ? classItem.start_at.slice(0, 16) : "",
      end_at: classItem.end_at ? classItem.end_at.slice(0, 16) : "",
      capacity_max: classItem.capacity_max || 10,
      status: classItem.status || "open",
      registration_closes_at: classItem.registration_closes_at ? classItem.registration_closes_at.slice(0, 16) : "",
      instructions: classItem.instructions || "",
      internal_note: classItem.internal_note || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateAquasportForm() {
    if (!aquasportForm.service_id) return "La prestation Aqua-sports est obligatoire.";
    if (!aquasportForm.coach_employee_id) return "Le coach est obligatoire.";
    if (!aquasportForm.title.trim()) return "Le titre de la séance est obligatoire.";
    if (!aquasportForm.start_at || !aquasportForm.end_at) return "Le début et la fin sont obligatoires.";
    if (new Date(aquasportForm.end_at).getTime() <= new Date(aquasportForm.start_at).getTime()) {
      return "La fin doit être après le début.";
    }
    if (!aquasportForm.capacity_max || aquasportForm.capacity_max < 1) return "La capacité doit être supérieure à 0.";
    return "";
  }

  async function saveAquasportClass() {
    setAquasportSaving(true);
    setAquasportMessage("");
    setAquasportError("");

    const validationError = validateAquasportForm();

    if (validationError) {
      setAquasportError(validationError);
      setAquasportSaving(false);
      return;
    }

    const payload = {
      service_id: aquasportForm.service_id,
      coach_employee_id: aquasportForm.coach_employee_id,
      resource_id: aquasportForm.resource_id || null,
      title: aquasportForm.title.trim(),
      level: aquasportForm.level.trim() || "tous niveaux",
      start_at: new Date(aquasportForm.start_at).toISOString(),
      end_at: new Date(aquasportForm.end_at).toISOString(),
      capacity_max: Number(aquasportForm.capacity_max),
      status: aquasportForm.status,
      registration_closes_at: aquasportForm.registration_closes_at
        ? new Date(aquasportForm.registration_closes_at).toISOString()
        : null,
      instructions: aquasportForm.instructions.trim() || null,
      internal_note: aquasportForm.internal_note.trim() || null
    };

    if (aquasportFormMode === "create") {
      const { error } = await supabase.from("aquasport_classes").insert(payload);

      if (error) {
        setAquasportError(error.message);
        setAquasportSaving(false);
        return;
      }
    } else {
      const response = await adminFetch("/api/aquasport/update-class", {
        method: "POST",
        body: JSON.stringify({
          classId: aquasportForm.id,
          payload
        })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setAquasportError(result?.error || "Impossible de modifier la séance.");
        setAquasportSaving(false);
        return;
      }
    }

    setAquasportSaving(false);
    setAquasportMessage(aquasportFormMode === "create" ? "Séance créée." : "Séance mise à jour.");
    resetAquasportForm();
    await loadAdminData();
  }

  async function updateAquasportClassStatus(classId: string, status: string, reason?: string) {
    const payload: any = { status };

    if (status === "cancelled") {
      payload.cancellation_reason = reason || "Séance annulée par l’équipe";
    }

    const response = await adminFetch("/api/aquasport/update-class", {
      method: "POST",
      body: JSON.stringify({
        classId,
        payload,
        reason
      })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      alert(result?.error || "Impossible de modifier la séance.");
      return;
    }

    await loadAdminData();
  }

  async function updateAttendance(participantId: string, classId: string, attendanceStatus: string) {
    const response = await adminFetch("/api/aquasport/update-attendance", {
      method: "POST",
      body: JSON.stringify({
        participantId,
        classId,
        attendanceStatus
      })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      alert(result?.error || "Impossible de modifier la présence.");
      return;
    }

    await loadAdminData();
  }

  async function updateWaitlistStatus(waitlistId: string, classId: string, status: string) {
    const payload: any = { status };

    if (status === "contacted") {
      payload.contacted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("aquasport_waitlist")
      .update(payload)
      .eq("id", waitlistId);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.rpc("sync_aquasport_class_counts", { p_class_id: classId });
    await loadAdminData();
  }

  const filteredBookings = useMemo(() => filterByPeriod(bookings, period, "start_at"), [bookings, period]);
  const filteredGiftCards = useMemo(() => filterByPeriod(giftCards, period, "created_at"), [giftCards, period]);
  const filteredRedemptions = useMemo(() => filterByPeriod(redemptions, period, "created_at"), [redemptions, period]);
  const filteredPayments = useMemo(() => filterByPeriod(payments, period, "created_at"), [payments, period]);
  const filteredClients = useMemo(() => filterByPeriod(clients, period, "created_at"), [clients, period]);

  const analytics = useMemo(() => {
    const activeBookings = filteredBookings.filter((booking) => booking.status !== "cancelled");
    const cancelledBookings = filteredBookings.filter((booking) => booking.status === "cancelled");
    const doneBookings = filteredBookings.filter((booking) => booking.status === "done");
    const noShowBookings = filteredBookings.filter((booking) => booking.status === "no_show");
    const paidBookings = filteredBookings.filter((booking) => booking.payment_status === "paid");
    const partiallyPaidBookings = filteredBookings.filter((booking) => booking.payment_status === "partially_paid");

    const estimatedRevenue = activeBookings.reduce((sum, booking) => sum + Number(booking.price_cents || 0), 0);
    const paidRevenue = filteredPayments
      .filter((payment) => payment.status === "paid")
      .reduce((sum, payment) => sum + Number(payment.amount_cents || 0), 0);

    const giftCardSold = filteredGiftCards
      .filter((card) => card.status !== "cancelled")
      .reduce((sum, card) => sum + Number(card.amount_cents || 0), 0);

    const giftCardUsed = filteredRedemptions.reduce((sum, redemption) => sum + Number(redemption.amount_cents || 0), 0);

    const aquasportBookings = filteredBookings.filter((booking) => {
      const serviceName = booking.services?.name?.toLowerCase() || "";
      const categoryName = booking.services?.category?.name?.toLowerCase() || "";
      return serviceName.includes("aqua") || categoryName.includes("aqua");
    });

    const serviceCounts = new Map<string, { name: string; count: number; revenue: number }>();
    filteredBookings.forEach((booking) => {
      const serviceName = booking.services?.name || "Non renseigné";
      const current = serviceCounts.get(serviceName) || { name: serviceName, count: 0, revenue: 0 };
      current.count += 1;
      if (booking.status !== "cancelled") {
        current.revenue += Number(booking.price_cents || 0);
      }
      serviceCounts.set(serviceName, current);
    });

    const topServices = Array.from(serviceCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const recurringClients = new Map<string, number>();
    filteredBookings.forEach((booking) => {
      const email = booking.clients?.email;
      if (!email) return;
      recurringClients.set(email, (recurringClients.get(email) || 0) + 1);
    });

    const recurringClientCount = Array.from(recurringClients.values()).filter((count) => count >= 2).length;

    return {
      totalBookings: filteredBookings.length,
      activeBookings: activeBookings.length,
      cancelledBookings: cancelledBookings.length,
      doneBookings: doneBookings.length,
      noShowBookings: noShowBookings.length,
      paidBookings: paidBookings.length,
      partiallyPaidBookings: partiallyPaidBookings.length,
      estimatedRevenue,
      paidRevenue,
      giftCardSold,
      giftCardUsed,
      giftCardActiveBalance: giftCards
        .filter((card) => card.status === "active")
        .reduce((sum, card) => sum + Number(card.balance_cents || 0), 0),
      cancellationRate: filteredBookings.length ? Math.round((cancelledBookings.length / filteredBookings.length) * 100) : 0,
      noShowRate: filteredBookings.length ? Math.round((noShowBookings.length / filteredBookings.length) * 100) : 0,
      paymentRate: activeBookings.length ? Math.round((paidBookings.length / activeBookings.length) * 100) : 0,
      aquasportBookings: aquasportBookings.length,
      aquasportShare: filteredBookings.length ? Math.round((aquasportBookings.length / filteredBookings.length) * 100) : 0,
      newClients: filteredClients.length,
      recurringClientCount,
      topServices
    };
  }, [filteredBookings, filteredGiftCards, filteredRedemptions, filteredPayments, filteredClients, giftCards]);

  const revenue = analytics.estimatedRevenue;
  const todayCount = useMemo(() => {
    const today = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "America/Guadeloupe",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    return bookings.filter((booking) => booking.start_at?.slice(0, 10) === today).length;
  }, [bookings]);

  if (!sessionReady) {
    return (
      <main className="section">
        <div className="container">
          <div className="alert">Chargement de la session...</div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="section">
        <div className="container" style={{ maxWidth: 560 }}>
          <div className="card card-pad">
            <span className="badge">Admin sécurisé</span>
            <h1 className="page-title" style={{ marginTop: 16 }}>
              Connexion équipe
            </h1>
            <p className="section-desc">
              Connecte-toi avec un compte Supabase Auth ayant un profil interne dans
              <strong> user_profiles</strong>.
            </p>

            <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
              <label>
                <span>E-mail</span>
                <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                <span>Mot de passe</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </div>

            {authError && <div className="error">{authError}</div>}

            <button className="btn btn-primary" style={{ marginTop: 22, width: "100%" }} onClick={signIn}>
              Se connecter
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <DemoBadge />
      <header className="header">
        <div className="container nav">
          <a className="brand" href="/">
            <div className="brand-mark">◆</div>
            <div>
              <div className="brand-name">Esthetic Diamonds</div>
              <div className="brand-sub">Back-office réservation</div>
            </div>
          </a>
          <div className="nav-links">
            <a href="/">Retour public</a>
            <button onClick={loadAdminData}>Actualiser</button>
            <button onClick={signOut}>Déconnexion</button>
          </div>
        </div>
      </header>

      <main className="container admin-layout">
        <aside className="sidebar">
          <div className="admin-brand">
            <small>Back-office Supabase</small>
            <h2>Admin V1.20</h2>
            <p style={{ marginTop: 10, color: "rgba(255,255,255,.72)", lineHeight: 1.5 }}>
              {currentRoleLabel}
            </p>
          </div>
          {[
            ["dashboard", "Tableau de bord"],
            ["planning", "Planning"],
            ["bookings", "Réservations"],
            ["requests", "Demandes modification"],
            ["services", "Prestations"],
            ["employees", "Employés"],
            ["resources", "Ressources"],
            ["aquasport", "Aqua-sports"],
            ["hours", "Horaires"],
            ["clients", "Clients"],
            ["gift_cards", "Cartes cadeaux"],
            ["analytics", "Statistiques"],
            ["notifications", "Notifications"],
            ["system", "Statut production"],
            ["security", "Sécurité"],
            ["settings", "Paramètres"]
          ]
            .filter(([key]) => canAccessSection(currentRole, key))
            .map(([key, label]) => (
              <button
                key={key}
                className={`side-btn ${section === key ? "active" : ""}`}
                onClick={() => goToSection(key as AdminSection)}
              >
                {label}
              </button>
            ))}
        </aside>

        <section>
          {profileError && (
            <PremiumNotice type="error" title="Accès interne non configuré">
              {profileError}
            </PremiumNotice>
          )}

          {loadingData && (
            <PremiumNotice type="warning" title="Chargement des données admin">
              Les informations sont récupérées depuis Supabase. Les modules déjà visibles restent consultables.
            </PremiumNotice>
          )}
          {dataError && (
            <PremiumNotice type="error" title="Erreur de chargement admin">
              {dataError}
            </PremiumNotice>
          )}

          {section === "dashboard" && (
            <>
              <AdminHead
                eyebrow="Pilotage"
                title="Tableau de bord"
                description="Vue réelle issue des tables Supabase."
              />
              <div className="grid grid-4">
                <Metric label="Réservations" value={bookings.length.toString()} />
                <Metric label="Aujourd’hui" value={todayCount.toString()} />
                <Metric
                  label="Aqua-sports"
                  value={bookings
                    .filter((booking) => booking.services?.name?.toLowerCase().includes("aqua"))
                    .length.toString()}
                />
                <Metric label="Payés" value={bookings.filter((booking) => booking.payment_status === "paid").length.toString()} />
                <Metric label="CA estimé" value={money(revenue)} />
              </div>

              <div className="card card-pad" style={{ marginTop: 22 }}>
                <h2 style={{ fontSize: 28 }}>Prochaines réservations</h2>
                <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                  {bookings.slice(0, 6).map((booking) => (
                    <BookingMini key={booking.id} booking={booking} />
                  ))}
                  {bookings.length === 0 && (
                    <EmptyState
                      title="Aucune réservation pour le moment."
                      description="Les prochaines réservations apparaîtront ici dès que les clients utiliseront la plateforme."
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {section === "planning" && (
            <>
              <AdminHead
                eyebrow="Planning"
                title="Planning général"
                description="Liste chronologique des réservations enregistrées dans Supabase."
              />
              <div className="table">
                <div className="planning-row tr head">
                  <span>Heure</span>
                  <span>Rendez-vous</span>
                  <span>Employé</span>
                  <span>Statut</span>
                </div>
                {bookings.map((booking) => (
                  <div className="planning-row" key={booking.id}>
                    <strong>{dateTimeLabel(booking.start_at)}</strong>
                    <span>
                      <strong>{booking.services?.name}</strong>
                      <br />
                      <span className="muted">
                        {booking.clients?.first_name} {booking.clients?.last_name}
                        {booking.resources?.name ? ` · ${booking.resources.name}` : ""}
                      </span>
                    </span>
                    <span className="muted">
                      {booking.employees?.public_display_name || "Non assigné"}
                    </span>
                    {statusBadge(booking.status)}
                  </div>
                ))}
              </div>
            </>
          )}

          {section === "bookings" && (
            <>
              <AdminHead
                eyebrow="Opérations"
                title="Réservations"
                description="Modifier le statut d’une réservation déclenchera ensuite les modules Google Calendar et notifications."
              />
              <div className="table">
                <div className="tr head">
                  <span>Client</span>
                  <span>Prestation</span>
                  <span>Date</span>
                  <span>Statut</span>
                  <span>Actions</span>
                </div>
                {bookings.map((booking) => (
                  <div className="tr" key={booking.id}>
                    <div>
                      <strong>
                        {booking.clients?.first_name} {booking.clients?.last_name}
                      </strong>
                      <br />
                      <span className="muted">
                        {booking.clients?.phone}
                        <br />
                        {booking.clients?.email}
                      </span>
                    </div>
                    <div>
                      {booking.services?.name}
                      <br />
                      <span className="muted">
                        Paiement : {booking.payment_status || "unpaid"}
                        {booking.gift_card_amount_cents > 0 ? ` · Carte cadeau : -${money(booking.gift_card_amount_cents)}` : ""}
                      </span>
                    </div>
                    <div className="muted">{dateTimeLabel(booking.start_at)}</div>
                    <div>{statusBadge(booking.status)}</div>
                    <div>
                      <button
                        className="icon-btn success"
                        onClick={() => updateBookingStatus(booking.id, "confirmed")}
                      >
                        ✓
                      </button>
                      <button className="icon-btn" onClick={() => updateBookingStatus(booking.id, "done")}>
                        ●
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => updateBookingStatus(booking.id, "cancelled")}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {section === "requests" && (
            <>
              <AdminHead
                eyebrow="Demandes client"
                title="Demandes de modification"
                description="Les demandes sont à valider manuellement par l’équipe."
              />
              <div className="table">
                <div className="tr head">
                  <span>Client</span>
                  <span>Rendez-vous</span>
                  <span>Demande</span>
                  <span>Statut</span>
                  <span>Créée le</span>
                </div>
                {changeRequests.map((request) => (
                  <div className="tr" key={request.id}>
                    <div>
                      <strong>
                        {request.bookings?.clients?.first_name} {request.bookings?.clients?.last_name}
                      </strong>
                      <br />
                      <span className="muted">
                        {request.bookings?.clients?.phone}
                        <br />
                        {request.bookings?.clients?.email}
                      </span>
                    </div>
                    <div>
                      {request.bookings?.services?.name}
                      <br />
                      <span className="muted">{request.bookings?.booking_reference}</span>
                    </div>
                    <div className="muted">
                      {request.requested_date || "Date non précisée"}
                      <br />
                      {request.requested_time || "Heure non précisée"}
                      <br />
                      {request.message}
                    </div>
                    <div>{statusBadge(request.status)}</div>
                    <div className="muted">{dateTimeLabel(request.created_at)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {section === "services" && (
            <>
              <AdminHead
                eyebrow="Catalogue"
                title="Gestion des prestations"
                description="Créer, modifier, désactiver et configurer les prestations, les prix, les durées, les paiements et les employés associés."
              />

              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <span className="badge">{serviceFormMode === "create" ? "Nouvelle prestation" : "Modification"}</span>
                    <h2 style={{ fontSize: 34, marginTop: 14 }}>
                      {serviceFormMode === "create" ? "Créer une prestation" : `Modifier : ${serviceForm.name}`}
                    </h2>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Les changements sont enregistrés dans Supabase et visibles côté client si la prestation est active.
                    </p>
                  </div>
                  <button className="btn btn-light" onClick={resetServiceForm}>
                    Réinitialiser
                  </button>
                </div>

                {serviceError && <div className="error">{serviceError}</div>}
                {serviceMessage && <div className="success-box">{serviceMessage}</div>}

                <div className="form-grid" style={{ marginTop: 22 }}>
                  <label>
                    <span>Nom de la prestation</span>
                    <input
                      className="input"
                      value={serviceForm.name}
                      onChange={(event) => updateServiceForm("name", event.target.value)}
                      placeholder="Exemple : Massage relaxant"
                    />
                  </label>
                  <label>
                    <span>Slug URL</span>
                    <input
                      className="input"
                      value={serviceForm.slug}
                      onChange={(event) => updateServiceForm("slug", slugify(event.target.value))}
                      placeholder="massage-relaxant"
                    />
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Catégorie</span>
                    <select
                      className="select"
                      value={serviceForm.category_id}
                      onChange={(event) => updateServiceForm("category_id", event.target.value)}
                    >
                      <option value="">Sélectionner une catégorie</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Type de prestation</span>
                    <select
                      className="select"
                      value={serviceForm.service_type}
                      onChange={(event) =>
                        updateServiceForm("service_type", event.target.value as ServiceForm["service_type"])
                      }
                    >
                      <option value="individual">Individuelle</option>
                      <option value="collective">Collective</option>
                      <option value="gift_card">Carte cadeau / coffret</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 16 }}>
                  <span>Description courte</span>
                  <input
                    className="input"
                    value={serviceForm.short_description}
                    onChange={(event) => updateServiceForm("short_description", event.target.value)}
                    placeholder="Description visible sur les cartes prestations"
                  />
                </label>

                <label style={{ display: "block", marginTop: 16 }}>
                  <span>Description longue</span>
                  <textarea
                    value={serviceForm.long_description}
                    onChange={(event) => updateServiceForm("long_description", event.target.value)}
                    placeholder="Description détaillée optionnelle"
                  />
                </label>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Durée en minutes</span>
                    <input
                      className="input"
                      type="number"
                      min="5"
                      value={serviceForm.duration_minutes}
                      onChange={(event) => updateServiceForm("duration_minutes", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>Prix en euros</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={serviceForm.price_euros}
                      onChange={(event) => updateServiceForm("price_euros", Number(event.target.value))}
                    />
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Capacité maximale</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={serviceForm.capacity_max}
                      onChange={(event) => updateServiceForm("capacity_max", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>Image URL</span>
                    <input
                      className="input"
                      value={serviceForm.image_url}
                      onChange={(event) => updateServiceForm("image_url", event.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Buffer avant en minutes</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={serviceForm.buffer_before_minutes}
                      onChange={(event) => updateServiceForm("buffer_before_minutes", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>Buffer après en minutes</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={serviceForm.buffer_after_minutes}
                      onChange={(event) => updateServiceForm("buffer_after_minutes", Number(event.target.value))}
                    />
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Mode de paiement</span>
                    <select
                      className="select"
                      value={serviceForm.payment_mode}
                      onChange={(event) =>
                        updateServiceForm("payment_mode", event.target.value as ServiceForm["payment_mode"])
                      }
                    >
                      <option value="pay_on_site">Paiement sur place</option>
                      <option value="deposit_required">Acompte obligatoire</option>
                      <option value="full_payment_required">Paiement complet obligatoire</option>
                    </select>
                  </label>
                  <label>
                    <span>Acompte en euros</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={serviceForm.deposit_euros}
                      onChange={(event) => updateServiceForm("deposit_euros", Number(event.target.value))}
                      disabled={serviceForm.payment_mode !== "deposit_required"}
                    />
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 16 }}>
                  <span>Contre-indications / informations importantes</span>
                  <textarea
                    value={serviceForm.contraindications}
                    onChange={(event) => updateServiceForm("contraindications", event.target.value)}
                    placeholder="Optionnel"
                  />
                </label>

                <div className="card card-pad" style={{ boxShadow: "none", marginTop: 18, background: "var(--soft)" }}>
                  <h3 style={{ fontSize: 24 }}>Employés associés</h3>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Seuls les employés associés pourront être proposés pour cette prestation.
                  </p>
                  <div className="grid grid-3" style={{ marginTop: 16 }}>
                    {employees.map((employee) => (
                      <label
                        key={employee.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          background: "white",
                          border: "1px solid var(--line)",
                          borderRadius: 18,
                          padding: 14
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={serviceForm.employee_ids.includes(employee.id)}
                          onChange={() => toggleServiceEmployee(employee.id)}
                        />
                        <span style={{ margin: 0 }}>
                          <strong>{employee.public_display_name}</strong>
                          <br />
                          <span className="muted">{employee.role_title}</span>
                        </span>
                      </label>
                    ))}
                    {employees.length === 0 && <p className="muted">Aucun employé disponible.</p>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={serviceForm.is_featured}
                      onChange={(event) => updateServiceForm("is_featured", event.target.checked)}
                    />
                    <span style={{ margin: 0 }}>Mettre en avant</span>
                  </label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={serviceForm.is_active}
                      onChange={(event) => updateServiceForm("is_active", event.target.checked)}
                    />
                    <span style={{ margin: 0 }}>Active côté client</span>
                  </label>
                </div>

                <div className="actions">
                  <button className="btn btn-light" onClick={resetServiceForm}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" disabled={serviceSaving} onClick={saveService}>
                    {serviceSaving
                      ? "Enregistrement..."
                      : serviceFormMode === "create"
                        ? "Créer la prestation"
                        : "Enregistrer les modifications"}
                  </button>
                </div>
              </div>

              <div className="grid grid-2">
                {services.map((service) => (
                  <div className="card card-pad" key={service.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                      <div>
                        <h3 style={{ fontSize: 28 }}>{service.name}</h3>
                        <p className="muted" style={{ marginTop: 8 }}>
                          {service.category?.name || "Sans catégorie"} · {service.duration_minutes} min · {money(service.price_cents)}
                        </p>
                      </div>
                      <span className={`badge ${service.is_active ? "success" : "danger"}`}>
                        {service.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <p className="muted" style={{ marginTop: 14 }}>
                      {service.short_description}
                    </p>
                    <div className="summary-grid" style={{ marginTop: 16 }}>
                      <div className="summary-item">
                        <small>Type</small>
                        <strong>{service.service_type}</strong>
                      </div>
                      <div className="summary-item">
                        <small>Paiement</small>
                        <strong>{service.payment_mode}</strong>
                      </div>
                      <div className="summary-item">
                        <small>Capacité</small>
                        <strong>{service.capacity_max}</strong>
                      </div>
                      <div className="summary-item">
                        <small>Mise en avant</small>
                        <strong>{service.is_featured ? "Oui" : "Non"}</strong>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                      <button className="btn btn-light" onClick={() => editService(service)}>
                        Modifier
                      </button>
                      <button className={service.is_active ? "btn btn-danger" : "btn btn-primary"} onClick={() => toggleServiceActive(service)}>
                        {service.is_active ? "Désactiver" : "Activer"}
                      </button>
                    </div>
                  </div>
                ))}
                {services.length === 0 && (
                  <EmptyState
                    title="Aucune prestation configurée."
                    description="Créez votre première prestation pour alimenter le catalogue client."
                  />
                )}
              </div>
            </>
          )}

          {section === "employees" && (
            <>
              <AdminHead
                eyebrow="Équipe"
                title="Gestion des employés"
                description="Créer, modifier et configurer les employés, leurs prestations, horaires, congés et calendriers Google."
              />

              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <span className="badge">{employeeFormMode === "create" ? "Nouvel employé" : "Modification"}</span>
                    <h2 style={{ fontSize: 34, marginTop: 14 }}>
                      {employeeFormMode === "create"
                        ? "Créer un employé"
                        : `Modifier : ${employeeForm.first_name} ${employeeForm.last_name}`}
                    </h2>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Les employés actifs et réservables peuvent apparaître dans le tunnel de réservation.
                    </p>
                  </div>
                  <button className="btn btn-light" onClick={resetEmployeeForm}>
                    Réinitialiser
                  </button>
                </div>

                {employeeError && <div className="error">{employeeError}</div>}
                {employeeMessage && <div className="success-box">{employeeMessage}</div>}

                <div className="form-grid" style={{ marginTop: 22 }}>
                  <label>
                    <span>Prénom</span>
                    <input
                      className="input"
                      value={employeeForm.first_name}
                      onChange={(event) => updateEmployeeForm("first_name", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Nom</span>
                    <input
                      className="input"
                      value={employeeForm.last_name}
                      onChange={(event) => updateEmployeeForm("last_name", event.target.value)}
                    />
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Rôle / intitulé</span>
                    <input
                      className="input"
                      value={employeeForm.role_title}
                      onChange={(event) => updateEmployeeForm("role_title", event.target.value)}
                      placeholder="Exemple : Esthéticienne, Coach Aqua-sports"
                    />
                  </label>
                  <label>
                    <span>Google Calendar ID</span>
                    <input
                      className="input"
                      value={employeeForm.google_calendar_id}
                      onChange={(event) => updateEmployeeForm("google_calendar_id", event.target.value)}
                      placeholder="Optionnel : calendrier employé"
                    />
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Photo URL</span>
                    <input
                      className="input"
                      value={employeeForm.photo_url}
                      onChange={(event) => updateEmployeeForm("photo_url", event.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                  <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={employeeForm.is_active}
                        onChange={(event) => updateEmployeeForm("is_active", event.target.checked)}
                      />
                      <span style={{ margin: 0 }}>Employé actif</span>
                    </label>
                    <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={employeeForm.is_bookable}
                        onChange={(event) => updateEmployeeForm("is_bookable", event.target.checked)}
                      />
                      <span style={{ margin: 0 }}>Réservable en ligne</span>
                    </label>
                  </div>
                </div>

                <label style={{ display: "block", marginTop: 16 }}>
                  <span>Bio / note interne courte</span>
                  <textarea
                    value={employeeForm.bio}
                    onChange={(event) => updateEmployeeForm("bio", event.target.value)}
                    placeholder="Optionnel"
                  />
                </label>

                <div className="card card-pad" style={{ boxShadow: "none", marginTop: 18, background: "var(--soft)" }}>
                  <h3 style={{ fontSize: 24 }}>Prestations réalisables</h3>
                  <p className="muted" style={{ marginTop: 6 }}>
                    L’employé ne sera proposé que sur les prestations cochées.
                  </p>
                  <div className="grid grid-3" style={{ marginTop: 16 }}>
                    {services.map((service) => (
                      <label
                        key={service.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          background: "white",
                          border: "1px solid var(--line)",
                          borderRadius: 18,
                          padding: 14
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={employeeForm.service_ids.includes(service.id)}
                          onChange={() => toggleEmployeeService(service.id)}
                        />
                        <span style={{ margin: 0 }}>
                          <strong>{service.name}</strong>
                          <br />
                          <span className="muted">{service.category?.name || "Sans catégorie"}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="card card-pad" style={{ boxShadow: "none", marginTop: 18, background: "var(--soft)" }}>
                  <h3 style={{ fontSize: 24 }}>Horaires hebdomadaires</h3>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Ces horaires servent de base pour les disponibilités de l’employé.
                  </p>
                  <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                    {employeeWorkingHours.map((row) => (
                      <div
                        key={row.day_of_week}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 140px 140px 120px",
                          gap: 10,
                          alignItems: "center",
                          background: "white",
                          border: "1px solid var(--line)",
                          borderRadius: 18,
                          padding: 12
                        }}
                      >
                        <strong>{dayLabels[row.day_of_week]}</strong>
                        <input
                          className="input"
                          type="time"
                          value={row.start_time}
                          disabled={row.is_closed}
                          onChange={(event) => updateWorkingHour(row.day_of_week, "start_time", event.target.value)}
                        />
                        <input
                          className="input"
                          type="time"
                          value={row.end_time}
                          disabled={row.is_closed}
                          onChange={(event) => updateWorkingHour(row.day_of_week, "end_time", event.target.value)}
                        />
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={row.is_closed}
                            onChange={(event) => updateWorkingHour(row.day_of_week, "is_closed", event.target.checked)}
                          />
                          <span style={{ margin: 0 }}>Fermé</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="actions">
                  <button className="btn btn-light" onClick={resetEmployeeForm}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" disabled={employeeSaving} onClick={saveEmployee}>
                    {employeeSaving
                      ? "Enregistrement..."
                      : employeeFormMode === "create"
                        ? "Créer l’employé"
                        : "Enregistrer les modifications"}
                  </button>
                </div>
              </div>

              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 30 }}>Ajouter une indisponibilité</h2>
                <p className="muted" style={{ marginTop: 8 }}>
                  Congés, absence, fermeture exceptionnelle ou indisponibilité ponctuelle.
                </p>
                <div className="form-grid" style={{ marginTop: 18 }}>
                  <label>
                    <span>Employé</span>
                    <select className="select" value={timeOffEmployeeId} onChange={(event) => setTimeOffEmployeeId(event.target.value)}>
                      <option value="">Sélectionner un employé</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.public_display_name} · {employee.role_title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Raison</span>
                    <input
                      className="input"
                      value={timeOffReason}
                      onChange={(event) => setTimeOffReason(event.target.value)}
                      placeholder="Congé, formation, absence..."
                    />
                  </label>
                </div>
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Début</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={timeOffStart}
                      onChange={(event) => setTimeOffStart(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Fin</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={timeOffEnd}
                      onChange={(event) => setTimeOffEnd(event.target.value)}
                    />
                  </label>
                </div>
                <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={addEmployeeTimeOff}>
                  Ajouter l’indisponibilité
                </button>
              </div>

              <div className="grid grid-2">
                {employees.length === 0 && (
                  <EmptyState
                    title="Aucun employé configuré."
                    description="Créez les profils de l’équipe pour activer l’attribution et les plannings."
                  />
                )}
                {employees.map((employee) => {
                  const linkedServices = employeeServices
                    .filter((row) => row.employee_id === employee.id)
                    .map((row) => services.find((service) => service.id === row.service_id)?.name)
                    .filter(Boolean);

                  const timeOffs = employeeTimeOffRows.filter((row) => row.employee_id === employee.id);

                  return (
                    <div className="card card-pad" key={employee.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <h3 style={{ fontSize: 28 }}>{employee.public_display_name}</h3>
                          <p className="muted" style={{ marginTop: 8 }}>{employee.role_title}</p>
                        </div>
                        <span className={`badge ${employee.is_active ? "success" : "danger"}`}>
                          {employee.is_active ? "Actif" : "Inactif"}
                        </span>
                      </div>

                      <div className="summary-grid" style={{ marginTop: 16 }}>
                        <div className="summary-item">
                          <small>Réservable</small>
                          <strong>{employee.is_bookable ? "Oui" : "Non"}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Prestations</small>
                          <strong>{linkedServices.length}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Calendrier Google</small>
                          <strong>{employee.google_calendar_id ? "Configuré" : "Global"}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Indisponibilités</small>
                          <strong>{timeOffs.length}</strong>
                        </div>
                      </div>

                      {linkedServices.length > 0 && (
                        <p className="muted" style={{ marginTop: 14 }}>
                          {linkedServices.slice(0, 5).join(", ")}
                          {linkedServices.length > 5 ? "..." : ""}
                        </p>
                      )}

                      {timeOffs.length > 0 && (
                        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                          {timeOffs.slice(0, 3).map((timeOff) => (
                            <div key={timeOff.id} className="summary-item">
                              <small>{timeOff.reason || "Indisponibilité"}</small>
                              <strong style={{ fontSize: 14 }}>
                                {dateTimeLabel(timeOff.start_at)} → {dateTimeLabel(timeOff.end_at)}
                              </strong>
                              <button
                                className="btn btn-danger"
                                style={{ marginTop: 10, padding: "8px 12px" }}
                                onClick={() => deleteEmployeeTimeOff(timeOff.id)}
                              >
                                Supprimer
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                        <button className="btn btn-light" onClick={() => editEmployee(employee)}>
                          Modifier
                        </button>
                        <button className={employee.is_active ? "btn btn-danger" : "btn btn-primary"} onClick={() => toggleEmployeeActive(employee)}>
                          {employee.is_active ? "Désactiver" : "Activer"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {section === "resources" && (
            <>
              <AdminHead
                eyebrow="Ressources physiques"
                title="Cabines, bassin & équipements"
                description="Gérer les ressources nécessaires aux prestations : cabines, bassin Aqua-sports, équipements et indisponibilités."
              />

              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <span className="badge">{resourceFormMode === "create" ? "Nouvelle ressource" : "Modification"}</span>
                    <h2 style={{ fontSize: 34, marginTop: 14 }}>
                      {resourceFormMode === "create" ? "Créer une ressource" : `Modifier : ${resourceForm.name}`}
                    </h2>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Une prestation liée à une ressource ne sera réservable que si au moins une ressource compatible est disponible.
                    </p>
                  </div>
                  <button className="btn btn-light" onClick={resetResourceForm}>
                    Réinitialiser
                  </button>
                </div>

                {resourceError && <div className="error">{resourceError}</div>}
                {resourceMessage && <div className="success-box">{resourceMessage}</div>}

                <div className="form-grid" style={{ marginTop: 22 }}>
                  <label>
                    <span>Nom de la ressource</span>
                    <input
                      className="input"
                      value={resourceForm.name}
                      onChange={(event) => updateResourceForm("name", event.target.value)}
                      placeholder="Exemple : Cabine soin 1"
                    />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      className="select"
                      value={resourceForm.resource_type}
                      onChange={(event) => updateResourceForm("resource_type", event.target.value as ResourceForm["resource_type"])}
                    >
                      <option value="treatment_room">Cabine de soin</option>
                      <option value="aquasport_pool">Bassin Aqua-sports</option>
                      <option value="equipment">Équipement</option>
                      <option value="other">Autre</option>
                    </select>
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Localisation</span>
                    <input
                      className="input"
                      value={resourceForm.location}
                      onChange={(event) => updateResourceForm("location", event.target.value)}
                      placeholder="Spa, espace Aqua, cabine..."
                    />
                  </label>
                  <label>
                    <span>Capacité</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={resourceForm.capacity}
                      onChange={(event) => updateResourceForm("capacity", Number(event.target.value))}
                    />
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 16 }}>
                  <span>Description</span>
                  <textarea
                    value={resourceForm.description}
                    onChange={(event) => updateResourceForm("description", event.target.value)}
                    placeholder="Optionnel"
                  />
                </label>

                <div className="card card-pad" style={{ boxShadow: "none", marginTop: 18, background: "var(--soft)" }}>
                  <h3 style={{ fontSize: 24 }}>Prestations compatibles</h3>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Liez la ressource aux prestations qui nécessitent cette cabine, ce bassin ou cet équipement.
                  </p>
                  <div className="grid grid-3" style={{ marginTop: 16 }}>
                    {services.map((service) => (
                      <label
                        key={service.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          background: "white",
                          border: "1px solid var(--line)",
                          borderRadius: 18,
                          padding: 14
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={resourceForm.service_ids.includes(service.id)}
                          onChange={() => toggleResourceService(service.id)}
                        />
                        <span style={{ margin: 0 }}>
                          <strong>{service.name}</strong>
                          <br />
                          <span className="muted">{service.category?.name || "Sans catégorie"}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={resourceForm.is_active}
                      onChange={(event) => updateResourceForm("is_active", event.target.checked)}
                    />
                    <span style={{ margin: 0 }}>Ressource active</span>
                  </label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={resourceForm.is_bookable}
                      onChange={(event) => updateResourceForm("is_bookable", event.target.checked)}
                    />
                    <span style={{ margin: 0 }}>Réservable</span>
                  </label>
                </div>

                <div className="actions">
                  <button className="btn btn-light" onClick={resetResourceForm}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" disabled={resourceSaving} onClick={saveResource}>
                    {resourceSaving
                      ? "Enregistrement..."
                      : resourceFormMode === "create"
                        ? "Créer la ressource"
                        : "Enregistrer les modifications"}
                  </button>
                </div>
              </div>

              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 30 }}>Ajouter une indisponibilité ressource</h2>
                <p className="muted" style={{ marginTop: 8 }}>
                  Maintenance bassin, cabine fermée, équipement indisponible.
                </p>
                <div className="form-grid" style={{ marginTop: 18 }}>
                  <label>
                    <span>Ressource</span>
                    <select className="select" value={resourceTimeOffId} onChange={(event) => setResourceTimeOffId(event.target.value)}>
                      <option value="">Sélectionner une ressource</option>
                      {resources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name} · {resource.resource_type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Raison</span>
                    <input
                      className="input"
                      value={resourceTimeOffReason}
                      onChange={(event) => setResourceTimeOffReason(event.target.value)}
                      placeholder="Maintenance, nettoyage, indisponibilité..."
                    />
                  </label>
                </div>
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Début</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={resourceTimeOffStart}
                      onChange={(event) => setResourceTimeOffStart(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Fin</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={resourceTimeOffEnd}
                      onChange={(event) => setResourceTimeOffEnd(event.target.value)}
                    />
                  </label>
                </div>
                <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={addResourceTimeOff}>
                  Ajouter l’indisponibilité
                </button>
              </div>

              <div className="grid grid-2">
                {resources.length === 0 && (
                  <EmptyState
                    title="Aucune ressource configurée."
                    description="Ajoutez les cabines, bassin ou équipements pour sécuriser les disponibilités."
                  />
                )}
                {resources.map((resource) => {
                  const linkedServices = resourceServices
                    .filter((row) => row.resource_id === resource.id)
                    .map((row) => services.find((service) => service.id === row.service_id)?.name)
                    .filter(Boolean);

                  const timeOffs = resourceTimeOffRows.filter((row) => row.resource_id === resource.id);

                  return (
                    <div className="card card-pad" key={resource.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <h3 style={{ fontSize: 28 }}>{resource.name}</h3>
                          <p className="muted" style={{ marginTop: 8 }}>
                            {resource.resource_type} · {resource.location || "Localisation non renseignée"}
                          </p>
                        </div>
                        <span className={`badge ${resource.is_active ? "success" : "danger"}`}>
                          {resource.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="summary-grid" style={{ marginTop: 16 }}>
                        <div className="summary-item">
                          <small>Réservable</small>
                          <strong>{resource.is_bookable ? "Oui" : "Non"}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Capacité</small>
                          <strong>{resource.capacity}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Prestations</small>
                          <strong>{linkedServices.length}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Indisponibilités</small>
                          <strong>{timeOffs.length}</strong>
                        </div>
                      </div>

                      {linkedServices.length > 0 && (
                        <p className="muted" style={{ marginTop: 14 }}>
                          {linkedServices.slice(0, 5).join(", ")}
                          {linkedServices.length > 5 ? "..." : ""}
                        </p>
                      )}

                      {timeOffs.length > 0 && (
                        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                          {timeOffs.slice(0, 3).map((timeOff) => (
                            <div key={timeOff.id} className="summary-item">
                              <small>{timeOff.reason || "Indisponibilité"}</small>
                              <strong style={{ fontSize: 14 }}>
                                {dateTimeLabel(timeOff.start_at)} → {dateTimeLabel(timeOff.end_at)}
                              </strong>
                              <button
                                className="btn btn-danger"
                                style={{ marginTop: 10, padding: "8px 12px" }}
                                onClick={() => deleteResourceTimeOff(timeOff.id)}
                              >
                                Supprimer
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                        <button className="btn btn-light" onClick={() => editResource(resource)}>
                          Modifier
                        </button>
                        <button className={resource.is_active ? "btn btn-danger" : "btn btn-primary"} onClick={() => toggleResourceActive(resource)}>
                          {resource.is_active ? "Désactiver" : "Activer"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {section === "aquasport" && (
            <>
              <AdminHead
                eyebrow="Cours collectifs"
                title="Gestion Aqua-sports"
                description="Créer les séances, suivre les participants, gérer la capacité, la liste d’attente et les présences."
              />

              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <span className="badge">{aquasportFormMode === "create" ? "Nouvelle séance" : "Modification"}</span>
                    <h2 style={{ fontSize: 34, marginTop: 14 }}>
                      {aquasportFormMode === "create" ? "Créer une séance Aqua-sports" : `Modifier : ${aquasportForm.title}`}
                    </h2>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Les séances ouvertes apparaissent côté client pour les activités Aqua-sports.
                    </p>
                  </div>
                  <button className="btn btn-light" onClick={resetAquasportForm}>
                    Réinitialiser
                  </button>
                </div>

                {aquasportError && <div className="error">{aquasportError}</div>}
                {aquasportMessage && <div className="success-box">{aquasportMessage}</div>}

                <div className="form-grid" style={{ marginTop: 22 }}>
                  <label>
                    <span>Prestation Aqua-sports</span>
                    <select className="select" value={aquasportForm.service_id} onChange={(event) => updateAquasportForm("service_id", event.target.value)}>
                      <option value="">Sélectionner</option>
                      {aquasportServices.map((service) => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Coach</span>
                    <select className="select" value={aquasportForm.coach_employee_id} onChange={(event) => updateAquasportForm("coach_employee_id", event.target.value)}>
                      <option value="">Sélectionner</option>
                      {aquasportCoaches.map((coach) => (
                        <option key={coach.id} value={coach.id}>{coach.public_display_name} · {coach.role_title}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Titre de la séance</span>
                    <input className="input" value={aquasportForm.title} onChange={(event) => updateAquasportForm("title", event.target.value)} placeholder="Exemple : Aqua Bike intensif" />
                  </label>
                  <label>
                    <span>Niveau</span>
                    <select className="select" value={aquasportForm.level} onChange={(event) => updateAquasportForm("level", event.target.value)}>
                      <option value="tous niveaux">Tous niveaux</option>
                      <option value="débutant">Débutant</option>
                      <option value="intermédiaire">Intermédiaire</option>
                      <option value="avancé">Avancé</option>
                    </select>
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Début</span>
                    <input className="input" type="datetime-local" value={aquasportForm.start_at} onChange={(event) => updateAquasportForm("start_at", event.target.value)} />
                  </label>
                  <label>
                    <span>Fin</span>
                    <input className="input" type="datetime-local" value={aquasportForm.end_at} onChange={(event) => updateAquasportForm("end_at", event.target.value)} />
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Capacité maximale</span>
                    <input className="input" type="number" min="1" value={aquasportForm.capacity_max} onChange={(event) => updateAquasportForm("capacity_max", Number(event.target.value))} />
                  </label>
                  <label>
                    <span>Ressource</span>
                    <select className="select" value={aquasportForm.resource_id} onChange={(event) => updateAquasportForm("resource_id", event.target.value)}>
                      <option value="">Aucune ressource spécifique</option>
                      {aquasportResources.map((resource) => (
                        <option key={resource.id} value={resource.id}>{resource.name} · {resource.resource_type}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span>Statut</span>
                    <select className="select" value={aquasportForm.status} onChange={(event) => updateAquasportForm("status", event.target.value as AquasportClassForm["status"])}>
                      <option value="open">Ouvert</option>
                      <option value="full">Complet</option>
                      <option value="closed">Inscriptions fermées</option>
                      <option value="cancelled">Annulé</option>
                      <option value="done">Terminé</option>
                    </select>
                  </label>
                  <label>
                    <span>Fermeture inscriptions</span>
                    <input className="input" type="datetime-local" value={aquasportForm.registration_closes_at} onChange={(event) => updateAquasportForm("registration_closes_at", event.target.value)} />
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 16 }}>
                  <span>Consignes client</span>
                  <textarea value={aquasportForm.instructions} onChange={(event) => updateAquasportForm("instructions", event.target.value)} placeholder="Tenue, arrivée, santé, niveau..." />
                </label>

                <label style={{ display: "block", marginTop: 16 }}>
                  <span>Note interne</span>
                  <textarea value={aquasportForm.internal_note} onChange={(event) => updateAquasportForm("internal_note", event.target.value)} placeholder="Visible uniquement par l’équipe" />
                </label>

                <div className="actions">
                  <button className="btn btn-light" onClick={resetAquasportForm}>Annuler</button>
                  <button className="btn btn-primary" disabled={aquasportSaving} onClick={saveAquasportClass}>
                    {aquasportSaving ? "Enregistrement..." : aquasportFormMode === "create" ? "Créer la séance" : "Enregistrer les modifications"}
                  </button>
                </div>
              </div>

              <div className="grid grid-2">
                {aquasportClasses.length === 0 && (
                  <EmptyState
                    title="Aucune séance Aqua-sports programmée."
                    description="Créez une séance pour permettre la réservation collective côté client."
                  />
                )}
                {aquasportClasses.map((classItem) => {
                  const participants = aquasportParticipants.filter((p) => p.aquasport_class_id === classItem.id);
                  const waiting = aquasportWaitlist.filter((w) => w.aquasport_class_id === classItem.id);
                  const remaining = Math.max(classItem.capacity_max - (classItem.registered_count || participants.length || 0), 0);

                  return (
                    <div className="card card-pad" key={classItem.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <h3 style={{ fontSize: 28 }}>{classItem.title}</h3>
                          <p className="muted" style={{ marginTop: 8 }}>
                            {dateTimeLabel(classItem.start_at)} → {dateTimeLabel(classItem.end_at)}
                            <br />
                            {classItem.services?.name} · {classItem.employees?.public_display_name || "Coach non assigné"}
                          </p>
                        </div>
                        {statusBadge(classItem.status)}
                      </div>

                      <div className="summary-grid" style={{ marginTop: 16 }}>
                        <div className="summary-item">
                          <small>Places</small>
                          <strong>{classItem.registered_count || participants.length}/{classItem.capacity_max}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Restantes</small>
                          <strong>{remaining}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Attente</small>
                          <strong>{classItem.waitlist_count || waiting.length}</strong>
                        </div>
                        <div className="summary-item">
                          <small>Niveau</small>
                          <strong>{classItem.level}</strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                        <button className="btn btn-light" onClick={() => editAquasportClass(classItem)}>Modifier</button>
                        <button className="btn btn-light" onClick={() => updateAquasportClassStatus(classItem.id, "closed")}>Fermer inscriptions</button>
                        <button className="btn btn-light" onClick={() => updateAquasportClassStatus(classItem.id, "open")}>Rouvrir</button>
                        <button
                          className="btn btn-danger"
                          onClick={() => {
                            const reason = window.prompt("Raison de l’annulation envoyée aux participants :", "Séance annulée par l’équipe");
                            if (reason !== null) updateAquasportClassStatus(classItem.id, "cancelled", reason);
                          }}
                        >
                          Annuler séance + notifier
                        </button>
                      </div>

                      <div style={{ marginTop: 22 }}>
                        <h4 style={{ margin: 0, fontSize: 18 }}>Participants</h4>
                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          {participants.length === 0 && <p className="muted">Aucun participant inscrit.</p>}
                          {participants.map((participant) => (
                            <div key={participant.id} className="summary-item">
                              <small>{participant.bookings?.booking_reference || "Réservation"}</small>
                              <strong>
                                {participant.clients?.first_name} {participant.clients?.last_name}
                              </strong>
                              <p className="muted" style={{ marginTop: 6 }}>
                                {participant.clients?.phone} · {participant.clients?.email}
                                <br />
                                Santé : {participant.health_notes || "RAS"}
                              </p>
                              <select
                                className="select"
                                style={{ marginTop: 10 }}
                                value={participant.attendance_status}
                                onChange={(event) => updateAttendance(participant.id, classItem.id, event.target.value)}
                              >
                                <option value="registered">Inscrit</option>
                                <option value="present">Présent</option>
                                <option value="absent">Absent</option>
                                <option value="cancelled">Annulé</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: 22 }}>
                        <h4 style={{ margin: 0, fontSize: 18 }}>Liste d’attente</h4>
                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          {waiting.length === 0 && <p className="muted">Aucune personne en attente.</p>}
                          {waiting.map((waiter) => (
                            <div key={waiter.id} className="summary-item">
                              <small>{waiter.status}</small>
                              <strong>
                                {waiter.clients?.first_name} {waiter.clients?.last_name}
                              </strong>
                              <p className="muted" style={{ marginTop: 6 }}>
                                {waiter.clients?.phone} · {waiter.clients?.email}
                                <br />
                                Niveau : {waiter.desired_level || "Non renseigné"}
                                <br />
                                {waiter.message || ""}
                              </p>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                <button className="btn btn-light" style={{ padding: "8px 12px" }} onClick={() => updateWaitlistStatus(waiter.id, classItem.id, "contacted")}>
                                  Marquer contacté
                                </button>
                                <button className="btn btn-danger" style={{ padding: "8px 12px" }} onClick={() => updateWaitlistStatus(waiter.id, classItem.id, "cancelled")}>
                                  Retirer
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {section === "hours" && (
            <>
              <AdminHead
                eyebrow="Disponibilités globales"
                title="Horaires & fermetures"
                description="Gérer les horaires d’ouverture de l’établissement, les pauses et les fermetures exceptionnelles."
              />

              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 32 }}>Horaires d’ouverture</h2>
                <p className="muted" style={{ marginTop: 8 }}>
                  Ces horaires servent de base globale. Les horaires employés peuvent ensuite restreindre leurs propres disponibilités.
                </p>

                {hoursError && <div className="error">{hoursError}</div>}
                {hoursMessage && <div className="success-box">{hoursMessage}</div>}

                <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                  {businessHours.map((row) => (
                    <div
                      key={row.day_of_week}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 150px 150px 130px",
                        gap: 10,
                        alignItems: "center",
                        background: "var(--soft)",
                        border: "1px solid var(--line)",
                        borderRadius: 18,
                        padding: 12
                      }}
                    >
                      <strong>{dayLabels[row.day_of_week]}</strong>
                      <input
                        className="input"
                        type="time"
                        value={row.opening_time}
                        disabled={row.is_closed}
                        onChange={(event) => updateBusinessHour(row.day_of_week, "opening_time", event.target.value)}
                      />
                      <input
                        className="input"
                        type="time"
                        value={row.closing_time}
                        disabled={row.is_closed}
                        onChange={(event) => updateBusinessHour(row.day_of_week, "closing_time", event.target.value)}
                      />
                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={row.is_closed}
                          onChange={(event) => updateBusinessHour(row.day_of_week, "is_closed", event.target.checked)}
                        />
                        <span style={{ margin: 0 }}>Fermé</span>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="actions">
                  <span />
                  <button className="btn btn-primary" disabled={hoursSaving} onClick={saveBusinessHours}>
                    {hoursSaving ? "Enregistrement..." : "Enregistrer les horaires"}
                  </button>
                </div>
              </div>

              <div className="grid grid-2" style={{ alignItems: "start" }}>
                <div className="card card-pad">
                  <h2 style={{ fontSize: 30 }}>Pauses globales</h2>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Exemple : pause déjeuner bloquant les créneaux sur tous les employés.
                  </p>

                  <div className="form-grid" style={{ marginTop: 18 }}>
                    <label>
                      <span>Jour</span>
                      <select
                        className="select"
                        value={businessBreakForm.day_of_week}
                        onChange={(event) => setBusinessBreakForm((current) => ({ ...current, day_of_week: Number(event.target.value) }))}
                      >
                        {dayLabels.map((label, index) => (
                          <option key={label} value={index}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Nom</span>
                      <input
                        className="input"
                        value={businessBreakForm.label}
                        onChange={(event) => setBusinessBreakForm((current) => ({ ...current, label: event.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="form-grid" style={{ marginTop: 16 }}>
                    <label>
                      <span>Début</span>
                      <input
                        className="input"
                        type="time"
                        value={businessBreakForm.start_time}
                        onChange={(event) => setBusinessBreakForm((current) => ({ ...current, start_time: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Fin</span>
                      <input
                        className="input"
                        type="time"
                        value={businessBreakForm.end_time}
                        onChange={(event) => setBusinessBreakForm((current) => ({ ...current, end_time: event.target.value }))}
                      />
                    </label>
                  </div>

                  <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
                    <input
                      type="checkbox"
                      checked={businessBreakForm.is_active}
                      onChange={(event) => setBusinessBreakForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />
                    <span style={{ margin: 0 }}>Pause active</span>
                  </label>

                  <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={addBusinessBreak}>
                    Ajouter la pause
                  </button>

                  <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
                    {businessBreaks.map((row) => (
                      <div key={row.id} className="summary-item">
                        <small>{dayLabels[row.day_of_week]} · {row.label || "Pause"}</small>
                        <strong>{row.start_time} → {row.end_time}</strong>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button className="btn btn-light" style={{ padding: "8px 12px" }} onClick={() => toggleBusinessBreak(row)}>
                            {row.is_active ? "Désactiver" : "Activer"}
                          </button>
                          <button className="btn btn-danger" style={{ padding: "8px 12px" }} onClick={() => deleteBusinessBreak(row.id)}>
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card card-pad">
                  <h2 style={{ fontSize: 30 }}>Fermeture exceptionnelle</h2>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Jours fériés, fermeture spa, fermeture Aqua-sports ou fermeture totale.
                  </p>

                  <label style={{ display: "block", marginTop: 18 }}>
                    <span>Titre</span>
                    <input
                      className="input"
                      value={businessClosureForm.title}
                      onChange={(event) => setBusinessClosureForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Exemple : Jour férié, maintenance bassin..."
                    />
                  </label>

                  <div className="form-grid" style={{ marginTop: 16 }}>
                    <label>
                      <span>Début</span>
                      <input
                        className="input"
                        type="datetime-local"
                        value={businessClosureForm.start_at}
                        onChange={(event) => setBusinessClosureForm((current) => ({ ...current, start_at: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Fin</span>
                      <input
                        className="input"
                        type="datetime-local"
                        value={businessClosureForm.end_at}
                        onChange={(event) => setBusinessClosureForm((current) => ({ ...current, end_at: event.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="form-grid" style={{ marginTop: 16 }}>
                    <label>
                      <span>Périmètre</span>
                      <select
                        className="select"
                        value={businessClosureForm.scope}
                        onChange={(event) => setBusinessClosureForm((current) => ({ ...current, scope: event.target.value as BusinessClosureForm["scope"] }))}
                      >
                        <option value="all">Tout l’établissement</option>
                        <option value="esthetic">Esthétique / Spa</option>
                        <option value="aquasport">Aqua-sports</option>
                      </select>
                    </label>
                    <label>
                      <span>Raison</span>
                      <input
                        className="input"
                        value={businessClosureForm.reason}
                        onChange={(event) => setBusinessClosureForm((current) => ({ ...current, reason: event.target.value }))}
                      />
                    </label>
                  </div>

                  <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
                    <input
                      type="checkbox"
                      checked={businessClosureForm.is_active}
                      onChange={(event) => setBusinessClosureForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />
                    <span style={{ margin: 0 }}>Fermeture active</span>
                  </label>

                  <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={addBusinessClosure}>
                    Ajouter la fermeture
                  </button>

                  <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
                    {businessClosures.map((row) => (
                      <div key={row.id} className="summary-item">
                        <small>{row.scope} · {row.is_active ? "active" : "inactive"}</small>
                        <strong>{row.title}</strong>
                        <p className="muted" style={{ marginTop: 8 }}>
                          {dateTimeLabel(row.start_at)} → {dateTimeLabel(row.end_at)}
                          <br />
                          {row.reason || "Aucune raison renseignée"}
                        </p>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button className="btn btn-light" style={{ padding: "8px 12px" }} onClick={() => toggleBusinessClosure(row)}>
                            {row.is_active ? "Désactiver" : "Activer"}
                          </button>
                          <button className="btn btn-danger" style={{ padding: "8px 12px" }} onClick={() => deleteBusinessClosure(row.id)}>
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {section === "clients" && (
            <>
              <AdminHead
                eyebrow="CRM simple"
                title="Clients"
                description="Clients créés via les réservations et les données Supabase."
              />
              <div className="grid grid-2">
                {clients.map((client) => {
                  const clientBookings = bookings.filter((booking) => booking.clients?.id === client.id);
                  return (
                    <div className="card card-pad" key={client.id}>
                      <h3 style={{ fontSize: 28 }}>
                        {client.first_name} {client.last_name}
                      </h3>
                      <p className="muted" style={{ marginTop: 10 }}>
                        {client.email}
                        <br />
                        {client.phone}
                      </p>
                      <span className="badge" style={{ marginTop: 14 }}>
                        {clientBookings.length} RDV
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {section === "gift_cards" && (
            <>
              <AdminHead
                eyebrow="Coffrets"
                title="Cartes cadeaux"
                description="Suivi des cartes cadeaux digitales achetées via Stripe."
              />
              <div className="table">
                <div className="tr head">
                  <span>Code</span>
                  <span>Acheteur</span>
                  <span>Bénéficiaire</span>
                  <span>Solde</span>
                  <span>Statut</span>
                </div>
                {giftCards.map((card) => (
                  <div className="tr" key={card.id}>
                    <div>
                      <strong>{card.code}</strong>
                      <br />
                      <span className="muted">{dateTimeLabel(card.created_at)}</span>
                    </div>
                    <div>
                      {card.buyer_name}
                      <br />
                      <span className="muted">{card.buyer_email}</span>
                    </div>
                    <div>
                      {card.recipient_name || "Non renseigné"}
                      <br />
                      <span className="muted">{card.recipient_email || "Non renseigné"}</span>
                    </div>
                    <div>
                      {money(card.balance_cents)} / {money(card.amount_cents)}
                    </div>
                    <div>{statusBadge(card.status)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {section === "analytics" && (
            <>
              <AdminHead
                eyebrow="Analyse"
                title="Statistiques avancées"
                description="Pilotage commercial, opérationnel, paiements, cartes cadeaux et export CSV."
              />

              <div className="card card-pad" style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: 28 }}>Période analysée</h2>
                    <p className="muted" style={{ marginTop: 6 }}>Filtre les réservations, paiements, cartes cadeaux et clients.</p>
                  </div>
                  <select className="select" style={{ maxWidth: 260 }} value={period} onChange={(event) => setPeriod(event.target.value as PeriodFilter)}>
                    <option value="today">Aujourd’hui</option>
                    <option value="7d">7 derniers jours</option>
                    <option value="30d">30 derniers jours</option>
                    <option value="month">Mois en cours</option>
                    <option value="all">Tout l’historique</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-4">
                <Metric label="Réservations" value={analytics.totalBookings.toString()} />
                <Metric label="CA estimé" value={money(analytics.estimatedRevenue)} />
                <Metric label="CA payé" value={money(analytics.paidRevenue)} />
                <Metric label="Taux paiement" value={`${analytics.paymentRate}%`} />
                <Metric label="Annulations" value={`${analytics.cancelledBookings} · ${analytics.cancellationRate}%`} />
                <Metric label="Absences" value={`${analytics.noShowBookings} · ${analytics.noShowRate}%`} />
                <Metric label="Aqua-sports" value={`${analytics.aquasportBookings} · ${analytics.aquasportShare}%`} />
                <Metric label="Nouveaux clients" value={analytics.newClients.toString()} />
                <Metric label="Clients récurrents" value={analytics.recurringClientCount.toString()} />
                <Metric label="Cartes vendues" value={money(analytics.giftCardSold)} />
                <Metric label="Cartes utilisées" value={money(analytics.giftCardUsed)} />
                <Metric label="Solde cartes actif" value={money(analytics.giftCardActiveBalance)} />
              </div>

              <div className="grid grid-2" style={{ marginTop: 22 }}>
                <div className="card card-pad">
                  <h2 style={{ fontSize: 28 }}>Prestations les plus réservées</h2>
                  <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                    {analytics.topServices.map((service) => {
                      const max = analytics.topServices[0]?.count || 1;
                      const percent = Math.max(8, Math.round((service.count / max) * 100));
                      return (
                        <div key={service.name}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <strong>{service.name}</strong>
                            <span className="muted">{service.count} RDV · {money(service.revenue)}</span>
                          </div>
                          <div style={{ height: 10, background: "var(--soft)", borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
                            <div style={{ width: `${percent}%`, height: "100%", background: "var(--aqua)" }} />
                          </div>
                        </div>
                      );
                    })}
                    {analytics.topServices.length === 0 && <p className="muted">Aucune donnée sur cette période.</p>}
                  </div>
                </div>

                <div className="card card-pad">
                  <h2 style={{ fontSize: 28 }}>Exports CSV</h2>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Exporte les données filtrées pour analyse, comptabilité ou reporting.
                  </p>
                  <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                    <button className="btn btn-light" onClick={() => downloadCsv("reservations-esthetic-diamonds.csv", filteredBookings.map((booking) => ({
                      reference: booking.booking_reference,
                      client: `${booking.clients?.first_name || ""} ${booking.clients?.last_name || ""}`,
                      email: booking.clients?.email || "",
                      telephone: booking.clients?.phone || "",
                      prestation: booking.services?.name || "",
                      date: booking.start_at,
                      statut: booking.status,
                      paiement: booking.payment_status || "",
                      prix_euros: Number(booking.price_cents || 0) / 100,
                      carte_cadeau_euros: Number(booking.gift_card_amount_cents || 0) / 100,
                      reste_a_payer_euros: Number(booking.payment_due_cents || 0) / 100
                    }))}>
                      Exporter les réservations
                    </button>
                    <button className="btn btn-light" onClick={() => downloadCsv("paiements-esthetic-diamonds.csv", filteredPayments.map((payment) => ({
                      reference: payment.bookings?.booking_reference || "",
                      client: `${payment.bookings?.clients?.first_name || ""} ${payment.bookings?.clients?.last_name || ""}`,
                      prestation: payment.bookings?.services?.name || "",
                      montant_euros: Number(payment.amount_cents || 0) / 100,
                      provider: payment.payment_provider,
                      statut: payment.status,
                      date_creation: payment.created_at,
                      date_paiement: payment.paid_at || ""
                    }))}>
                      Exporter les paiements
                    </button>
                    <button className="btn btn-light" onClick={() => downloadCsv("cartes-cadeaux-esthetic-diamonds.csv", filteredGiftCards.map((card) => ({
                      code: card.code,
                      acheteur: card.buyer_name,
                      email_acheteur: card.buyer_email,
                      beneficiaire: card.recipient_name || "",
                      email_beneficiaire: card.recipient_email || "",
                      montant_euros: Number(card.amount_cents || 0) / 100,
                      solde_euros: Number(card.balance_cents || 0) / 100,
                      statut: card.status,
                      expiration: card.expires_at || "",
                      creation: card.created_at
                    }))}>
                      Exporter les cartes cadeaux
                    </button>
                    <button className="btn btn-light" onClick={() => downloadCsv("clients-esthetic-diamonds.csv", clients.map((client) => ({
                      prenom: client.first_name,
                      nom: client.last_name,
                      email: client.email,
                      telephone: client.phone,
                      date_creation: client.created_at,
                      nombre_rdv: bookings.filter((booking) => booking.clients?.id === client.id).length
                    }))}>
                      Exporter les clients
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {section === "notifications" && <NotificationCenter />}

          {section === "system" && <SystemStatus />}

          {section === "security" && (
            <>
              <AdminHead
                eyebrow="Sécurité"
                title="Sécurité & permissions"
                description="Contrôle des rôles, des accès admin et des actions sensibles."
              />

              {!canManageSecurity(currentRole) && (
                <PremiumNotice type="error" title="Accès réservé au Super Admin">
                  Cette section est visible uniquement pour le rôle super_admin.
                </PremiumNotice>
              )}

              {canManageSecurity(currentRole) && (
                <div className="grid grid-2">
                  <div className="card card-pad">
                    <h2 style={{ fontSize: 30 }}>Rôle connecté</h2>
                    <p className="muted" style={{ marginTop: 10 }}>
                      Utilisateur : {currentProfile?.first_name} {currentProfile?.last_name}
                    </p>
                    <div className="summary-grid" style={{ marginTop: 18 }}>
                      <div className="summary-item">
                        <small>Rôle</small>
                        <strong>{currentRoleLabel}</strong>
                      </div>
                      <div className="summary-item">
                        <small>Statut</small>
                        <strong>{currentProfile?.is_active ? "Actif" : "Inactif"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="card card-pad">
                    <h2 style={{ fontSize: 30 }}>Règles actives</h2>
                    <p className="muted" style={{ marginTop: 10 }}>
                      Les routes sensibles exigent maintenant un token Supabase valide et un rôle autorisé.
                    </p>
                    <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                      <span className="badge success">API admin protégées</span>
                      <span className="badge success">Sections filtrées par rôle</span>
                      <span className="badge success">Audit logs actifs</span>
                      <span className="badge warning">Middleware : headers sécurité + garde admin</span>
                    </div>
                  </div>

                  <div className="card card-pad">
                    <h2 style={{ fontSize: 30 }}>Matrice des rôles</h2>
                    <div className="table" style={{ marginTop: 18 }}>
                      <div className="tr head">
                        <span>Rôle</span>
                        <span>Accès principal</span>
                        <span>Gestion</span>
                        <span>Notes</span>
                        <span>Risque</span>
                      </div>
                      {[
                        ["super_admin", "Tout", "Sécurité + paramètres", "Rôle propriétaire", "Élevé"],
                        ["admin", "Opérations complètes", "Catalogue + équipe", "Sans sécurité avancée", "Moyen"],
                        ["reception", "Planning + clients", "Réservations", "Accueil quotidien", "Modéré"],
                        ["employee_esthetic", "Planning + clients", "Suivi RDV", "Accès limité", "Faible"],
                        ["coach_aquasport", "Planning + Aqua-sports", "Présences", "Coach collectif", "Faible"]
                      ].map(([role, access, management, note, risk]) => (
                        <div className="tr" key={role}>
                          <strong>{role}</strong>
                          <span>{access}</span>
                          <span>{management}</span>
                          <span className="muted">{note}</span>
                          <span>{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card card-pad">
                    <h2 style={{ fontSize: 30 }}>Recommandations</h2>
                    <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                      <div className="summary-item">
                        <small>Mot de passe</small>
                        <strong>Activer MFA côté Supabase Auth si disponible.</strong>
                      </div>
                      <div className="summary-item">
                        <small>Service role</small>
                        <strong>Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY côté client.</strong>
                      </div>
                      <div className="summary-item">
                        <small>Employés</small>
                        <strong>Désactiver les comptes dès qu’ils quittent l’équipe.</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {section === "settings" && (
            <>
              <AdminHead
                eyebrow="Configuration"
                title="Paramètres V1"
                description="Socle technique prêt pour les prochaines intégrations."
              />
              <div className="grid grid-2">
                <SettingsCard title="Google Calendar" text="Création automatique d’événements + suppression à l’annulation." />
                <SettingsCard title="WhatsApp Business" text="Notification interne via WhatsApp Cloud API si les variables d’environnement sont configurées." />
                <SettingsCard title="E-mails" text="Confirmation client + notification interne + rappels 24h/2h via Resend." />
                <SettingsCard title="Lien client" text="Consultation, annulation sous délai et demande de modification via lien unique." />
                <SettingsCard title="Rappels automatiques" text="Route cron /api/cron/reminders pour rappels 24h et 2h." />
                <SettingsCard title="Paiement Stripe" text="Checkout Session, webhook, table payments et statut payment_status." />
                <SettingsCard title="Cartes cadeaux" text="Achat, suivi admin et utilisation du code dans le tunnel de réservation." />
                <SettingsCard title="Statistiques" text="Module V1.9 ajouté : KPI, performances, cartes cadeaux, paiements et exports CSV." />
                <SettingsCard title="Gestion prestations" text="Module V1.10 ajouté : création, modification, activation, paiement et association employés." />
                <SettingsCard title="Gestion employés" text="Module V1.11 ajouté : employés, prestations, horaires, congés et calendriers Google." />
                <SettingsCard title="Horaires & fermetures" text="Module V1.12 ajouté : horaires globaux, pauses, fermetures exceptionnelles et impact sur les disponibilités." />
                <SettingsCard title="Ressources physiques" text="Module V1.13 ajouté : cabines, bassin, équipements, associations prestations et anti-conflit ressources." />
                <SettingsCard title="Aqua-sports avancé" text="Module V1.14 ajouté : séances, participants, liste d’attente, présence et capacité." />
                <SettingsCard title="Notifications Aqua-sports" text="Module V1.15 ajouté : notifications groupées, annulation, modification et liste d’attente." />
                <SettingsCard title="Centre de notifications" text="Module V1.16 ajouté : notifications filtrables, erreurs, journal d’activité, lecture et exports CSV." />
                <SettingsCard title="Reprise d’erreur" text="Module V1.17 ajouté : relance e-mail, WhatsApp, Google Calendar et résolution manuelle." />
                <SettingsCard title="Production readiness" text="Module V1.18 ajouté : healthcheck, statut intégrations, checklist et variables obligatoires." />
                <SettingsCard title="Sécurité avancée" text="Module V1.20 ajouté : rôles, restrictions par section, routes admin protégées et middleware." />
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}

function AdminHead({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="section-desc">{description}</p>}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function BookingMini({ booking }: { booking: any }) {
  return (
    <div className="summary-item">
      <small>{dateTimeLabel(booking.start_at)}</small>
      <strong>
        {booking.clients?.first_name} {booking.clients?.last_name}
      </strong>
      <p className="muted" style={{ marginTop: 6 }}>
        {booking.services?.name}
      </p>
    </div>
  );
}

function SettingsCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="card card-pad">
      <h3 style={{ fontSize: 28 }}>{title}</h3>
      <p className="muted" style={{ marginTop: 10 }}>
        {text}
      </p>
    </div>
  );
}
