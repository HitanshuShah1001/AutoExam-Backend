export function getMetadataFromSegments(metadataSegments) {
    // Check if any segment contains "jee" (case insensitive)
    const isJEE = metadataSegments.some(segment => segment.toLowerCase().includes("jee"));
    const isNEET = metadataSegments.some(segment => segment.toLowerCase().includes("neet"));
    const isExercise = metadataSegments.some(segment => segment.toLowerCase().includes("exercise"));

    let grade, stream, subject, examName, examMonth, examYear, examDay, shift, set, exerciseName, keyword, textBook, chapter;
    let name = "";
    let result = {};


    if (isJEE) {
        switch (metadataSegments.length) {
            case 5:
                [examName, examDay, examMonth, examYear, shift] = metadataSegments;
                examName = examName.toLowerCase();
                examMonth = examMonth.toLowerCase();
                shift = shift.split("-")[0].toLowerCase();
                examYear = parseInt(examYear, 10);
                examDay = parseInt(examDay, 10);
                name = `${examName}_${examDay}_${examMonth}_${examYear}_${shift}`;
                result = { examName, examDay, examMonth, examYear, shift, name, grade: 12, stream: "science", subjects: ["maths", "physics", "chemistry"] };
                break;
            default:
                result = { error: "Invalid metadata segments length for JEE exam" };
                break;
        }
    } else if (isNEET) {
        switch (metadataSegments.length) {
            case 5:
                [examName, examDay, examMonth, examYear, set] = metadataSegments;
                examName = examName.toLowerCase();
                examMonth = examMonth.toLowerCase();
                examYear = parseInt(examYear, 10);
                examDay = parseInt(examDay, 10);
                set = set.toLowerCase()
                name = `${examName}_${examDay}_${examMonth}_${examYear}_${set}`;
                result = { examName, examDay, examMonth, examYear, set, name, grade: 12, stream: "science", subjects: ["maths", "physics", "biology"] };
                break;
            default:
                result = { error: "Invalid metadata segments length for JEE exam" };
                break;
        }
    } else if (isExercise) {
        switch (metadataSegments.length) {
            case 6:
                [keyword, grade, textBook, subject, chapter, exerciseName] = metadataSegments;
                chapter = chapter.split("-").join(" ").toLowerCase()
                exerciseName = exerciseName.split("-").join(" ").toLowerCase()
                textBook = textBook.toLowerCase()
                result = { grade, textBook, subject, chapter, exerciseName, subjects: [subject] };
                break;
            case 5:
                [keyword, grade, textBook, subject, chapter] = metadataSegments;
                chapter = chapter.split("-").join(" ").toLowerCase()
                textBook = textBook.toLowerCase()
                result = { grade, textBook, subject, chapter, exerciseName: "default", subjects: [subject] };
                break;
            default:
                result = { error: "Invalid metadata segments length for JEE exam" };
                break;
        }
    } else {
        switch (metadataSegments.length) {
            case 6:
                [grade, stream, subject, examName, examMonth, examYear] = metadataSegments;
                stream = stream.toLowerCase();
                subject = subject.toLowerCase();
                examName = examName.toLowerCase();
                examMonth = examMonth.toLowerCase();
                examYear = parseInt(examYear, 10);
                name = `${grade}_${stream}_${subject}_${examName}_${examMonth}_${examYear}`;
                result = { grade, stream, subject, examName, examMonth, examYear, name };
                break;
            case 5:
                [grade, subject, examName, examMonth, examYear] = metadataSegments;
                subject = subject.toLowerCase();
                examName = examName.toLowerCase();
                examMonth = examMonth.toLowerCase();
                examYear = parseInt(examYear, 10);
                name = `${grade}_${subject}_${examName}_${examMonth}_${examYear}`;
                result = { grade, subject, examName, examMonth, examYear, name };
                break;
            default:
                result = { error: "Invalid metadata segments length" };
                break;
        }
    }

    return result;
}