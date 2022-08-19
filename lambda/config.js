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
    numQuestionsPerTraining: 5,
    useStudentName: false,
    aplTokens: {
        QUESTION: "questionToken",
        QUESTION2: "questionToken2",
        WELCOME: "welcomeToken",
        CHOOSE_COURSE: "chooseCourseToken",
        FINISHED: "finishedToken"
    }
};