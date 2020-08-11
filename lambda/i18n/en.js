module.exports = {
    translation: {
        WELCOME: "Hi and welcome to the learning asssistant! I can help you understand the most important concepts of your courses. First, please tell me your first name!",
        WELCOME_REPROMPT: "Please tell me your first name.",
        WELCOME_PERSONALIZED: "Welcome back {{studentName}}! {{prompt}}",
        //WELCOME_PERSONALIZED: "Welcome back <alexa:name type='first' personId='{{personId}}' />! <break /> {{prompt}}",
        WELCOME_PERSONALIZED_REPROMPT: "Would you like to resume your last course or start another course?",
        AVAILABLE_COURSES: "Hi {{studentName}}. I'm happy to help you with learning for your courses. I have content for these courses: {{availableTrainings}}. Which course should I start?",
        AVAILABLE_COURSES_REPROMPT: "Please choose one of these courses: {{availableTrainings}}.",
        FALLBACK: "Sorry, I didn't catch that. Say that again please.", 
        FALLBACK_REPROMPT: "Say that again please.",
        ERROR: "Sorry, something went wrong. Please try again later.",
        EXIT: "Goodbye!",
    }
};