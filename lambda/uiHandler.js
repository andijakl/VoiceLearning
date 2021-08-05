"use strict";
const config = require("./config.js");
const util = require("./util");
const aplTrainingQuestionDocument = require("./response/display/training_question/document.json");
const aplWelcomeDocument = require("./response/display/welcome/document.json");

module.exports.showQuestionUi = function showQuestionUi(questionText, possibleAnswersString, handlerInput) {
    const possibleAnswers = possibleAnswersString.split("|");
    let textListItemList = [];
    for (const [, curAnswerText] of possibleAnswers.entries()) {
        textListItemList.push({ "primaryText": curAnswerText });
    }

    const dataSources = {
        textListData: {
            title: questionText,
            "listItems": textListItemList
        }
    };
    util.addAplIfSupported(handlerInput, config.aplTokens.QUESTION, aplTrainingQuestionDocument, dataSources);

};

module.exports.showWelcomeUi = function showWelcomeUi(welcomeBack, availableTrainings, finishedTrainings, totalQuestionsAsked, handlerInput) {
    // Only show number of finished trainings if user has already finished at least one.
    const finishedTrainingsText = finishedTrainings > 0 ?
        handlerInput.t("UI_WELCOME_FINISHED_TRAININGS", {
            finishedTrainings: finishedTrainings,
            totalQuestionsAsked: totalQuestionsAsked
        }) :
        null;

    const dataSources = {
        data: {
            headerTitle: handlerInput.t("TITLE"),
            primaryText: welcomeBack ?
                handlerInput.t("UI_WELCOME_PERSONALIZED") :
                handlerInput.t("UI_WELCOME"),
            secondaryText: finishedTrainingsText,
            footerHintText: availableTrainings ?
                handlerInput.t("UI_HINT_CHOOSE_COURSE", {
                    availableTrainings: availableTrainings
                }) :
                handlerInput.t("UI_HINT_RESUME_START_ANOTHER")
        }
    };
    util.addAplIfSupported(handlerInput, config.aplTokens.WELCOME, aplWelcomeDocument, dataSources);
};
