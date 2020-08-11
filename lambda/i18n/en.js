module.exports = {
    translation: {
        WELCOME: "Hi and welcome to the learning asssistant! I can help you understand the most important concepts of your courses. First, please tell me your first name!",
        WELCOME_REPROMPT: "Please tell me your first name.",
        WELCOME_PERSONALIZED: "Welcome back {{studentName}}! {{prompt}}",
        //WELCOME_PERSONALIZED: "Welcome back <alexa:name type='first' personId='{{personId}}' />! <break /> {{prompt}}",
        WELCOME_PERSONALIZED_REPROMPT: "Would you like to resume your last course or start another course?",
        AVAILABLE_COURSES: "Hi {{studentName}}. I'm happy to help you with learning for your courses. I have content for these courses: {{availableTrainings}}. Which course should I start?",
        AVAILABLE_COURSES_REPROMPT: "Please choose one of these courses: {{availableTrainings}}.",
        AVAILABLE_COURSES_LIST: "You can choose one of these available courses: {{availableTrainings}}.",
        SELECTED_COURSE_START_TRAINING: "You chose the course: {{currentTrainingName}}. Let's get started!",
        ERROR_COURSE_NOT_UNDERSTOOD: "Sorry, I did not get which course you would like to start. Please try again!",
        ERROR_COURSE_NOT_FOUND: "Sorry, I was unable to match your selection {{userTrainingName}} to any of the available trainings. Please try again or contact the skill administrators!",
        ERROR_STUDENT_NAME_WHEN_NOT_EXPECTED: "I understood a name, but did not expect that. Please repeat what you wanted to say in case I misunderstood you.",
        FALLBACK: "Sorry, I didn't catch that. Say that again please.", 
        FALLBACK_REPROMPT: "Say that again please.",
        ERROR: "Sorry, something went wrong. Please try again later.",
        EXIT: "Goodbye!",
    }
};