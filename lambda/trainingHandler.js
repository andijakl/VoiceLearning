"use strict";
const config = require("./config.js");
const dbHandler = require("./dbHandler.js");

// -------------------------------------------------------------------
// Active training handler functions

module.exports.initializeUser = function (sessionAttributes, persistentAttributes) {
    persistentAttributes.currentTrainingId = null;
    persistentAttributes.currentTrainingName = null;
    persistentAttributes.startedTrainings = 0;
    persistentAttributes.finishedTrainings = 0;
    persistentAttributes.totalQuestionsAsked = 0;
    persistentAttributes.totalCorrectAnswers = 0;
    persistentAttributes.totalWrongAnswers = 0;
    persistentAttributes.answersForTrainings = {};
};

module.exports.selectTraining = async function selectTraining(userTrainingName, persistentAttributes, language) {
    // Match user training name from intent slot with available trainings in the DB
    const trainingList = await dbHandler.getTrainingList(language);
    let foundTraining = null;
    // TODO: maybe change to for ... of to use break inside of loop?
    // https://stackoverflow.com/questions/3010840/loop-through-an-array-in-javascript
    trainingList.forEach((item) => {
        //console.log(`Comparing ${item.TrainingName.trim()} to ${userTrainingName.trim()}`);
        if (item.TrainingName.trim().localeCompare(userTrainingName.trim(), undefined, { sensitivity: "accent" }) === 0) {
            // Found a match!
            //console.log(`Found a training match! Id: ${item.TrainingId}, name: ${item.TrainingName}`);
            persistentAttributes.currentTrainingId = item.TrainingId;
            persistentAttributes.currentTrainingName = item.TrainingName;
            foundTraining = item;
            // Note: return inside forEach doesn't exit the loop - would need to switch to other loop type!
        }
    });

    return foundTraining;
};

module.exports.startNewTraining = async function startNewTraining(userId, sessionAttributes, persistentAttributes, handlerInput, language) {
    //console.log("c Persistent attributes: " + JSON.stringify(persistentAttributes));
    persistentAttributes.startedTrainings += 1;
    sessionAttributes.state = config.states.TRAINING;
    sessionAttributes.questionNumber = 0;
    sessionAttributes.score = 0;
    sessionAttributes.questionsAskedThisSession = [];
    // Get current question list
    sessionAttributes.questionList = await dbHandler.getQuestionIdListForTraining(persistentAttributes.currentTrainingId);
    return await getNextQuestion(userId, sessionAttributes, persistentAttributes, handlerInput, language);
};

module.exports.handleYesNoIntent = async function handleYesNoIntent(isYes, userId, sessionAttributes, persistentAttributes, handlerInput, language) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.state === config.states.TRAINING) {
        const answerAsText = (isYes ? handlerInput.t("YES") : handlerInput.t("NO"));
        // Update attributes
        if (sessionAttributes.questionType !== config.questionType.YES_NO) {
            // We do not expect yes/no for this question type
            speakOutput = handlerInput.t("ERROR_TRAINING_INVALID_ANSWER", {
                answerAsText: answerAsText
            });
            speakOutput += " " + sessionAttributes.questionText;
            repromptOutput = sessionAttributes.questionText;
        } else {
            // Repeat what the user said
            let introOutput = handlerInput.t("TRAINING_REPEAT_ANSWER", {
                answerAsText: answerAsText
            });
            introOutput += " ";
            // Yes/No is a valid answer - check if correct.
            introOutput += await answerIsYesNoCorrect(isYes, userId, sessionAttributes, persistentAttributes, handlerInput);
            ({ speakOutput, repromptOutput } = await getNextQuestion(userId, sessionAttributes, persistentAttributes, handlerInput, language));
            speakOutput = introOutput + " " + speakOutput;
        }
    } else if (sessionAttributes.state === config.states.FINISHED) {
        if (isYes) {
            let introOutput = handlerInput.t("RESTART_COURSE_START_TRAINING", {
                currentTrainingName: persistentAttributes.currentTrainingName
            });
            ({ speakOutput, repromptOutput } = await module.exports.startNewTraining(userId, sessionAttributes, persistentAttributes, handlerInput, language));
            speakOutput = introOutput + " " + speakOutput;
        } else {
            // Finished training and user doesn't want to restart
            speakOutput = handlerInput.t("TRAINING_FINISHED_NO_RESTART");
            repromptOutput = -1;
        }
    } else {
        // Not in training
        // TODO: provide instructions on what to do
        speakOutput = handlerInput.t("ERROR_NOT_IN_TRAINING_MODE");
        if (sessionAttributes.repromptOutput !== null) {
            speakOutput += " " + sessionAttributes.repromptOutput;
        }
    }

    return { speakOutput, repromptOutput };
};

module.exports.handleNumericIntent = async function handleNumericIntent(numericAnswer, userId, sessionAttributes, persistentAttributes, handlerInput, language) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.state === config.states.TRAINING) {
        // Update attributes
        if (sessionAttributes.questionType !== config.questionType.NUMERIC) {
            // We do not expect yes/no for this question type
            speakOutput = handlerInput.t("ERROR_TRAINING_INVALID_ANSWER", {
                answerAsText: numericAnswer
            });
            speakOutput += " " + sessionAttributes.questionText;
            repromptOutput = sessionAttributes.questionText;
        } else {
            // Repeat what the user said
            const answerAsInt = parseInt(numericAnswer);
            const answerText = getTextForPossibleAnswer(answerAsInt, sessionAttributes.possibleAnswers);
            if (answerText !== undefined && answerText !== null) {
                let introOutput = handlerInput.t("TRAINING_REPEAT_NUMERIC_ANSWER", {
                    answerAsInt: answerAsInt,
                    answerText: answerText
                });
                introOutput += " ";
                introOutput += await answerIsNumericCorrect(answerAsInt, userId, sessionAttributes, persistentAttributes, handlerInput);
                ({ speakOutput, repromptOutput } = await getNextQuestion(userId, sessionAttributes, persistentAttributes, handlerInput, language));
                speakOutput = introOutput + " " + speakOutput;
            } else {
                speakOutput = handlerInput.t("ERROR_TRAINING_INVALID_ANSWER", {
                    answerAsText: answerAsInt
                });
                speakOutput += " " + sessionAttributes.questionText;
                repromptOutput = sessionAttributes.questionText;
            }
        }
    } else {
        // Not in training
        // TODO: provide instructions on what to do
        speakOutput = handlerInput.t("ERROR_NOT_IN_TRAINING_MODE");
        if (sessionAttributes.repromptOutput !== null) {
            speakOutput += " " + sessionAttributes.repromptOutput;
        }
    }

    return { speakOutput, repromptOutput };
};


module.exports.handleFallbackIntent = async function handleFallbackIntent(isInFallback, handlerInput, intentName) {
    let speakOutput = null;
    let repromptOutput = null;

    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    //const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

    let consoleOutput = (isInFallback) ? "Fallback: " : "Reflector: ";
    console.log(`${consoleOutput} for ${intentName}. State: ${sessionAttributes.state}.`);
    //const speakOutput = `Fallback handler for ${intentName}`;
    if (sessionAttributes.state === config.states.TRAINING) {
        speakOutput = handlerInput.t("FALLBACK_WHILE_TRAINING");
    } else if (sessionAttributes.state == config.states.STUDENT_NAME) {
        speakOutput = handlerInput.t("FALLBACK_WHILE_NAME");
    } else {
        speakOutput = handlerInput.t("FALLBACK_GENERIC");
    }
    if (sessionAttributes.repromptOutput !== null) {
        repromptOutput = sessionAttributes.repromptOutput;
        speakOutput += " " + repromptOutput;
    } else {
        repromptOutput = speakOutput;
    }

    return { speakOutput, repromptOutput };
};

// -------------------------------------------------------------------
// Private functions

async function getNextQuestion(userId, sessionAttributes, persistentAttributes, handlerInput, language) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.questionNumber >= config.numQuestionsPerTraining) {
        // Training finished
        await trainingFinished(sessionAttributes, persistentAttributes);
        speakOutput = handlerInput.t("TRAINING_FINISHED", {
            score: sessionAttributes.score,
            questionNumber: sessionAttributes.questionNumber,
            finishedTrainings: persistentAttributes.finishedTrainings
        });
        repromptOutput = handlerInput.t("TRAINING_RESTART_PROMPT");
        speakOutput += " " + repromptOutput;
    } else {
        ({ speakOutput, repromptOutput } = await getQuestionText(userId, sessionAttributes, persistentAttributes, handlerInput, language));
    }

    return { speakOutput, repromptOutput };
}


// Function to retrieve the next question
async function getQuestionText(userId, sessionAttributes, persistentAttributes, handlerInput, language) {
    let speakOutput = null;
    let repromptOutput = null;

    // Get best question to ask the user,
    // considering questions already asked this session as well as the 
    // overall correct/wrong ratio of questions in this training.
    let questionData = await getBestNextQuestion(userId, persistentAttributes.currentTrainingId, sessionAttributes.questionList, sessionAttributes.questionsAskedThisSession, language);

    if (questionData === null) {
        // No question left to ask
        // Training finished
        await trainingFinished(sessionAttributes, persistentAttributes);
        speakOutput = handlerInput.t("TRAINING_FINISHED_NO_MORE_QUESTIONS");
        speakOutput += " " + handlerInput.t("TRAINING_FINISHED", {
            score: sessionAttributes.score,
            questionNumber: sessionAttributes.questionNumber,
            finishedTrainings: persistentAttributes.finishedTrainings
        });
        repromptOutput = handlerInput.t("TRAINING_RESTART_PROMPT");
        speakOutput += " " + repromptOutput;
    } else {
        // Update session variables
        sessionAttributes.questionNumber += 1;
        persistentAttributes.totalQuestionsAsked += 1;

        // Get question text
        const introText = handlerInput.t("TRAINING_QUESTION_INTRO", {
            questionNumber: sessionAttributes.questionNumber
        });

        // Depending on question type, modify the text for better speech output
        if (questionData.QuestionType === config.questionType.YES_NO) {
            // add possible answers like: "yes or no?"
            questionData.QuestionText += " " + handlerInput.t("TRAINING_YES_NO_OPTIONS");
        } else if (questionData.QuestionType === config.questionType.NUMERIC) {
            // Parse possible answers
            questionData.QuestionText += convertPossibleAnswersForSpeech(questionData.PossibleAnswers);
        }

        // Store new question data
        sessionAttributes.questionId = questionData.QuestionId;
        sessionAttributes.questionType = questionData.QuestionType;
        sessionAttributes.correctAnswer = questionData.CorrectAnswer;
        sessionAttributes.questionText = questionData.QuestionText;
        sessionAttributes.possibleAnswers = questionData.PossibleAnswers;
        sessionAttributes.questionsAskedThisSession.push(questionData.QuestionId);

        speakOutput = introText + sessionAttributes.questionText;
        repromptOutput = sessionAttributes.questionText;
    }

    return { speakOutput, repromptOutput };
}

function convertPossibleAnswersForSpeech(possibleAnswersString) {
    const possibleAnswers = possibleAnswersString.split("|");
    let speakText = "";
    for (const [i, curAnswerText] of possibleAnswers.entries()) {
        speakText += (i > 0) ? ", " : " ";
        speakText += `${i + 1}: ${curAnswerText}`;
    }
    speakText += ".";
    return speakText;
}

function getTextForPossibleAnswer(answerId, possibleAnswersString) {
    const possibleAnswers = possibleAnswersString.split("|");
    return possibleAnswers[answerId - 1];
}

async function getBestNextQuestion(userId, trainingId, completeQuestionList, questionsAskedThisSession, language) {
    const sortedQuestionScores = await calculateQuestionScores(userId, trainingId, completeQuestionList, questionsAskedThisSession);
    // Check if we have questions left!
    if (sortedQuestionScores.size > 0) {
        // Take first (= best) question
        const topQuestion = sortedQuestionScores.entries().next().value;
        //console.log("Top question ID: " + topQuestion[0] + ", score: " + topQuestion[1]);
        // Get data for this question
        let questionData = await dbHandler.getQuestion(trainingId, topQuestion[0], language);
        //console.log("Question data: " + JSON.stringify(questionData));
        return questionData;
    } else {
        // No question left to ask
        return null;
    }
}

// eslint-disable-next-line no-unused-vars
async function calculateQuestionScores(userId, trainingId, completeQuestionList, questionsAskedThisSession) {
    const answerList = await dbHandler.getAnswersForUser(userId, trainingId);
    let questionScores = new Map();

    // Loop over user answers and calculate score for each question
    answerList.forEach(item => {
        const correctCount = Object.prototype.hasOwnProperty.call(item, "CorrectCount") ? item.CorrectCount : 0;
        const wrongCount = Object.prototype.hasOwnProperty.call(item, "WrongCount") ? item.WrongCount : 0;
        questionScores.set(item.QuestionId, correctCount - wrongCount);
    });

    for (const [, questionId] of completeQuestionList.entries()) {
        if (!questionScores.has(questionId)) {
            // Question has never been asked - give it a score of -10 to prioritize it
            // over questions that have already been asked, but with a wrong answer.
            questionScores.set(questionId, -10);
        }
    }

    // Check session question list so that the same question isn't asked twice in a session!
    if (questionsAskedThisSession !== null) {
        questionsAskedThisSession.forEach(item => {
            questionScores.delete(item);
        });
    }

    const questionScoresSorted = new Map([...questionScores.entries()].sort((a, b) => a[1] - b[1]));

    return questionScoresSorted;
}

async function answerIsNumericCorrect(numericAnswer, userId, sessionAttributes, persistentAttributes, handlerInput) {
    if (sessionAttributes.correctAnswer === numericAnswer) {
        // Correct
        return await answerCorrect(userId, sessionAttributes, persistentAttributes, handlerInput);
    } else {
        // Not correct
        return await answerWrong(userId, sessionAttributes, persistentAttributes, handlerInput);
    }
}

async function answerIsYesNoCorrect(answerIsYes, userId, sessionAttributes, persistentAttributes, handlerInput) {
    if ((sessionAttributes.correctAnswer === 1 && answerIsYes) ||
        (sessionAttributes.correctAnswer === 0 && !answerIsYes)) {
        // Correct
        return await answerCorrect(userId, sessionAttributes, persistentAttributes, handlerInput);
    } else {
        // Not correct
        return await answerWrong(userId, sessionAttributes, persistentAttributes, handlerInput);
    }
}

async function answerCorrect(userId, sessionAttributes, persistentAttributes, handlerInput) {
    sessionAttributes.score += 1;
    persistentAttributes.totalCorrectAnswers += 1;

    const trainingId = persistentAttributes.currentTrainingId;
    const questionId = sessionAttributes.questionId;
    await dbHandler.logAnswerForUser(userId, trainingId, questionId, true);

    return handlerInput.t("TRAINING_ANSWER_CORRECT");
}

async function answerWrong(userId, sessionAttributes, persistentAttributes, handlerInput) {
    persistentAttributes.totalWrongAnswers += 1;

    const trainingId = persistentAttributes.currentTrainingId;
    const questionId = sessionAttributes.questionId;
    await dbHandler.logAnswerForUser(userId, trainingId, questionId, false);

    return handlerInput.t("TRAINING_ANSWER_WRONG");
}



// -------------------------------------------------------------------
// Training state handler functions

async function trainingFinished(sessionAttributes, persistentAttributes) {
    sessionAttributes.state = config.states.FINISHED;
    persistentAttributes.finishedTrainings += 1;
}
