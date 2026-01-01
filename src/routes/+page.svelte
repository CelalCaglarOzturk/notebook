<script lang="ts">
    import { onMount, tick } from "svelte";
    import dayjs from "dayjs";
    import weekday from "dayjs/plugin/weekday";
    import isoWeek from "dayjs/plugin/isoWeek";
    import type { PlannerData, MonthData, DayNote } from "$lib/types";
    import { TURKISH_MONTHS } from "$lib/types";
    import DayCard from "$lib/components/DayCard.svelte";
    import {
        savePlannerData,
        getMonthKey,
        initializeMonth,
        getDateKey,
        initializeDay,
    } from "$lib/storage";
    import type { PageData } from "./$types";

    // Extend dayjs with plugins
    dayjs.extend(weekday);
    dayjs.extend(isoWeek);

    let { data }: { data: PageData } = $props();

    let plannerData = $state<PlannerData>({ months: new Map() });
    let saveStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
    let isNavVisible = $state(false);

    onMount(async () => {
        // Load data from server props
        const months = new Map<string, MonthData>();

        if (data.plannerData.months) {
            Object.entries(data.plannerData.months).forEach(
                ([key, value]: [string, any]) => {
                    const days = new Map<string, DayNote>();
                    if (value.days) {
                        Object.entries(value.days).forEach(
                            ([dateKey, dayValue]: [string, any]) => {
                                days.set(dateKey, dayValue as DayNote);
                            },
                        );
                    }
                    months.set(key, {
                        ...value,
                        days,
                    });
                },
            );
        }

        plannerData = { months };
        await ensureNext12Months();

        // Scroll to current week after DOM updates
        await tick();
        scrollToCurrentWeek();
    });

    function scrollToMonth(monthKey: string) {
        const monthElement = document.querySelector(
            `[data-month-key="${monthKey}"]`,
        );
        if (monthElement) {
            monthElement.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }

    function scrollToCurrentWeek() {
        // Find the current week wrapper element
        const currentWeekWrapper = document.querySelector(
            '[data-current-week="true"]',
        );
        if (currentWeekWrapper) {
            currentWeekWrapper.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }

    async function ensureNext12Months() {
        const today = dayjs();
        const currentMonth = today.month(); // 0-11
        const currentYear = today.year();

        let updated = false;

        for (let i = 0; i < 12; i++) {
            const targetDate = today.add(i, "month");
            const year = targetDate.year();
            const monthIndex = targetDate.month(); // 0-11

            // Stop at Eylül (September) 2026
            if (year > 2026 || (year === 2026 && monthIndex > 8)) {
                break;
            }

            // Convert to 1-12 format for consistency with date strings
            const monthNumber = monthIndex + 1;
            const monthKey = getMonthKey(year, monthNumber);
            if (!plannerData.months.has(monthKey)) {
                plannerData.months.set(
                    monthKey,
                    initializeMonth(year, monthIndex), // monthIndex stays 0-11 for display
                );
                updated = true;
            }
        }

        if (updated) {
            await saveData();
        }
    }

    async function saveData() {
        saveStatus = "saving";
        const success = await savePlannerData(plannerData);
        if (success) {
            saveStatus = "saved";
            setTimeout(() => {
                if (saveStatus === "saved") saveStatus = "idle";
            }, 2000);
        } else {
            saveStatus = "error";
        }
    }

    // IMPORTANT: This function ensures day data consistency across duplicated displays
    // When a day appears in multiple month sections (e.g., Feb 1 shown in both Jan and Feb),
    // both instances read from and write to THE SAME data location (the day's actual month).
    // This means editing one instance automatically updates all other instances of that day.
    async function handleDayUpdate(date: dayjs.Dayjs, updatedDayNote: DayNote) {
        // Always store/update the day in its ACTUAL month (not the section it's displayed in)
        // Use 1-12 format for month key
        const monthKey = getMonthKey(date.year(), date.month() + 1);
        const monthData = plannerData.months.get(monthKey);
        if (!monthData) return;

        const dateKey = getDateKey(date);
        const updatedDays = new Map(monthData.days);
        updatedDays.set(dateKey, updatedDayNote);

        const updatedMonths = new Map(plannerData.months);
        updatedMonths.set(monthKey, {
            ...monthData,
            days: updatedDays,
        });

        // Svelte's reactivity ensures all instances of this day update automatically
        plannerData = { months: updatedMonths };
        await saveData();
    }

    async function handleMonthTargetsChange(monthKey: string, event: Event) {
        const target = event.target as HTMLTextAreaElement;
        autoResize(target);
        const monthData = plannerData.months.get(monthKey);
        if (!monthData) return;

        const updatedMonths = new Map(plannerData.months);
        updatedMonths.set(monthKey, {
            ...monthData,
            monthlyTargets: target.value,
        });

        plannerData = { months: updatedMonths };
        await saveData();
    }

    function autoResize(element: HTMLTextAreaElement) {
        // Temporarily set overflow to get correct scrollHeight
        element.style.overflow = "hidden";
        element.style.height = "auto";
        element.style.height = element.scrollHeight + "px";
    }

    function handleTargetsInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        autoResize(target);
    }

    function getStartOfWeek(date: dayjs.Dayjs): dayjs.Dayjs {
        // Monday as start of week (isoWeekday: 1 = Monday, 7 = Sunday)
        return date.startOf("isoWeek");
    }

    function getWeeksForMonth(year: number, month: number): dayjs.Dayjs[][] {
        const weeks: dayjs.Dayjs[][] = [];
        const firstDay = dayjs().year(year).month(month).date(1);
        const lastDay = firstDay.endOf("month");

        // Start from the Monday of the week containing the first day
        let currentWeekStart = getStartOfWeek(firstDay);

        while (
            currentWeekStart.isBefore(lastDay) ||
            currentWeekStart.isSame(lastDay, "day")
        ) {
            const week: dayjs.Dayjs[] = [];
            for (let i = 0; i < 7; i++) {
                week.push(currentWeekStart.add(i, "day"));
            }
            weeks.push(week);
            currentWeekStart = currentWeekStart.add(7, "day");
        }

        return weeks;
    }

    type MonthSection = {
        monthKey: string;
        monthData: MonthData;
        weeks: dayjs.Dayjs[][];
    };

    function getMonthSections(): MonthSection[] {
        const sections: MonthSection[] = [];

        // Get all months from plannerData and sort them chronologically
        const sortedMonthKeys = Array.from(plannerData.months.keys()).sort(
            (a, b) => {
                const [yearA, monthA] = a.split("-").map(Number);
                const [yearB, monthB] = b.split("-").map(Number);
                if (yearA !== yearB) return yearA - yearB;
                return monthA - monthB;
            },
        );

        for (const monthKey of sortedMonthKeys) {
            const monthData = plannerData.months.get(monthKey);
            if (monthData) {
                const weeks = getWeeksForMonth(monthData.year, monthData.month);
                sections.push({
                    monthKey,
                    monthData,
                    weeks,
                });
            }
        }

        return sections;
    }

    function isCurrentWeek(weekDays: dayjs.Dayjs[]): boolean {
        const today = dayjs().startOf("day");

        for (const day of weekDays) {
            if (day.startOf("day").isSame(today, "day")) {
                return true;
            }
        }
        return false;
    }

    const monthSections = $derived(getMonthSections());
</script>

<svelte:head>
    <title>Planlama Defteri</title>
</svelte:head>

<div class="page-layout">
    <!-- Toggle Button for Month Nav -->
    <button
        class="nav-toggle"
        class:active={isNavVisible}
        onclick={() => (isNavVisible = !isNavVisible)}
        title={isNavVisible ? "Menüyü gizle" : "Ay menüsünü göster"}
    >
        {isNavVisible ? "✕" : "📅"}
    </button>

    <!-- Month Navigation Sidebar -->
    <nav class="month-nav" class:visible={isNavVisible}>
        <div class="month-nav-title">Aylar</div>
        {#each monthSections as section}
            <button
                class="month-nav-item"
                onclick={() => {
                    scrollToMonth(section.monthKey);
                    isNavVisible = false;
                }}
            >
                {TURKISH_MONTHS[section.monthData.month].slice(0, 3)}
                {section.monthData.year}
            </button>
        {/each}
    </nav>

    <!-- Overlay when nav is visible -->
    {#if isNavVisible}
        <button
            class="nav-overlay"
            onclick={() => (isNavVisible = false)}
            aria-label="Menüyü kapat"
        ></button>
    {/if}

    <div class="container">
        {#if saveStatus !== "idle"}
            <div
                class="save-status"
                class:error={saveStatus === "error"}
                class:saving={saveStatus === "saving"}
                class:saved={saveStatus === "saved"}
            >
                {#if saveStatus === "saving"}
                    💾 Kaydediliyor...
                {:else if saveStatus === "saved"}
                    ✓ Kaydedildi
                {:else if saveStatus === "error"}
                    ⚠️ Kaydetme hatası! Lütfen tekrar deneyin.
                {/if}
            </div>
        {/if}

        <main class="calendar">
            {#each monthSections as section}
                <div class="month-header" data-month-key={section.monthKey}>
                    <h2>
                        {TURKISH_MONTHS[section.monthData.month]}
                        {section.monthData.year}
                    </h2>
                </div>
                <div class="monthly-targets">
                    <label for="targets-{section.monthKey}">
                        <strong>Aylık Hedefler:</strong>
                    </label>
                    <textarea
                        id="targets-{section.monthKey}"
                        value={section.monthData.monthlyTargets}
                        oninput={handleTargetsInput}
                        onblur={(e) =>
                            handleMonthTargetsChange(section.monthKey, e)}
                        placeholder="Bu ay için hedeflerinizi buraya yazın..."
                        rows="1"
                    ></textarea>
                </div>

                {#each section.weeks as weekDays}
                    {@const isCurrentWeekRow = isCurrentWeek(weekDays)}
                    <div
                        class="week-wrapper"
                        data-current-week={isCurrentWeekRow
                            ? "true"
                            : undefined}
                    >
                        <div
                            class="week-row"
                            class:current-week={isCurrentWeekRow}
                        >
                            {#each weekDays as day}
                                <!-- Data is ALWAYS fetched from the day's actual month, not the display section -->
                                <!-- Use 1-12 format for month key -->
                                {@const monthKey = getMonthKey(
                                    day.year(),
                                    day.month() + 1,
                                )}
                                {@const monthData =
                                    plannerData.months.get(monthKey)}
                                {@const dateKey = getDateKey(day)}
                                {@const dayNote =
                                    monthData?.days.get(dateKey) ||
                                    initializeDay(day)}
                                {@const isFromDifferentMonth =
                                    day.month() !== section.monthData.month}
                                {@const isToday = day.isSame(dayjs(), "day")}
                                <div
                                    class="day-wrapper"
                                    class:other-month={isFromDifferentMonth}
                                    data-today={isToday ? "true" : undefined}
                                >
                                    <DayCard
                                        date={day}
                                        {dayNote}
                                        onUpdate={(updated) =>
                                            handleDayUpdate(day, updated)}
                                    />
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            {/each}
        </main>
    </div>
</div>

<style>
    .page-layout {
        display: flex;
        min-height: 100vh;
    }

    .nav-toggle {
        position: fixed;
        right: 16px;
        top: 16px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #1a1a1a;
        border: 2px solid #2a2a2a;
        color: #ffffff;
        font-size: 18px;
        cursor: pointer;
        z-index: 200;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .nav-toggle:hover {
        background: #2a2a2a;
        border-color: #404040;
        transform: scale(1.1);
    }

    .nav-toggle.active {
        background: #ff6b6b;
        border-color: #ff6b6b;
    }

    .nav-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 90;
        border: none;
        cursor: pointer;
    }

    .month-nav {
        position: fixed;
        right: -100px;
        top: 0;
        width: 90px;
        height: 100vh;
        background: #0a0a0a;
        border-left: 2px solid #1a1a1a;
        display: flex;
        flex-direction: column;
        padding: 70px 8px 12px 8px;
        gap: 4px;
        overflow-y: auto;
        z-index: 100;
        transition: right 0.3s ease;
    }

    .month-nav.visible {
        right: 0;
    }

    .month-nav-title {
        font-size: 12px;
        font-weight: 700;
        color: #808080;
        text-transform: uppercase;
        text-align: center;
        padding-bottom: 8px;
        border-bottom: 1px solid #2a2a2a;
        margin-bottom: 8px;
    }

    .month-nav-item {
        background: transparent;
        border: 1px solid #2a2a2a;
        border-radius: 6px;
        padding: 8px 4px;
        color: #a0a0a0;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
    }

    .month-nav-item:hover {
        background: #1a1a1a;
        color: #ffffff;
        border-color: #404040;
    }

    .month-nav::-webkit-scrollbar {
        width: 4px;
    }

    .month-nav::-webkit-scrollbar-track {
        background: #0a0a0a;
    }

    .month-nav::-webkit-scrollbar-thumb {
        background: #2a2a2a;
        border-radius: 2px;
    }

    :global(body) {
        margin: 0;
        padding: 0;
        font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, sans-serif;
        background: #000000;
        min-height: 100vh;
        overflow-x: hidden;
    }

    :global(*) {
        box-sizing: border-box;
    }

    .container {
        flex: 1;
        max-width: 100%;
        margin: 0;
        padding: 8px 0;
        min-height: 100vh;
        position: relative;
        overflow-x: hidden;
    }

    .save-status {
        position: fixed;
        bottom: 16px;
        right: 16px;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 1000;
        animation: slideUp 0.3s ease;
    }

    .save-status.saving {
        background: #1a1a2e;
        color: #8b8bff;
        border: 2px solid #4a4aff;
    }

    .save-status.saved {
        background: #0f2a14;
        color: #51cf66;
        border: 2px solid #51cf66;
    }

    .save-status.error {
        background: #2a1515;
        color: #ff6b6b;
        border: 2px solid #ff6b6b;
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .calendar {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 100%;
        width: 100%;
        background: #000000;
        padding: 8px 4px;
        border-radius: 0;
        overflow: hidden;
    }

    .month-header {
        grid-column: 1 / -1;
        margin-top: 16px;
        margin-bottom: 4px;
        padding: 0 4px;
    }

    .month-header:first-child {
        margin-top: 0;
    }

    .month-header h2 {
        margin: 0;
        font-size: 28px;
        color: #ffffff;
        font-weight: 700;
        border-bottom: 3px solid #404040;
        padding-bottom: 8px;
        display: inline-block;
    }

    .monthly-targets {
        grid-column: 1 / -1;
        padding: 8px;
        background: #000000;
        border-radius: 6px;
        border: 1px solid #2a2a2a;
        margin: 0 4px 8px 4px;
    }

    .monthly-targets label {
        display: block;
        font-size: 16px;
        color: #e0e0e0;
        margin-bottom: 8px;
    }

    .monthly-targets textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #1a1a1a;
        border-radius: 4px;
        font-family: inherit;
        font-size: 14px;
        resize: none;
        overflow: hidden;
        transition: border-color 0.2s ease;
        min-height: 32px;
        line-height: 1.4;
        background: #000000;
        color: #ffffff;
    }

    .monthly-targets textarea:focus {
        outline: none;
        border-color: #555555;
        box-shadow: 0 0 0 3px rgba(85, 85, 85, 0.3);
    }

    .week-wrapper {
        display: block;
        width: 100%;
    }

    .week-row {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
        width: 100%;
        padding: 0 2px;
    }

    .week-row.current-week :global(.day-card) {
        box-shadow: 0 4px 16px rgba(80, 80, 80, 0.5);
        border-width: 4px;
    }

    .day-wrapper {
        min-width: 0;
        overflow: hidden;
    }

    .day-wrapper.other-month :global(.day-card) {
        opacity: 0.6;
    }

    .day-wrapper.other-month :global(.day-card):hover {
        opacity: 1;
    }

    @media (max-width: 768px) {
        .page-layout {
            flex-direction: column;
        }

        .nav-toggle {
            right: 12px;
            top: 12px;
            width: 40px;
            height: 40px;
        }

        .month-nav {
            position: fixed;
            top: auto;
            bottom: -80px;
            left: 0;
            right: 0;
            width: 100%;
            height: auto;
            flex-direction: row;
            padding: 8px;
            gap: 6px;
            overflow-x: auto;
            overflow-y: hidden;
            border-left: none;
            border-top: 2px solid #1a1a1a;
            transition: bottom 0.3s ease;
        }

        .month-nav.visible {
            bottom: 0;
            right: 0;
        }

        .month-nav-title {
            display: none;
        }

        .month-nav-item {
            flex-shrink: 0;
            padding: 10px 12px;
            font-size: 12px;
        }

        .container {
            max-width: 100%;
            padding: 4px 0;
            padding-bottom: 20px;
        }

        .calendar {
            grid-template-columns: 1fr;
            padding: 12px;
        }

        .month-header h2 {
            font-size: 22px;
        }

        .save-status {
            top: auto;
            bottom: 70px;
            right: 16px;
            left: 16px;
            text-align: center;
        }
    }
</style>
