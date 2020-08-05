'use strict';

const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
//const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const persistenceAdapter = new DynamoDbPersistenceAdapter({ tableName : process.env.DYNAMODB_TABLE_NAME });
const dbHandler = require('./dbHandler.js');
//import { getRequestType, getIntentName, getSlotValue, SkillBuilders } from 'ask-sdk-core';
//import * as Alexa from 'ask-sdk-core'
//import persistenceAdapter from 'ask-sdk-s3-persistence-adapter';


const states = {
    STUDENT_NAME:  `_STUDENT_NAME`,
    CHOOSE_COURSE: `_CHOOSE_COURSE`,
    TRAINING: `_TRAINING`,
    FINISHED: `_FINISHED`,
};


const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        let speakOutput = null;
        let repromptOutput = null;

        console.log("learning assistant started");

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        // Reset saved reprompt output
        persistentAttributes.repromptOutput = null;

        if (persistentAttributes.studentName) {
            let speakQuestion = `Would you like to resume your last course or start another course?`;
            speakOutput = `Welcome back ${persistentAttributes.studentName}! ${speakQuestion}`;
            repromptOutput = speakQuestion; 
            sessionAttributes.state = states.CHOOSE_COURSE;
        } else {
            speakOutput = "Hi and welcome to the learning asssistant! I can help you understand the most important concepts of your courses. First, please tell me your first name!"
            repromptOutput = "Please tell me your first name."
            // Initialize new user
            persistentAttributes.currentCourse = null;
            persistentAttributes.startedTrainings = 0;
            persistentAttributes.finishedTrainings = 0;
            persistentAttributes.totalQuestionsAsked = 0;
            persistentAttributes.totalCorrectAnswers = 0;
            persistentAttributes.totalWrongAnswers = 0;
            sessionAttributes.state = states.STUDENT_NAME;
        }

        //speakOutput += " I'm running node.js version: " + process.versions.node;
        if (repromptOutput === null) {
            repromptOutput = speakOutput;
        }
        
        // Save state
        persistentAttributes.repromptOutput = repromptOutput;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
        await handlerInput.attributesManager.savePersistentAttributes();

        //const userId = handlerInput.requestEnvelope.session.user.userId;
        // TODO: save to DB - userId, so that we can track who used it how many times
        // DB design: userId, num sessions, num questions answered

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


// -------------------------------------------------------------------
// Config Intent Handlers

const StudentNameIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StudentNameIntent';
    },
    async handle(handlerInput) {
        // Get Slots
        const studentName = Alexa.getSlotValue(handlerInput.requestEnvelope, 'StudentName');

        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        if (sessionAttributes.state !== states.STUDENT_NAME)
        {
            // TODO handle case where we did not ask for the name
            speakOutput = `I understood a name, but did not expect that. Please repeat what you wanted to say in case I misunderstood you.`;
            if (persistentAttributes.repromptOutput !== null) {
                speakOutput += ' ' + persistentAttributes.repromptOutput;
            }
        } else {
            // Update attributes
            sessionAttributes.state = states.CHOOSE_COURSE;
            persistentAttributes.studentName = studentName;
            
            const availableCourses = await dbHandler.getTrainingNamesForSpeech();
            speakOutput = `Hi ${studentName}. I'm happy to help you with learning for your courses. I have content for these courses: ${availableCourses}. Which course should I start?`;
            repromptOutput = 'Please choose one of these courses: ' + availableCourses;
        }


        if (repromptOutput === null) {
            repromptOutput = speakOutput;
        }

        // Save state
        persistentAttributes.repromptOutput = repromptOutput;
        handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const ChooseCourseIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ChooseCourseIntent';
    },
    async handle(handlerInput) {
        //let availableTrainings = await getTrainingList();
        //let speakOut = "Available trainings: " + JSON.stringify(availableTrainings);
        // let speakOut = await getTrainingNamesForSpeech();
        // console.log(speakOut);
        
        // return handlerInput.responseBuilder
        //     .speak(speakOut)
        //     .getResponse();

        // Get Slots
        let course = Alexa.getSlotValue(handlerInput.requestEnvelope, 'course');

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        // TODO: match slot value with available courses and get its ID from the DB

        let introOutput = `You chose the course: ${course}. Let's get started! `;

        // Update attributes
        persistentAttributes.currentCourse = course;
        
        // Get question
        let {speakOutput, repromptOutput} = await startNewCourse(sessionAttributes, persistentAttributes, handlerInput);
        speakOutput = introOutput + " " + speakOutput;
        
        // Save state
        persistentAttributes.repromptOutput = repromptOutput;
        handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


const ResumeCourseIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ResumeCourseIntent';
    },
    async handle(handlerInput) {
        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        if (sessionAttributes.state === states.CHOOSE_COURSE)
        {
            if (persistentAttributes.currentCourse !== null) {
                // Able to resume
                let introOutput = `Resuming course ${persistentAttributes.currentCourse}.`;
                ({speakOutput, repromptOutput} = await startNewCourse(sessionAttributes, persistentAttributes, handlerInput));
                speakOutput = introOutput + " " + speakOutput;
            } else {
                speakOutput = `You have not started a course yet. Please choose a course first!`;
                if (persistentAttributes.repromptOutput !== null) {
                    speakOutput += ' ' + persistentAttributes.repromptOutput;
                }
            }
        } else {
            speakOutput = `I understood that you'd like to resume the previous course. This is not possible right now. `
            if (persistentAttributes.repromptOutput !== null) {
                speakOutput += ' ' + persistentAttributes.repromptOutput;
            }
        }
        
        if (repromptOutput === null) {
            repromptOutput = speakOutput;
        }

        // Save state
        persistentAttributes.repromptOutput = repromptOutput;
        handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


// -------------------------------------------------------------------
// Training intent handlers

const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        let {speakOutput, repromptOutput}  = await handleYesNoIntent(true, sessionAttributes, persistentAttributes, handlerInput);
        if (repromptOutput === null) {
            repromptOutput = speakOutput;
        }
        
        // Save state
        persistentAttributes.repromptOutput = repromptOutput;
        handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


const NoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
    },
    async handle(handlerInput) {
        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        let {speakOutput, repromptOutput} = await handleYesNoIntent(false, sessionAttributes, persistentAttributes, handlerInput);
        if (repromptOutput === null) {
            repromptOutput = speakOutput;
        }
        
        // Save state
        persistentAttributes.repromptOutput = repromptOutput;
        handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        if (repromptOutput === -1) {
            // Stop the skill
            return CancelAndStopIntentHandler.handle(handlerInput);
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const NumericAnswerIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'NumericAnswerIntent';
    },
    async handle(handlerInput) {
        let speakOutput = "Not implemented yet";
        let repromptOutput = null;
        
        //const {speakOutput, repromptOutput} = await handleYesNoIntent(false);
        
        if (repromptOutput === null) {
            repromptOutput = speakOutput;
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }

}

// -------------------------------------------------------------------
// Active training handler functions

async function startNewCourse(sessionAttributes, persistentAttributes, handlerInput) {
    persistentAttributes.startedTrainings += 1;
    sessionAttributes.state = states.TRAINING;
    sessionAttributes.questionNumber = 0;
    sessionAttributes.score = 0;
    return await getNextQuestion(sessionAttributes, persistentAttributes, handlerInput);
}

async function handleYesNoIntent(isYes, sessionAttributes, persistentAttributes, handlerInput) {
    let speakOutput = null;
    let repromptOutput = null;

    if (sessionAttributes.state === states.TRAINING) {
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
    } else if (sessionAttributes.state === states.FINISHED) {
        if (isYes) {
            let introOutput = `Restarting your course ${persistentAttributes.currentCourse}`;
            ({speakOutput, repromptOutput} = await startNewCourse(sessionAttributes, persistentAttributes, handlerInput));
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
    let introText = `Question number ${sessionAttributes.questionNumber}: `;

    // TODO: hardcoded question for now
    let questionText = "Is accessibility only important for people with disabilities? Yes or no?";

    // Store new question data
    sessionAttributes.questionId = 1;
    sessionAttributes.questionType = 1;
    sessionAttributes.correctAnswer = 0;
    sessionAttributes.questionText = questionText;

    speakOutput = introText + questionText;
    repromptOutput = questionText;

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
    sessionAttributes.state = states.FINISHED;
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

  
// -------------------------------------------------------------------
// Generic input handlers
const DeleteDataIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DeleteDataIntent';
    },
    async handle(handlerInput) {
        await handlerInput.attributesManager.deletePersistentAttributes();
        
        const speakOutput = 'I have deleted your progress and data. See you next time!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('Was kann ich noch für dich tun?')
            .withShouldEndSession(true)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        // TODO
        const speakOutput = "I'm the teaching assistant and can ask you questions to help you learn for your courses. It works like a quiz!";

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again. Error stack: ${error.stack}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        // Launch
        LaunchRequestHandler,
        // Config
        StudentNameIntentHandler,
        ChooseCourseIntentHandler,
        ResumeCourseIntentHandler,
        // Training
        NumericAnswerIntentHandler,
        YesIntentHandler,
        NoIntentHandler,
        // Data handling
        DeleteDataIntentHandler,
        // Generic Alexa
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .withPersistenceAdapter(
        //new persistenceAdapter.S3PersistenceAdapter({bucketName:process.env.S3_PERSISTENCE_BUCKET})
        persistenceAdapter
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .lambda();
