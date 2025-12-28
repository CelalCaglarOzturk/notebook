import type { PageServerLoad } from "./$types";
import { statements } from "$lib/server/database";

export const load: PageServerLoad = async () => {
  try {
    const months = statements.getAllMonths.all() as any[];
    const allDays = statements.getAllDays.all() as any[];

    // Transform database data to frontend format
    const data: any = {
      months: {},
    };

    months.forEach((month: any) => {
      // Month is stored as 0-11 in database, convert to 1-12 for monthKey
      const monthKey = `${month.year}-${String(month.month + 1).padStart(2, "0")}`;
      data.months[monthKey] = {
        year: month.year,
        month: month.month, // Keep 0-11 for display purposes
        monthlyTargets: month.monthly_targets || "",
        days: {},
      };
    });

    allDays.forEach((day: any) => {
      const dateKey = day.date;
      // Parse date - month from date string is already 1-12
      const [year, month] = dateKey.split("-").map(Number);
      // Use month directly (1-12) for monthKey
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;

      if (data.months[monthKey]) {
        data.months[monthKey].days[dateKey] = {
          date: day.date,
          note: day.note || "",
          studyStatus: day.study_status || null,
          baslamaSaati: day.baslama_saati || "",
          bitisSaati: day.bitis_saati || "",
          isExamDay: Boolean(day.is_exam_day),
          examName: day.exam_name || "",
        };
      }
    });

    return {
      plannerData: data,
    };
  } catch (error) {
    console.error("Error loading planner data:", error);
    return {
      plannerData: { months: {} },
    };
  }
};
