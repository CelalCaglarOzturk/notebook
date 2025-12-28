// Study status: null = neutral (planning), 'studied' = çalışıldı, 'notStudied' = çalışılmadı
export type StudyStatus = null | "studied" | "notStudied";

export interface DayNote {
  date: string; // ISO format: YYYY-MM-DD
  note: string;
  studyStatus: StudyStatus; // null = neutral, 'studied' = green, 'notStudied' = red
  baslamaSaati: string;
  bitisSaati: string;
  isExamDay: boolean;
  examName: string;
}

export interface MonthData {
  year: number;
  month: number; // 0-11
  monthlyTargets: string;
  days: Map<string, DayNote>;
}

export interface PlannerData {
  months: Map<string, MonthData>;
}

export const TURKISH_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export const TURKISH_DAYS = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];
