"use strict";
const config = require("./config.js");
const dbHandler = require("./dbHandler.js");

// -------------------------------------------------------------------
// Active training handler functions

module.exports.initializeUser = function(sessionAttributes, persistentAttributes) {
    persistentAttributes.currentTrainingId = null;
    persistentAttributes.currentTrainingName = null;
    persistentAttributes.startedTrainings = 0;
    persistentAttributes.finishedTrainings = 0;
    persistentAttributes.totalQuestionsAsked = 0;
    persistentAttributes.totalCorrectAnswers = 0;
    persistentAttributes.totalWrongAnswers = 0;
    persistentAttributes.answersForTrainings = {};
    sessionAttributes.state = config.states.STUDENT_NAME;
};

module.exports.selectTraining = async function selectTraining(userTrainingName, persistentAttributes) {
    // Match user training name from intent slot with available trainings in the DB
    const trainingList = await dbHandler.getTrainingList();
    let foundTraining = null;
    // TODO: maybe change to for ... of to use break inside of loop?
    // https://stackoverflow.com/questions/3010840/loop-through-an-array-in-javascript
    trainingList.forEach((item) => {
        if (item.TrainingName.trim().localeCompare(userTrainingName.trim(), undefined, { sensitivity: "accent" }) === 0) {
            // Found a match!
            console.log(`Found a training match! Id: ${item.TrainingId}, name: ${item.TrainingName}`);
            persistentAttributes.currentTrainingId = item.TrainingId;
            persistentAttributes.currentTrainingName = item.TrainingName;
            foundTraining = item;
            // Note: return inside forEach doesn't exit the loop - would need to switch to other loop type!
        }
    });
    
    return foundTraining;
};

module.exports.startNewTraining = async function startNewTraining(userId, sessionAttributes, persistentAttributes) {
    //console.log("c Persistent attributes: " + JSON.stringify(persistentAttributes));
    persistentAttributes.startedTrainings += 1;
    sessionAttributes.state = config.states.TRAINING;
    sessionAttributes.questionNumber = 0;
    sessionAttributes.score = 0;
    sessionAttributes.questionsAskedThisSession = [];
    // Get current question list
    sessionAttributes.questionList = await dbHandler.getQuestionIdListForTraining(persistentAttributes.currentTrainingId);
    return await getNextQuestion(userId, sessionAttributes, persistentAttributes);
};

module.exports.handleYesNoIntent = async function handleYesNoIntent(isYes, userId, sessionAttributes, persistentAttributes) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.state === config.states.TRAINING) {
        // Update attributes
        if (sessionAttributes.questionType !== config.questionType.YES_NO) {
            // We do not expect yes/no for this question type
            speakOutput = "Your answer " + (isYes ? "yes" : "no") + " is not valid for this question. " + sessionAttributes.questionText;
            repromptOutput = sessionAttributes.questionText;
        } else {
            // Repeat what the user said
            let introOutput = "You said " + (isYes ? "yes" : "no") + ". ";
            // Yes/No is a valid answer - check if correct.
            introOutput += await answerIsYesNoCorrect(isYes, userId, sessionAttributes, persistentAttributes);
            ({speakOutput, repromptOutput} = await getNextQuestion(userId, sessionAttributes, persistentAttributes));
            speakOutput = introOutput + " " + speakOutput;
        }
    } else if (sessionAttributes.state === config.states.FINISHED) {
        if (isYes) {
            let introOutput = `Restarting your course ${persistentAttributes.currentTrainingName}`;
            ({speakOutput, repromptOutput} = await module.exports.startNewTraining(userId, sessionAttributes, persistentAttributes));
            speakOutput = introOutput + " " + speakOutput;
        } else {
            // Finished trainingand user doesn't want to restart
            speakOutput = "Thanks for training today. I hope I was able to help. Good bye!";
            repromptOutput = -1;
        }
    } else {
        // Not in training
        // TODO: provide instructions on what to do
        speakOutput = "You are currently not in training mode.";
        if (persistentAttributes.repromptOutput !== null) {
            speakOutput += " " + persistentAttributes.repromptOutput;
        }
    }

    return { speakOutput, repromptOutput };
};

module.exports.handleNumericIntent = async function handleNumericIntent(numericAnswer, userId, sessionAttributes, persistentAttributes) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.state === config.states.TRAINING) {
        console.log("In training state");
        // Update attributes
        if (sessionAttributes.questionType !== config.questionType.NUMERIC) {
            // We do not expect yes/no for this question type
            console.log("Invalid answer, not expecting numeric!");
            speakOutput = `Your answer ${numericAnswer} is not valid for this question. ${sessionAttributes.questionText}`;
            repromptOutput = sessionAttributes.questionText;
        } else {
            // Repeat what the user said
            const answerText = getTextForPossibleAnswer(numericAnswer, sessionAttributes.possibleAnswers);
            if (answerText !== undefined && answerText !== null) {
                console.log("got answer text: " + answerText);
                let introOutput = `You chose answer ${numericAnswer}: ${answerText}. `;
                introOutput += await answerIsNumericCorrect(numericAnswer, userId, sessionAttributes, persistentAttributes);
                ({speakOutput, repromptOutput} = await getNextQuestion(userId, sessionAttributes, persistentAttributes));
                speakOutput = introOutput + " " + speakOutput;
            } else {
                console.log("Invalid answer, not possible number!");
                speakOutput = `You chose answer ${numericAnswer}, but this is not valid for this question. ${sessionAttributes.questionText}`;
                repromptOutput = sessionAttributes.questionText;
            }
        }
    } else {
        // Not in training
        console.log("NOt in training!");
        // TODO: provide instructions on what to do
        speakOutput = "You are currently not in training mode.";
        if (persistentAttributes.repromptOutput !== null) {
            speakOutput += " " + persistentAttributes.repromptOutput;
        }
    }

    return { speakOutput, repromptOutput };
};

// -------------------------------------------------------------------
// Private functions

async function getNextQuestion(userId, sessionAttributes, persistentAttributes) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.questionNumber >= config.numQuestionsPerTraining) {
        // Training finished
        await trainingFinished(sessionAttributes, persistentAttributes);
        speakOutput = `This training session is finished! You got a score of ${sessionAttributes.score} out of ${sessionAttributes.questionNumber}. You already finished ${persistentAttributes.finishedTrainings} trainings.`;
        repromptOutput = "Would you like to train again?";
        speakOutput += " " + repromptOutput;
    } else {
        ({speakOutput, repromptOutput} = await getQuestionText(userId, sessionAttributes, persistentAttributes));
    }

    return {speakOutput, repromptOutput};
}


// Function to retrieve the next question
async function getQuestionText(userId, sessionAttributes, persistentAttributes) {
    let speakOutput = null;
    let repromptOutput = null;

    // Get best question to ask the user,
    // considering questions already asked this session as well as the 
    // overall correct/wrong ratio of questions in this training.
    let questionData = await getBestNextQuestion(userId, persistentAttributes.currentTrainingId, sessionAttributes.questionList, sessionAttributes.questionsAskedThisSession);

    if (questionData === null) {
        // No question left to ask
        // Training finished
        await trainingFinished(sessionAttributes, persistentAttributes);
        speakOutput = `I don't have any further questions for you right now. This training session is finished! You got a score of ${sessionAttributes.score} out of ${sessionAttributes.questionNumber}. You already finished ${persistentAttributes.finishedTrainings} trainings.`;
        repromptOutput = "Would you like to train again?";
        speakOutput += " " + repromptOutput;
    } else {
        // Update session variables
        sessionAttributes.questionNumber += 1;
        persistentAttributes.totalQuestionsAsked += 1;
    
        // Get question text
        const introText = `Question number ${sessionAttributes.questionNumber}: `;

        // Depending on question type, modify the text for better speech output
        if (questionData.QuestionType === config.questionType.YES_NO) {
            // add possible answers like: "yes or no?"
            questionData.QuestionText += " Yes or no?";
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

    return {speakOutput, repromptOutput};
}

function convertPossibleAnswersForSpeech(possibleAnswersString) {
    const possibleAnswers = possibleAnswersString.split("|");
    let speakText = "";
    for (const [i, curAnswerText] of possibleAnswers.entries()) {
        speakText += (i > 0) ? ", " : " ";
        speakText += `${i+1}: ${curAnswerText}`;
    }
    speakText += ".";
    return speakText;
}

function getTextForPossibleAnswer(answerId, possibleAnswersString) {
    const possibleAnswers = possibleAnswersString.split("|");
    return possibleAnswers[answerId-1];
}

async function getBestNextQuestion(userId, trainingId, completeQuestionList, questionsAskedThisSession) {
    const sortedQuestionScores = await calculateQuestionScores(userId, trainingId, completeQuestionList, questionsAskedThisSession);
    // Check if we have questions left!
    if (sortedQuestionScores.size > 0) {
        // Take first (= best) question
        const topQuestion = sortedQuestionScores.entries().next().value;
        //console.log("Top question ID: " + topQuestion[0] + ", score: " + topQuestion[1]);
        // Get data for this question
        let questionData = await dbHandler.getQuestion(trainingId, topQuestion[0]);
        console.log("Question data: " + questionData);
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
        // console.log("item data: " + item);
        // console.log("has CorrectCount 1: " + Object.prototype.hasOwnProperty.call(item, "CorrectCount"));
        // console.log("has CorrectCount 2: " + ("CorrectCount" in item));
        // console.log("item.CorrectCount" + item.CorrectCount);
        const correctCount = Object.prototype.hasOwnProperty.call(item, "CorrectCount") ? item.CorrectCount : 0;
        const wrongCount = Object.prototype.hasOwnProperty.call(item, "WrongCount") ? item.WrongCount : 0;
        questionScores.set(item.QuestionId, correctCount - wrongCount);
    });
    // console.log("questionScores: " + questionScores);
    // for (let [key, value] of questionScores.entries()) {
    //     console.log("key is " + key + ", value is " + value);
    // }

    for (const [, questionId] of completeQuestionList.entries()) {
        //console.log('%d: %s', i, value);
        if (!questionScores.has(questionId)) {
            // Question has never been asked - give it a score of -10 to prioritize it
            // over questions that have already been asked, but with a wrong answer.
            questionScores.set(questionId, -10);
        }
    }
    // console.log("questionScores with added unasked questions: " + questionScores);
    // for (let [key, value] of questionScores.entries()) {
    //     console.log("key is " + key + ", value is " + value);
    // }

    // Check session question list so that the same question isn't asked twice in a session!
    if (questionsAskedThisSession !== null) {
        questionsAskedThisSession.forEach(item => {
            questionScores.delete(item);
            //let removed = questionScores.delete(item);
            //console.log("Removed already asked entry: " + removed.key + " - " + removed.value);
        });
    }

    const questionScoresSorted = new Map([...questionScores.entries()].sort((a, b) => a[1] - b[1]));
    // console.log("Sorted question scores: " + questionScoresSorted);
    // for (let [key, value] of questionScoresSorted.entries()) {
    //     console.log("key is " + key + ", value is " + value);
    // }

    return questionScoresSorted;
}

async function answerIsNumericCorrect(numericAnswer, userId, sessionAttributes, persistentAttributes) {
    if (sessionAttributes.correctAnswer === (numericAnswer - 1)) {
        // Correct
        return await answerCorrect(userId, sessionAttributes, persistentAttributes);
    } else {
        // Not correct
        return await answerWrong(userId, sessionAttributes, persistentAttributes);
    }
}

async function answerIsYesNoCorrect(answerIsYes, userId, sessionAttributes, persistentAttributes) {
    if ((sessionAttributes.correctAnswer === 1 && answerIsYes) ||
        (sessionAttributes.correctAnswer === 0 && !answerIsYes)) {
        // Correct
        return await answerCorrect(userId, sessionAttributes, persistentAttributes);
    } else {
        // Not correct
        return await answerWrong(userId, sessionAttributes, persistentAttributes);
    }
}

async function answerCorrect(userId, sessionAttributes, persistentAttributes) {
    sessionAttributes.score += 1;
    persistentAttributes.totalCorrectAnswers += 1;

    const trainingId = persistentAttributes.currentTrainingId;
    const questionId = sessionAttributes.questionId;
    await dbHandler.logAnswerForUser(userId, trainingId, questionId, true);

    let speakText = "Congratulations, the answer is correct!";
    return speakText;
}

async function answerWrong(userId, sessionAttributes, persistentAttributes) {
    persistentAttributes.totalWrongAnswers += 1;

    const trainingId = persistentAttributes.currentTrainingId;
    const questionId = sessionAttributes.questionId;
    await dbHandler.logAnswerForUser(userId, trainingId, questionId, false);

    let speakText = "Sorry, your answer was wrong.";
    return speakText;
}



// -------------------------------------------------------------------
// Training state handler functions

async function trainingFinished(sessionAttributes, persistentAttributes) {
    sessionAttributes.state = config.states.FINISHED;
    persistentAttributes.finishedTrainings += 1;
}


// -------------------------------------------------------------------
// // Custom utility functions
// function getRandom(min, max) {
//     return Math.floor((Math.random() * ((max - min) + 1)) + min);
// }
  

// // This function takes the contents of an array and randomly shuffles it.
// function shuffle(array) {
//     let currentIndex = array.length, temporaryValue, randomIndex;
  
//     while ( 0 !== currentIndex ) {
//       randomIndex = Math.floor(Math.random() * currentIndex);
//       currentIndex--;
//       temporaryValue = array[currentIndex];
//       array[currentIndex] = array[randomIndex];
//       array[randomIndex] = temporaryValue;
//     }
//     return array;
// }