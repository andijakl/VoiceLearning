module.exports = {
    translation: {
        TITLE: "Voice Learning",

        WELCOME_NONAME: "Hallo und Willkommen bei Voice Learning! Ich kann dir helfen, die wichtigsten Konzepte deiner Kurse zu lernen. Welchen dieser Kurse willst du starten? {{availableTrainings}}.",
        WELCOME_REPROMPT_NONAME: "Bitte wähle einen der folgenden Kurse: {{availableTrainings}}.",
        WELCOME_ONECOURSE_NONAME: "Hallo und Willkommen bei Voice Learning! Ich kann dir helfen, die wichtigsten Konzepte deiner Kurse zu lernen. Ich kann dir derzeit bei folgendem Kurs helfen: {{availableTrainings}}. Willst du das Training starten?",
        WELCOME_ONECOURSE_REPROMPT_NONAME: "Willst du das Training für den Kurs {{availableTrainings}} starten?",
        WELCOME_PERSONALIZED_NONAME: "Willkommen zurück! {{prompt}}",
        WELCOME_PERSONALIZED_REPROMPT_NONAME: "Würdest du gerne den letzten Kurs {{currentTrainingName}} fortsetzen oder einen anderen Kurs starten?",

        UI_WELCOME: "Willkommen bei Voice Learning!",
        UI_WELCOME_PERSONALIZED: "Willkommen zurück!",
        UI_WELCOME_FINISHED_TRAININGS: "Du hast bereits {{finishedTrainings}} Trainings abgeschlossen und {{totalQuestionsAsked}} Fragen beantwortet.",
        UI_HINT_RESUME_START_ANOTHER: "Sag: \"den Kurs fortsetzen\" oder \"anderen Kurs starten\"",
        UI_HINT_CHOOSE_COURSE: "Sag: starte {{availableTrainings}}",
        UI_HINT_ONE_COURSE_START: "Sag: \"ja\" um das Training zu starten",

        WELCOME: "Hallo und Willkommen bei Voice Learning! Ich kann dir helfen, die wichtigsten Konzepte deiner Kurse zu lernen. Zuerst, sag mir bitte deinen Vornamen!",
        WELCOME_REPROMPT: "Bitte sag mir deinen Vornamen.",
        WELCOME_PERSONALIZED: "Willkommen zurück {{studentName}}! {{prompt}}",
        //WELCOME_PERSONALIZED: "Welcome back <alexa:name type='first' personId='{{personId}}' />! <break /> {{prompt}}",
        WELCOME_PERSONALIZED_REPROMPT: "Würdest du gerne den letzten Kurs fortsetzen oder einen anderen Kurs starten?",

        AVAILABLE_COURSES: "Hallo {{studentName}}. Ich freue mich, dass ich dir beim Lernen für deine Kurse helfen darf. Welchen dieser Kurse willst du starten? {{availableTrainings}}.",
        AVAILABLE_COURSES_REPROMPT: "Bitte wähle einen der folgenden Kurse: {{availableTrainings}}.",
        AVAILABLE_COURSES_LIST: "Du kannst einen dieser Kurse wählen: {{availableTrainings}}.",
        AVAILABLE_COURSES_OR: " oder ",

        UI_AVAILABLE_COURSES_TITLE: "Verfügbare Kurse",

        SELECTED_COURSE_START_TRAINING: "Du hast den Kurs {{currentTrainingName}} gewählt. Legen wir los!",
        RESUMING_COURSE_START_TRAINING: "Setze den Kurs {{currentTrainingName}} fort.",
        RESTART_COURSE_START_TRAINING: "Wiederhole den Kurs {{currentTrainingName}}.",
        DOES_NOT_WANT_TO_TRAIN: "OK. Wenn du später mit dem Training beginnen möchtest, starte Voice Learning einfach nochmal.",

        INSTRUCTIONS: "Eine kurze Einführung: Ich werde dir jetzt {{numQuestions}} Fragen stellen. Diese stammen aus zwei Kategorien. Antworte entweder einfach mit \"wahr\" oder \"falsch\". Bei Multiple-Choice-Fragen antworte bitte mit der entsprechenden Nummer anstelle des Beschreibungstextes, zum Beispiel Eins oder Zwei. Wenn du ein weiteres Training beginnst, stelle ich dir neue Fragen sowie insbesondere diejenigen erneut, die du beim letzten Mal falsch beantwortet hast.",

        HELP_PROMPT: "Ich bin dein Voice Learning Assistent und stelle dir Fragen zu deinen Kursen, die dir helfen, dir die Inhalte zu merken. Das funktioniert wie ein Quiz!",
        HELP_STATE_CHOOSE_COURSE: "Jetzt musst du dich für einen Kurs entscheiden. Du kannst mich erneut nach verfügbaren Kursen fragen, wenn du diese noch einmal hören willst. Sage dann einfach den Namen des Kurses, den du beginnen möchtest. Welchen Kurs willst du starten?",
        HELP_STATE_TRAINING: "Jetzt musst du eine Frage beantworten. Bei Fragen, bei denen du zwischen mehreren Optionen wählen kannst, antworte bitte mit der Nummer der richtigen Antwort. Bei Fragen nach wahr oder falsch, antworte bitte entsprechend direkt mit wahr oder falsch. Was denkst du ist richtig?",
        HELP_STATE_FINISHED: "Du hast gerade ein Training abgeschlossen. Ich kann dir gerne noch mehr Fragen stellen - sage ja, um weiter zu machen. Wenn du später weiter machen willst, antworte mit nein. Willst du noch einmal trainieren?",

        GENERIC_REPROMPT: "Wie kann ich dir helfen?",
        YES: "Richtig",
        NO: "Falsch",
        TRAINING_QUESTION_INTRO: "Frage {{questionNumber}}: ",
        TRAINING_YES_NO_OPTIONS: "Richtig oder falsch?",
        TRAINING_REPEAT_ANSWER: "Du hast {{answerAsText}} gesagt.",
        TRAINING_REPEAT_NUMERIC_ANSWER: "Du hast die Antwort {{answerAsInt}}: {{answerText}} gewählt.",
        TRAINING_ANSWER_CORRECT: "Gratulation, deine Antwort ist richtig!",
        TRAINING_ANSWER_WRONG: "Deine Antwort ist leider falsch.",
        TRAINING_FINISHED_NO_MORE_QUESTIONS: "Ich habe derzeit keine weiteren Fragen für dich.",
        TRAINING_FINISHED: "Du hast dein Training abgeschlossen! Du hast {{score}} von {{questionNumber}} Punkten erreicht. Du hast bereits {{finishedTrainings}} Trainings abgeschlossen.",
        TRAINING_FINISHED_NO_RESTART: "Vielen Dank, dass ich dir heute beim Lernen helfen konnte. Bis zum nächsten Mal!",
        TRAINING_RESTART_PROMPT: "Willst du noch ein Training starten?",
        DELETE_DATA_CONFIRMED: "Ich habe deine persönlichen Daten gelöscht. Bitte starte den Skill noch einmal, wenn du noch einmal trainieren willst. Bis zum nächsten Mal!",
        FALLBACK_WHILE_TRAINING: "Du befindest dich gerade in einem Training. Bitte beantworte die Frage.",
        FALLBACK_WHILE_TRAINING_YES_NO: "Du kannst mit \"richtig\" oder \"falsch\" antworten.",
        FALLBACK_WHILE_TRAINING_NUMERIC: "Nenne die Zahl der richtigen Antwort; sag zum Beispiel: \"Die Antwort ist eins\".",
        FALLBACK_REPEAT_QUESTION: "Ich werde jetzt die Frage wiederholen.",
        FALLBACK_WHILE_NAME: "Ich kann das gerade nicht machen. Sag mir bitte zuerst deinen Namen.",
        FALLBACK_GENERIC: "Ich kann das gerade nicht machen.",
        ERROR_NOT_IN_TRAINING_MODE: "Du bist gerade nicht in einem aktiven Training.",
        ERROR_COURSE_NOT_UNDERSTOOD: "Ich konnte leider nicht verstehen, welchen Kurs du starten willst. Bitte versuche es nochmal!",
        ERROR_COURSE_NOT_FOUND: "Ich konnte deine Wahl {{userTrainingName}} nicht unter den verfügbaren Kursen finden. Bitte versuche es noch einmal oder kontaktiere die Skill Administratoren!",
        ERROR_RESUME_NO_COURSE_STARTED: "Du hast noch keinen Kurs gestartet. Bitte wähle zuerst einen Kurs!",
        ERROR_RESUME_COURSE_WRONG_STATE: "Ich habe verstanden, dass du den vorigen Kurs fortsetzen willst. Das ist im Moment leider nicht möglich.",
        ERROR_STUDENT_NAME_WHEN_NOT_EXPECTED: "Ich habe einen Namen verstanden, aber dies nicht erwartet. Bitte wiederhole was du sagen wolltest, falls ich dich falsch verstanden habe.",
        ERROR_TRAINING_INVALID_ANSWER: "Deine Antwort {{answerAsText}} ist für diese Frage nicht gültig.",
        FALLBACK: "Sorry, I didn't catch that. Say that again please.",
        FALLBACK_REPROMPT: "Say that again please.",
        ERROR: "Leider hat etwas nicht geklappt. Bitte versuche es noch einmal.",
        EXIT: "Bis zum nächsten Mal! Wenn du das Training später fortsetzen willst, starte Voice Learning einfach nochmal.",

        UI_TRAINING_FINISHED_HEADLINE: "Fertig!",
        UI_TRAINING_FINISHED_TEXT: "Du hast {{score}} von {{questionNumber}} Punkten erreicht<br>Du hast bereits {{finishedTrainings}} Trainings abgeschlossen.",
        UI_TRAINING_FINISHED_BUTTON_AGAIN: "Noch einmal",
        UI_TRAINING_FINISHED_BUTTON_END: "Beenden",

        UI_HINT_YES_NO: "Sag zum Beispiel: \"Das ist richtig.\"",
        UI_HINT_NUMERIC: "Sag zum Beispiel: \"Die Antwort ist Eins.\""
    }
};