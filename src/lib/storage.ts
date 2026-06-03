import dayjs from "dayjs";
import type { PlannerData, MonthData, DayNote, StudyStatus } from "./types";

// Track save status for UI feedback
export type SaveStatus = "idle" | "saving" | "saved" | "error";
let saveStatusCallback: ((status: SaveStatus, error?: string) => void) | null =
  null;

export function onSaveStatusChange(
  callback: (status: SaveStatus, error?: string) => void,
) {
  saveStatusCallback = callback;
}

function notifySaveStatus(status: SaveStatus, error?: string) {
  if (saveStatusCallback) {
    saveStatusCallback(status, error);
  }
}

export async function savePlannerData(data: PlannerData): Promise<boolean> {
  try {
    notifySaveStatus("saving");

    const toSave: any = { months: {} };

    data.months.forEach((monthData, key) => {
      const daysObj: any = {};
      monthData.days.forEach((dayNote, dateKey) => {
        daysObj[dateKey] = dayNote;
      });

      toSave.months[key] = {
        ...monthData,
        days: daysObj,
      };
    });

    const response = await fetch("/api/planner", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toSave),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save data: ${errorText}`);
    }

    notifySaveStatus("saved");
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error("Veri kaydetme hatası:", error);
    notifySaveStatus("error", errorMessage);
    return false;
  }
}

// Month key uses 1-12 format (consistent with ISO date strings)
// month parameter should be 1-12
export function getMonthKey(year: number, month: number): string {
  return dayjs()
    .year(year)
    .month(month - 1)
    .format("YYYY-MM");
}

// Parse month key back to year and month (returns 1-12 format)
export function parseMonthKey(monthKey: string): {
  year: number;
  month: number;
} {
  const d = dayjs(monthKey, "YYYY-MM");
  return { year: d.year(), month: d.month() + 1 };
}

// Get date key in YYYY-MM-DD format
export function getDateKey(date: Date | dayjs.Dayjs): string {
  return dayjs(date).format("YYYY-MM-DD");
}

// Parse date key back to dayjs object
export function parseDateKey(dateKey: string): dayjs.Dayjs {
  return dayjs(dateKey, "YYYY-MM-DD");
}

export function initializeMonth(year: number, month: number): MonthData {
  return {
    year,
    month,
    monthlyTargets: "",
    days: new Map(),
  };
}

export function initializeDay(date: Date | dayjs.Dayjs): DayNote {
  const d = dayjs(date);
  const dateKey = getDateKey(d);
  let isExamDay = false;
  let examName = "";

  return {
    date: dateKey,
    note: "",
    studyStatus: null as StudyStatus,
    baslamaSaati: "",
    bitisSaati: "",
    isExamDay,
    examName,
  };
}
