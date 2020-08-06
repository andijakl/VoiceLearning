'use strict';
const config = require('./config.js');
const dbHandler = require('./dbHandler.js');

// -------------------------------------------------------------------
// Active training handler functions

module.exports.initializeUser = function(sessionAttributes, persistentAttributes) {
    persistentAttributes.currentCourse = null;
    persistentAttributes.startedTrainings = 0;
    persistentAttributes.finishedTrainings = 0;
    persistentAttributes.totalQuestionsAsked = 0;
    persistentAttributes.totalCorrectAnswers = 0;
    persistentAttributes.totalWrongAnswers = 0;
    sessionAttributes.state = config.states.STUDENT_NAME;
}

module.exports.startNewCourse = async function startNewCourse(sessionAttributes, persistentAttributes, handlerInput) {
    persistentAttributes.startedTrainings += 1;
    sessionAttributes.state = config.states.TRAINING;
    sessionAttributes.questionNumber = 0;
    sessionAttributes.score = 0;
    return await getNextQuestion(sessionAttributes, persistentAttributes, handlerInput);
}

module.exports.handleYesNoIntent = async function handleYesNoIntent(isYes, sessionAttributes, persistentAttributes, handlerInput) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.state === config.states.TRAINING) {
        // Update attributes
        if (sessionAttributes.questionType !== 1) {
            // We do not expect yes/no for this question type
            speakOutput = "Your answer " + (isYes ? 'yes' : 'no') + " is not valid for this question. " + sessionAttributes.questionText;
            repromptOutput = sessionAttributes.questionText;
        } else {
            // Repeat what the user said
            let introOutput = "You said " + (isYes ? 'yes' : 'no') + ". ";
            // Yes/No is a valid answer - check if correct.
            introOutput += answerIsYesNoCorrect(isYes, sessionAttributes, persistentAttributes);
            ({speakOutput, repromptOutput} = await getNextQuestion(sessionAttributes, persistentAttributes, handlerInput));
            speakOutput = introOutput + " " + speakOutput;
        }
    } else if (sessionAttributes.state === config.states.FINISHED) {
        if (isYes) {
            let introOutput = `Restarting your course ${persistentAttributes.currentCourse}`;
            ({speakOutput, repromptOutput} = await module.exports.startNewCourse(sessionAttributes, persistentAttributes, handlerInput));
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
            speakOutput += ' ' + persistentAttributes.repromptOutput;
        }
    }

    return { speakOutput, repromptOutput };
}

// -------------------------------------------------------------------
// Private functions

async function getNextQuestion(sessionAttributes, persistentAttributes, handlerInput) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.questionNumber >= 3) {
        // Training finished
        await trainingFinished(sessionAttributes, persistentAttributes, handlerInput);
        speakOutput = `This training session is finished! You got a score of ${sessionAttributes.score}. You already finished ${persistentAttributes.finishedTrainings} trainings.`;
        repromptOutput = `Would you like to train again?`;
        speakOutput += " " + repromptOutput;
    } else {
        ({speakOutput, repromptOutput} = await getQuestionText(sessionAttributes, persistentAttributes, handlerInput));
    }

    return {speakOutput, repromptOutput};
}


// Function to retrieve the next question
async function getQuestionText(sessionAttributes, persistentAttributes, handlerInput) {
    console.log("I am in getQuestionText()");
    let speakOutput = null;
    let repromptOutput = null;

    // Update session variables
    sessionAttributes.questionNumber += 1;
    persistentAttributes.totalQuestionsAsked += 1;

    // Get question text
    //const random = getRandom(0, data.length - 1);
    //const questionDb = require(jsonFilePath);
    const introText = `Question number ${sessionAttributes.questionNumber}: `;

    // TODO: hardcoded question for now
    //let questionText = "Is accessibility only important for people with disabilities? Yes or no?";
    let questionList = await dbHandler.getQuestionListForTraining(1);
    const questionData = await dbHandler.getQuestion(1, 2);
    // Depending on question type, add "yes or no?"

    console.log("Question text: " + sessionAttributes.questionText);

    // Store new question data
    sessionAttributes.questionId = questionData.QuestionId;
    sessionAttributes.questionType = questionData.QuestionType;
    sessionAttributes.correctAnswer = questionData.CorrectAnswer;
    sessionAttributes.questionText = questionData.QuestionText;

    speakOutput = introText + sessionAttributes.questionText;
    repromptOutput = sessionAttributes.questionText;

    return {speakOutput, repromptOutput};
}


function answerIsYesNoCorrect(answerIsYes, sessionAttributes, persistentAttributes) {
    if ((sessionAttributes.correctAnswer === 1 && answerIsYes) ||
        (sessionAttributes.correctAnswer === 0 && !answerIsYes)) {
        // Correct
        return answerCorrect(sessionAttributes, persistentAttributes);
    } else {
        // Not correct
        return answerWrong(sessionAttributes, persistentAttributes);
    }
}

function answerCorrect(sessionAttributes, persistentAttributes) {
    sessionAttributes.score += 1;
    persistentAttributes.totalCorrectAnswers += 1;
    let speakText = "Congratulations, the answer is correct!";
    return speakText;
}

function answerWrong(sessionAttributes, persistentAttributes) {
    persistentAttributes.totalWrongAnswers += 1;
    let speakText = "Sorry, your answer was wrong.";
    return speakText;
}



// -------------------------------------------------------------------
// Training state handler functions
function getJsonForCourse(courseName, sessionAttributes) {
    return "data/" + sessionAttributes.courseName + ".json";
}

async function trainingFinished(sessionAttributes, persistentAttributes, handlerInput) {
    sessionAttributes.state = config.states.FINISHED;
    persistentAttributes.finishedTrainings += 1;
}


// -------------------------------------------------------------------
// Custom utility functions
function getRandom(min, max) {
    return Math.floor((Math.random() * ((max - min) + 1)) + min);
  }
  

// This function takes the contents of an array and randomly shuffles it.
function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;
  
    while ( 0 !== currentIndex ) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }