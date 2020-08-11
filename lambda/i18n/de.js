module.exports = {
    translation: {
        WELCOME: "Hallo und Willkommmen beim Lern-Assistent! Ich kann dir helfen, die wichtigsten Konzepte deiner Kurse zu lernen. Zuerst, sag mir bitte deinen Vornamen!",
        WELCOME_REPROMPT: "Please tell me your first name.",
        WELCOME_PERSONALIZED: "Willkommen zurück {{personId}}! {{prompt}}",
        //WELCOME_PERSONALIZED: "Welcome back <alexa:name type='first' personId='{{personId}}' />! <break /> {{prompt}}",
        WELCOME_PERSONALIZED_REPROMPT: "Würdest du gerne den letzten Kurs fortsetzen oder einen anderen Kurs starten?",
        AVAILABLE_COURSES: "Hallo {{studentName}}. Ich freue mich, dass ich dir beim Lernen für deine Kurse helfen darf. Welchen dieser Kurse willst du starten? {{availableTrainings}}.",
        AVAILABLE_COURSES_REPROMPT: "Bitte wähle einen der folgenden Kurse: {{availableTrainings}}.",
        AVAILABLE_COURSES_LIST: "Du kannst einen dieser Kurse wählen: {{availableTrainings}}.",
        SELECTED_COURSE_START_TRAINING: "Du hast den Kurs {{currentTrainingName}} gewählt. Legen wir los!",
        ERROR_COURSE_NOT_UNDERSTOOD: "Ich konnte leider nicht verstehen, welchen Kurs du starten willst. Bitte versuche es nochmal!",
        ERROR_COURSE_NOT_FOUND: "Ich konnte deine Wahl {{userTrainingName}} nicht unter den verfügbaren Kursen finden. Bitte versuche es noch einmal oder kontaktiere die Skill Administratoren!",
        ERROR_STUDENT_NAME_WHEN_NOT_EXPECTED: "Ich habe einen Namen verstanden, aber dies nicht erwartet. Bitte wiederhole was du sagen wolltest, falls ich dich falsch verstanden habe.",
        FALLBACK: "Sorry, I didn't catch that. Say that again please.", 
        FALLBACK_REPROMPT: "Say that again please.",
        ERROR: "Sorry, something went wrong. Please try again later.",
        EXIT: "Goodbye!",
    }
};