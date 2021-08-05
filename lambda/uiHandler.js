"use strict";
const config = require("./config.js");
const util = require("./util");
const aplTrainingQuestionDocument = require("./response/display/training_question/document.json");

module.exports.showQuestionUi = function showQuestionUi(handlerInput, questionText, possibleAnswersString) {
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
