"use strict";
module.exports = {
    states: {
        STUDENT_NAME: "_STUDENT_NAME",
        CHOOSE_COURSE: "_CHOOSE_COURSE",
        TRAINING: "_TRAINING",
        FINISHED: "_FINISHED",
    },
    questionType: {
        YES_NO: 1,
        NUMERIC: 2
    },
    numQuestionsPerTraining: 3,
    useStudentName: false,
    aplTokens: {
        QUESTION: "questionToken",
        WELCOME: "welcomeToken",
        CHOOSE_COURSE: "chooseCourseToken",
        FINISHED: "finishedToken"
    }
};