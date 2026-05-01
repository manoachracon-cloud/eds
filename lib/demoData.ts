import type { EmployeeServiceRow, Service, ServiceCategory } from "@/lib/types";

export const demoCategories: ServiceCategory[] = [
  {
    id: "demo-cat-visage",
    name: "Soins visage",
    slug: "soins-visage",
    description: "Soins premium pour l’éclat et la qualité de peau.",
    display_order: 1,
    is_active: true
  },
  {
    id: "demo-cat-corps",
    name: "Rituels spa",
    slug: "rituels-spa",
    description: "Expériences bien-être et massages.",
    display_order: 2,
    is_active: true
  },
  {
    id: "demo-cat-aqua",
    name: "Aqua-sports",
    slug: "aqua-sports",
    description: "Séances aquatiques collectives et sportives.",
    display_order: 3,
    is_active: true
  }
];

export const demoServices: Service[] = [
  {
    id: "demo-service-visage",
    category_id: "demo-cat-visage",
    name: "Soin visage éclat",
    slug: "soin-visage-eclat",
    short_description: "Un soin premium pour retrouver un teint plus lumineux et reposé.",
    long_description: "Nettoyage, détente, hydratation et éclat.",
    duration_minutes: 60,
    price_cents: 7500,
    service_type: "individual",
    capacity_max: 1,
    buffer_before_minutes: 0,
    buffer_after_minutes: 15,
    payment_mode: "pay_on_site",
    deposit_cents: 0,
    image_url: "https://www.estheticdiamonds.fr/ressources/images/Image-fx-1_3b15_lg.jpeg",
    contraindications: null,
    is_featured: true,
    is_active: true,
    display_order: 1,
    category: demoCategories[0]
  },
  {
    id: "demo-service-massage",
    category_id: "demo-cat-corps",
    name: "Massage californien",
    slug: "massage-californien",
    short_description: "Un moment de relaxation profond dans une ambiance spa haut de gamme.",
    long_description: "Massage relaxant, enveloppant et apaisant.",
    duration_minutes: 75,
    price_cents: 9500,
    service_type: "individual",
    capacity_max: 1,
    buffer_before_minutes: 0,
    buffer_after_minutes: 15,
    payment_mode: "deposit_required",
    deposit_cents: 2500,
    image_url: "https://www.estheticdiamonds.fr/ressources/images/Image-fx-1_3b15_lg.jpeg",
    contraindications: null,
    is_featured: true,
    is_active: true,
    display_order: 2,
    category: demoCategories[1]
  },
  {
    id: "demo-service-aquabike",
    category_id: "demo-cat-aqua",
    name: "Aqua Bike",
    slug: "aqua-bike",
    short_description: "Une séance dynamique en bassin pour tonifier le corps en douceur.",
    long_description: "Cours collectif Aqua Bike tous niveaux.",
    duration_minutes: 45,
    price_cents: 2500,
    service_type: "collective",
    capacity_max: 10,
    buffer_before_minutes: 0,
    buffer_after_minutes: 10,
    payment_mode: "full_payment_required",
    deposit_cents: 0,
    image_url: "https://www.estheticdiamonds.fr/ressources/images/Image-fx-1_3b15_lg.jpeg",
    contraindications: "Prévenir l’équipe en cas de problème de santé.",
    is_featured: true,
    is_active: true,
    display_order: 3,
    category: demoCategories[2]
  }
];

export const demoEmployeeServices: EmployeeServiceRow[] = [
  {
    service_id: "demo-service-visage",
    employees: {
      id: "demo-employee-1",
      public_display_name: "Équipe Esthetic Diamonds",
      role_title: "Esthéticienne experte"
    }
  },
  {
    service_id: "demo-service-massage",
    employees: {
      id: "demo-employee-1",
      public_display_name: "Équipe Esthetic Diamonds",
      role_title: "Praticienne spa"
    }
  },
  {
    service_id: "demo-service-aquabike",
    employees: {
      id: "demo-employee-2",
      public_display_name: "Coach Aqua-sports",
      role_title: "Coach Aqua Bike"
    }
  }
];

export const demoAquasportClasses = [
  {
    id: "demo-aqua-class-1",
    service_id: "demo-service-aquabike",
    title: "Aqua Bike tonique",
    level: "tous niveaux",
    start_at: "2026-05-04T14:00:00.000-04:00",
    end_at: "2026-05-04T14:45:00.000-04:00",
    capacity_max: 10,
    registered_count: 6,
    waitlist_count: 1,
    status: "open",
    instructions: "Prévoir maillot, serviette et arrivée 10 minutes avant.",
    employees: {
      public_display_name: "Coach Aqua-sports",
      role_title: "Coach Aqua Bike"
    },
    resources: {
      name: "Bassin Aqua-sports"
    }
  },
  {
    id: "demo-aqua-class-2",
    service_id: "demo-service-aquabike",
    title: "Aqua Bike intensif",
    level: "intermédiaire",
    start_at: "2026-05-06T10:00:00.000-04:00",
    end_at: "2026-05-06T10:45:00.000-04:00",
    capacity_max: 10,
    registered_count: 10,
    waitlist_count: 3,
    status: "full",
    instructions: "Séance cardio. Prévenir l’équipe en cas de contre-indication.",
    employees: {
      public_display_name: "Coach Aqua-sports",
      role_title: "Coach Aqua Bike"
    },
    resources: {
      name: "Bassin Aqua-sports"
    }
  }
];
