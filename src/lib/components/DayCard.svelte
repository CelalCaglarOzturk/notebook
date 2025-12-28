<script lang="ts">
    import dayjs from "dayjs";
    import type { DayNote, StudyStatus } from "$lib/types";
    import { TURKISH_DAYS } from "$lib/types";

    interface Props {
        date: dayjs.Dayjs;
        dayNote: DayNote;
        onUpdate: (dayNote: DayNote) => void;
    }

    let { date, dayNote, onUpdate }: Props = $props();

    // Use $derived for values that should sync with props
    let localStudyStatus = $derived(dayNote.studyStatus);
    let localIsExamDay = $derived(dayNote.isExamDay);
    let localExamName = $derived(dayNote.examName);

    // Editable state that updates on input
    let editNote = $state("");
    let editBaslamaSaati = $state("");
    let editBitisSaati = $state("");
    let textareaElement: HTMLTextAreaElement | null = $state(null);

    // Sync editable state with props when dayNote changes
    $effect(() => {
        editNote = dayNote.note ?? "";
        editBaslamaSaati = dayNote.baslamaSaati ?? "";
        editBitisSaati = dayNote.bitisSaati ?? "";
    });

    // Auto-resize textarea when note changes or on mount
    $effect(() => {
        if (textareaElement && editNote !== undefined) {
            // Use setTimeout to ensure DOM is updated
            setTimeout(() => {
                if (textareaElement) {
                    autoResize(textareaElement);
                }
            }, 0);
        }
    });

    function handleNoteChange(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        autoResize(target);
        onUpdate({
            ...dayNote,
            note: editNote,
            baslamaSaati: editBaslamaSaati,
            bitisSaati: editBitisSaati,
            isExamDay: localIsExamDay,
            examName: localExamName,
        });
    }

    function handleTimeChange() {
        onUpdate({
            ...dayNote,
            note: editNote,
            baslamaSaati: editBaslamaSaati,
            bitisSaati: editBitisSaati,
            isExamDay: localIsExamDay,
            examName: localExamName,
        });
    }

    function autoResize(element: HTMLTextAreaElement) {
        // Reset height to auto to get correct scrollHeight
        element.style.height = "auto";
        // Set to scrollHeight to fit content
        element.style.height = element.scrollHeight + "px";
    }

    function handleInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        autoResize(target);
    }

    // Toggle through 3 states: null (neutral) -> 'studied' (green) -> 'notStudied' (red) -> null
    function toggleStudyStatus() {
        let newStatus: StudyStatus;
        if (localStudyStatus === null) {
            newStatus = "studied";
        } else if (localStudyStatus === "studied") {
            newStatus = "notStudied";
        } else {
            newStatus = null;
        }
        onUpdate({
            ...dayNote,
            studyStatus: newStatus,
            note: editNote,
            baslamaSaati: editBaslamaSaati,
            bitisSaati: editBitisSaati,
            isExamDay: localIsExamDay,
            examName: localExamName,
        });
    }

    // Use dayjs for day of week (0 = Sunday in dayjs, same as JS Date)
    const dayOfWeek = $derived(TURKISH_DAYS[date.day()]);
    const dayNumber = $derived(date.date());
    const placeholder = $derived(
        localStudyStatus === "notStudied"
            ? "Çalışılmama nedenini buraya yazın..."
            : "Notlarınızı buraya yazın...",
    );

    // Button text based on study status
    const buttonText = $derived(
        localStudyStatus === null
            ? "○ Boş"
            : localStudyStatus === "studied"
              ? "✓ Çalışıldı"
              : "✗ Çalışılmadı",
    );

    // Determine card color based on state
    // neutral (null) = default gray, studied = green, notStudied = red
    const cardStatus = $derived(
        localIsExamDay
            ? "exam-day"
            : localStudyStatus === "studied"
              ? "studied"
              : localStudyStatus === "notStudied"
                ? "not-studied"
                : "default",
    );
</script>

<div
    class="day-card"
    class:not-studied={cardStatus === "not-studied"}
    class:studied={cardStatus === "studied"}
    class:exam-day={cardStatus === "exam-day"}
>
    <div class="day-header">
        <div class="day-info">
            <span class="day-number">{dayNumber}</span>
            <span class="day-name">{dayOfWeek}</span>
            {#if localIsExamDay}
                <span class="exam-badge">🎓 {localExamName}</span>
            {/if}
        </div>
        <button
            class="study-status-btn"
            class:studied={localStudyStatus === "studied"}
            class:not-studied={localStudyStatus === "notStudied"}
            onclick={toggleStudyStatus}
            title="Durumu değiştirmek için tıklayın"
        >
            {buttonText}
        </button>
    </div>

    <div class="time-fields">
        <div class="time-field">
            <label for="baslama-{dayNote.date}">Başlama:</label>
            <input
                type="time"
                id="baslama-{dayNote.date}"
                bind:value={editBaslamaSaati}
                onblur={handleTimeChange}
            />
        </div>
        <div class="time-field">
            <label for="bitis-{dayNote.date}">Bitiş:</label>
            <input
                type="time"
                id="bitis-{dayNote.date}"
                bind:value={editBitisSaati}
                onblur={handleTimeChange}
            />
        </div>
    </div>

    <div class="day-content">
        <label for="note-{dayNote.date}">
            {localStudyStatus === "notStudied" ? "Neden:" : "Not:"}
        </label>
        <textarea
            id="note-{dayNote.date}"
            bind:value={editNote}
            bind:this={textareaElement}
            oninput={handleInput}
            onblur={handleNoteChange}
            {placeholder}
            rows="1"
        ></textarea>
    </div>
</div>

<style>
    .day-card {
        background: #0a0a0a;
        border: 3px solid #1a1a1a;
        border-radius: 8px;
        padding: 8px;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
        min-height: 180px;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-width: 0;
        overflow: hidden;
        box-sizing: border-box;
    }

    .day-card:hover {
        box-shadow: 0 4px 8px rgba(255, 255, 255, 0.1);
    }

    .day-card.not-studied {
        border-color: #ff6b6b;
        background: #2a1515;
    }

    .day-card.studied {
        border-color: #51cf66;
        background: #0f2a14;
    }

    .day-card.exam-day {
        border-color: #ffd700;
        background: #2a2410;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
    }

    .day-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        padding-bottom: 6px;
        border-bottom: 1px solid #1a1a1a;
        flex-shrink: 0;
    }

    .day-info {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
        flex: 1;
        min-width: 0;
    }

    .day-number {
        font-size: clamp(16px, 3vw, 22px);
        font-weight: bold;
        color: #ffffff;
        line-height: 1;
    }

    .day-name {
        font-size: clamp(9px, 1.5vw, 12px);
        color: #a0a0a0;
        font-weight: 500;
    }

    .exam-badge {
        font-size: clamp(8px, 1.2vw, 10px);
        color: #ffd700;
        font-weight: 700;
        padding: 2px 4px;
        background: rgba(255, 215, 0, 0.1);
        border-radius: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .study-status-btn {
        padding: 4px 6px;
        border: 1px solid #2a2a2a;
        border-radius: 4px;
        background: #000000;
        color: #a0a0a0;
        cursor: pointer;
        font-size: clamp(8px, 1.4vw, 11px);
        font-weight: bold;
        transition: all 0.2s ease;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .study-status-btn:hover {
        background: #1a1a1a;
    }

    .study-status-btn.studied {
        background: #51cf66;
        color: #000000;
        border-color: #51cf66;
    }

    .study-status-btn.not-studied {
        background: #ff6b6b;
        color: #ffffff;
        border-color: #ff6b6b;
    }

    .study-status-btn:active {
        transform: scale(0.98);
    }

    .time-fields {
        display: flex;
        flex-direction: row;
        gap: 4px;
        margin-bottom: 6px;
        flex-shrink: 0;
        flex-wrap: wrap;
    }

    .time-field {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 2px;
        min-width: 0;
        flex: 1;
    }

    .time-field label {
        font-size: clamp(8px, 1.2vw, 10px);
        font-weight: 600;
        color: #a0a0a0;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .time-field input[type="time"] {
        flex: 1;
        min-width: 0;
        width: 100%;
        padding: 3px 2px;
        border: 1px solid #1a1a1a;
        border-radius: 4px;
        font-family: inherit;
        font-size: clamp(9px, 1.4vw, 11px);
        transition: border-color 0.2s ease;
        background: #000000;
        color: #ffffff;
        box-sizing: border-box;
    }

    .time-field input[type="time"]:focus {
        outline: none;
        border-color: #555555;
    }

    .day-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-height: 0;
    }

    .day-content label {
        font-size: clamp(9px, 1.4vw, 11px);
        font-weight: 600;
        color: #808080;
        flex-shrink: 0;
    }

    .not-studied .day-content label {
        color: #e74c3c;
    }

    textarea {
        width: 100%;
        padding: 6px;
        border: 1px solid #1a1a1a;
        border-radius: 4px;
        font-family: inherit;
        font-size: clamp(10px, 1.6vw, 13px);
        resize: none;
        overflow: hidden;
        overflow-wrap: break-word;
        word-wrap: break-word;
        transition: border-color 0.2s ease;
        min-height: 60px;
        line-height: 1.3;
        background: #000000;
        color: #ffffff;
        box-sizing: border-box;
    }

    textarea:focus {
        outline: none;
        border-color: #555555;
        box-shadow: 0 0 0 3px rgba(85, 85, 85, 0.3);
    }

    .not-studied textarea {
        border-color: #ff6b6b;
    }

    .not-studied textarea:focus {
        border-color: #e74c3c;
        box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
    }

    .studied textarea {
        border-color: #51cf66;
    }

    .studied textarea:focus {
        border-color: #51cf66;
        box-shadow: 0 0 0 3px rgba(81, 207, 102, 0.1);
    }

    .exam-day textarea {
        border-color: #ffd700;
    }

    .exam-day textarea:focus {
        border-color: #ffd700;
        box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
    }

    .exam-day .time-field input[type="time"] {
        border-color: #ffd700;
    }

    .exam-day .time-field input[type="time"]:focus {
        border-color: #ffd700;
        box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
    }
</style>
