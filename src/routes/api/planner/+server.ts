import { json } from "@sveltejs/kit";
import { statements, getOrCreateMonth } from "$lib/server/database";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ setHeaders }) => {
  setHeaders({
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  });

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
        month: month.month,
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

    return json(data);
  } catch (error) {
    console.error("Error loading planner data:", error);
    return json({ error: "Failed to load data" }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();

    // Save months and days
    Object.entries(data.months).forEach(
      ([monthKey, monthData]: [string, any]) => {
        const { year, month, monthlyTargets, days } = monthData;

        // Get or create month (this handles both insert and getting the ID)
        const monthId = getOrCreateMonth(year, month);

        // Update monthly targets separately
        statements.updateMonthTargets.run(monthlyTargets || "", year, month);

        // Insert or update days
        Object.entries(days).forEach(([dateKey, dayData]: [string, any]) => {
          const existing = statements.getDay.get(dateKey);

          if (existing) {
            statements.updateDay.run(
              dayData.note || "",
              dayData.studyStatus || null,
              dayData.baslamaSaati || "",
              dayData.bitisSaati || "",
              dayData.isExamDay ? 1 : 0,
              dayData.examName || "",
              dateKey,
            );
          } else {
            statements.insertDay.run(
              dateKey,
              monthId,
              dayData.note || "",
              dayData.studyStatus || null,
              dayData.baslamaSaati || "",
              dayData.bitisSaati || "",
              dayData.isExamDay ? 1 : 0,
              dayData.examName || "",
            );
          }
        });
      },
    );

    return json({ success: true });
  } catch (error) {
    console.error("Error saving planner data:", error);
    return json({ error: "Failed to save data" }, { status: 500 });
  }
};
