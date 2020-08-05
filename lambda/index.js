'use strict';

const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
//const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const persistenceAdapter = new DynamoDbPersistenceAdapter({ tableName : process.env.DYNAMODB_TABLE_NAME });
const dbHandler = require('./dbHandler.js');
const trainingHandler = require('./trainingHandler.js');
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
            trainingHandler.initializeUser();
        }

        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

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

        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

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
        let {speakOutput, repromptOutput} = await trainingHandler.startNewCourse(sessionAttributes, persistentAttributes, handlerInput);
        speakOutput = introOutput + " " + speakOutput;
        
        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

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
                ({speakOutput, repromptOutput} = await trainingHandler.startNewCourse(sessionAttributes, persistentAttributes, handlerInput));
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
        
        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

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

        let {speakOutput, repromptOutput}  = await trainingHandler.handleYesNoIntent(true, sessionAttributes, persistentAttributes, handlerInput);
        
        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);
        
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

        let {speakOutput, repromptOutput} = await trainingHandler.handleYesNoIntent(false, sessionAttributes, persistentAttributes, handlerInput);
        
        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

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
        
        //const {speakOutput, repromptOutput} = await trainingHandler.handleYesNoIntent(false);
        
        if (repromptOutput === null) {
            repromptOutput = speakOutput;
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }

}

async function saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput) {
    if (repromptOutput === null) {
        repromptOutput = speakOutput;
    }

    // Save state
    persistentAttributes.repromptOutput = repromptOutput;
    handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
    await handlerInput.attributesManager.savePersistentAttributes();
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return repromptOutput;
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
