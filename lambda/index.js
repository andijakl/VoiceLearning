// @ts-check
"use strict";

// TODO: maybe add dynamic entities, see: https://developer.amazon.com/en-US/docs/alexa/custom-skills/use-dynamic-entities-for-customized-interactions.html
// https://github.com/alexa-samples/dynamic-entities-demo
// Or the Amazon.Search entity type: https://developer.amazon.com/en-US/docs/alexa/custom-skills/built-in-intent-library.html#search

const Alexa = require("ask-sdk-core");
const i18next = require("i18next");
//const sprintf = require("sprintf-js").sprintf;
const sprintf = require("i18next-sprintf-postprocessor");
//const util = require("./util");
const { DynamoDbPersistenceAdapter } = require("ask-sdk-dynamodb-persistence-adapter");
// Make sure the Dynamo DB persistence is always in the same region by providing an own instance
const AWS = require("aws-sdk");
AWS.config.update({ region: "eu-west-1" });
const dynamoDBInstance = new AWS.DynamoDB({ apiVersion: "latest" });
const persistenceAdapter = new DynamoDbPersistenceAdapter({
    // Disable process not defined warning
    // eslint-disable-next-line no-undef
    tableName: process.env.DYNAMODB_TABLE_NAME || "Learning-Assistant",
    dynamoDBClient: dynamoDBInstance
});
const config = require("./config.js");
const trainingHandler = require("./trainingHandler.js");
const dbHandler = require("./dbHandler.js");
const uiHandler = require("./uiHandler.js");

const languageStrings = {
    "en": require("./i18n/en"),
    "de": require("./i18n/de"),
};

// -------------------------------------------------------------------
// Launch intent handler

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
    },
    async handle(handlerInput) {
        let responseBuilder = handlerInput.responseBuilder;
        let speakOutput = null;
        let repromptOutput = null;
        let welcomeBack = false;
        let availableTrainings = null;

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        // Reset saved reprompt output
        sessionAttributes.repromptOutput = null;

        if (!config.useStudentName) {
            // Do not ask for student name
            if (persistentAttributes.currentTrainingName !== undefined && persistentAttributes.currentTrainingName !== null
                && persistentAttributes.currentTrainingName !== "") {
                welcomeBack = true;
                // User has already started a training - ask to resume
                const speakQuestion = handlerInput.t("WELCOME_PERSONALIZED_REPROMPT_NONAME", {
                    currentTrainingName: persistentAttributes.currentTrainingName
                });
                speakOutput = handlerInput.t("WELCOME_PERSONALIZED_NONAME", {
                    prompt: speakQuestion
                });
                repromptOutput = speakQuestion;
                sessionAttributes.state = config.states.CHOOSE_COURSE;
            } else {
                // User has not started a course yet - treat as a new user!
                let numTrainings = 0;
                ({ numTrainings, availableTrainings } = await dbHandler.getTrainingNamesForSpeech(getMainLanguage(), handlerInput.t("AVAILABLE_COURSES_OR")));
                speakOutput = handlerInput.t((numTrainings === 1) ? "WELCOME_ONECOURSE_NONAME" : "WELCOME_NONAME", {
                    availableTrainings: availableTrainings
                });
                repromptOutput = handlerInput.t((numTrainings === 1) ? "WELCOME_ONECOURSE_REPROMPT_NONAME" : "WELCOME_REPROMPT_NONAME", {
                    availableTrainings: availableTrainings
                });
                // Initialize new user
                trainingHandler.initializeUser(sessionAttributes, persistentAttributes);
                sessionAttributes.state = config.states.CHOOSE_COURSE;
            }
        } else {
            // Use student name
            if (persistentAttributes.studentName) {
                welcomeBack = true;
                // TODO: Check if there is a course to resume!
                const speakQuestion = handlerInput.t("WELCOME_PERSONALIZED_REPROMPT");
                speakOutput = handlerInput.t("WELCOME_PERSONALIZED", {
                    studentName: persistentAttributes.studentName,
                    prompt: speakQuestion
                });
                repromptOutput = speakQuestion;
                sessionAttributes.state = config.states.CHOOSE_COURSE;
            } else {
                speakOutput = handlerInput.t("WELCOME");
                repromptOutput = handlerInput.t("WELCOME_REPROMPT");
                // Initialize new user
                trainingHandler.initializeUser(sessionAttributes, persistentAttributes);
                sessionAttributes.state = config.states.STUDENT_NAME;
            }
        }

        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        uiHandler.showWelcomeUi(welcomeBack, availableTrainings, persistentAttributes.finishedTrainings, persistentAttributes.totalQuestionsAsked, handlerInput);

        return responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};
// -------------------------------------------------------------------
// Config Intent Handlers


/*
const StudentNameIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "StudentNameIntent"
            //&& Alexa.getDialogState(handlerInput.requestEnvelope) === "COMPLETED"
            && sessionAttributes.state == config.states.STUDENT_NAME;
    },
    async handle(handlerInput) {
        // Get Slots
        const studentName = Alexa.getSlotValue(handlerInput.requestEnvelope, "StudentName");

        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        if (sessionAttributes.state !== config.states.STUDENT_NAME) {
            // TODO handle case where we did not ask for the name
            speakOutput = handlerInput.t("ERROR_STUDENT_NAME_WHEN_NOT_EXPECTED");
            if (sessionAttributes.repromptOutput !== null) {
                speakOutput += " " + sessionAttributes.repromptOutput;
                repromptOutput = sessionAttributes.repromptOutput;
            }
        } else {
            // Update attributes
            sessionAttributes.state = config.states.CHOOSE_COURSE;
            persistentAttributes.studentName = studentName;

            const availableTrainings = await dbHandler.getTrainingNamesForSpeech(getMainLanguage(), handlerInput.t("AVAILABLE_COURSES_OR"));
            speakOutput = handlerInput.t("AVAILABLE_COURSES", {
                studentName: studentName,
                availableTrainings: availableTrainings
            });
            speakOutput = handlerInput.t("AVAILABLE_COURSES_REPROMPT", {
                availableTrainings: availableTrainings
            });
        }

        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};
*/

const ChooseCourseIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "ChooseCourseIntent"
            && sessionAttributes.state == config.states.CHOOSE_COURSE;
    },
    async handle(handlerInput) {
        // Get Slots
        const trainingNameSlot = Alexa.getSlot(handlerInput.requestEnvelope, "course");
        // Get actual main slot value, not the spoken synonym
        const userTrainingName = getCanonicalSlot(trainingNameSlot);

        let { speakOutput, repromptOutput } = await handleChooseCourse(userTrainingName, handlerInput);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

// Provide value 1 for parameter userTrainingName if there is only one available course and we should start that one.
async function handleChooseCourse(userTrainingName, handlerInput) {
    let speakOutput = null;
    let repromptOutput = null;

    // Get attributes
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
    const userId = Alexa.getUserId(handlerInput.requestEnvelope);

    //console.log("User selected training: " + userTrainingName);

    if (userTrainingName === undefined || userTrainingName === null) {
        speakOutput = handlerInput.t("ERROR_COURSE_NOT_UNDERSTOOD");
        const { availableTrainings } = await dbHandler.getTrainingNamesForSpeech(getMainLanguage(), handlerInput.t("AVAILABLE_COURSES_OR"));
        repromptOutput = handlerInput.t("AVAILABLE_COURSES_REPROMPT", {
            availableTrainings: availableTrainings
        });
        speakOutput += " " + repromptOutput;
    } else {
        // Match slot value with available courses and get its ID from the DB
        const selectedTrainingInfo = await trainingHandler.selectTraining(userTrainingName, persistentAttributes, getMainLanguage());
        if (selectedTrainingInfo !== null) {
            // Training selected successfully
            let introOutput = handlerInput.t("SELECTED_COURSE_START_TRAINING", {
                currentTrainingName: persistentAttributes.currentTrainingName
            });
            // Get question
            ({ speakOutput, repromptOutput } = await trainingHandler.startNewTraining(userId, sessionAttributes, persistentAttributes, handlerInput, getMainLanguage()));
            speakOutput = introOutput + " " + speakOutput;
        } else {
            // Unable to match slot to training in DB
            speakOutput = handlerInput.t("ERROR_COURSE_NOT_FOUND", {
                userTrainingName: userTrainingName
            });
            const { availableTrainings } = await dbHandler.getTrainingNamesForSpeech(getMainLanguage(), handlerInput.t("AVAILABLE_COURSES_OR"));
            repromptOutput = handlerInput.t("AVAILABLE_COURSES_REPROMPT", {
                availableTrainings: availableTrainings
            });
            speakOutput += " " + repromptOutput;
        }
    }

    repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

    return { speakOutput, repromptOutput };
}


const ListCoursesIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "ListCoursesIntent"
            && sessionAttributes.state !== config.states.TRAINING;
    },
    async handle(handlerInput) {
        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        //const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        const trainingNames = await dbHandler.getTrainingNames(getMainLanguage());
        const availableTrainings = await dbHandler.getTrainingNamesForSpeechListAvailable(trainingNames, handlerInput.t("AVAILABLE_COURSES_OR"));
        speakOutput = handlerInput.t("AVAILABLE_COURSES_LIST", {
            availableTrainings: availableTrainings
        });

        // Keep reprompt output from previous question
        repromptOutput = sessionAttributes.repromptOutput;

        if (sessionAttributes.state !== config.states.CHOOSE_COURSE) {
            // Only add the reprompt output if we're not in the choose course state.
            // If we're in that state, the skill is waiting for a cource choice already,
            // which would result in listing the courses twice if the user is asking
            // for available courses at that point.
            speakOutput += " " + repromptOutput;
        } else {
            // Show UI only if we're in the choose course state
            uiHandler.showChooseCourseUi(trainingNames, handlerInput);
        }
        if (!repromptOutput) {
            repromptOutput = speakOutput;
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const ResumeCourseIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "ResumeCourseIntent"
            && (sessionAttributes.state == config.states.CHOOSE_COURSE
                || sessionAttributes.state == config.states.FINISHED);
    },
    async handle(handlerInput) {
        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const userId = Alexa.getUserId(handlerInput.requestEnvelope);

        if (sessionAttributes.state === config.states.CHOOSE_COURSE) {
            if (persistentAttributes.currentTrainingName !== undefined && persistentAttributes.currentTrainingName !== null
                && persistentAttributes.currentTrainingName !== "") {
                // Able to resume
                let introOutput = handlerInput.t("RESUMING_COURSE_START_TRAINING", {
                    currentTrainingName: persistentAttributes.currentTrainingName
                });
                ({ speakOutput, repromptOutput } = await trainingHandler.startNewTraining(userId, sessionAttributes, persistentAttributes, handlerInput, getMainLanguage()));
                speakOutput = introOutput + " " + speakOutput;
            } else {
                // No course startet yet - can not resume
                speakOutput = handlerInput.t("ERROR_RESUME_NO_COURSE_STARTED");
                if (sessionAttributes.repromptOutput !== null) {
                    speakOutput += " " + sessionAttributes.repromptOutput;
                    repromptOutput = sessionAttributes.repromptOutput;
                }
            }
        } else if (sessionAttributes.state === config.states.FINISHED) {
            // Training is finished and user said resume
            // Start training again
            let introOutput = handlerInput.t("RESTART_COURSE_START_TRAINING", {
                currentTrainingName: persistentAttributes.currentTrainingName
            });
            ({ speakOutput, repromptOutput } = await trainingHandler.startNewTraining(userId, sessionAttributes, persistentAttributes, handlerInput, getMainLanguage()));
            speakOutput = introOutput + " " + speakOutput;
        } else {
            // Should only get here when in the state of choosing a course 
            // (usually at the beginning or after a training is finished)
            speakOutput = handlerInput.t("ERROR_RESUME_COURSE_WRONG_STATE");
            if (sessionAttributes.repromptOutput !== null) {
                speakOutput += " " + sessionAttributes.repromptOutput;
                repromptOutput = sessionAttributes.repromptOutput;
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
// APL Intent handlers
const AplTrainingQuestionEventHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "Alexa.Presentation.APL.UserEvent"
            && handlerInput.requestEnvelope.request.arguments[0] === "ListItemSelected"
            && (sessionAttributes.state == config.states.TRAINING);
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const clickedListItemNum = handlerInput.requestEnvelope.request.arguments[1];
        let speakOutput = null;
        let repromptOutput = null;

        if (sessionAttributes.questionType === config.questionType.YES_NO) {
            // Yes / true & no / false handling is centralized as these
            // answers have similar meaning in the quiz context.
            const isYes = clickedListItemNum === 1;
            ({ speakOutput, repromptOutput } = await HandleYesNoTrueFalse(isYes, handlerInput));
        } else {
            // Handle multiple choice / numeric answers
            ({ speakOutput, repromptOutput } = await HandleNumericAnswer(clickedListItemNum, handlerInput));
        }

        if (!repromptOutput) {
            repromptOutput = speakOutput;
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


const AplChooseCourseEventHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "Alexa.Presentation.APL.UserEvent"
            && handlerInput.requestEnvelope.request.arguments[0] === "ListItemSelected"
            && (sessionAttributes.state == config.states.CHOOSE_COURSE);
    },
    async handle(handlerInput) {
        const clickedListItemNum = handlerInput.requestEnvelope.request.arguments[1];

        const trainingNames = await dbHandler.getTrainingNames(getMainLanguage());
        const userTrainingName = trainingNames[clickedListItemNum - 1];

        let { speakOutput, repromptOutput } = await handleChooseCourse(userTrainingName, handlerInput);

        if (!repromptOutput) {
            repromptOutput = speakOutput;
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const AplTrainAgainEventHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "Alexa.Presentation.APL.UserEvent"
            && handlerInput.requestEnvelope.request.arguments[0] === "trainAgain"
            && (sessionAttributes.state == config.states.FINISHED);
    },
    async handle(handlerInput) {
        const isYes = handlerInput.requestEnvelope.request.arguments[1] === 1;

        let { speakOutput, repromptOutput } = await HandleYesNoTrueFalse(isYes, handlerInput);

        if (!repromptOutput) {
            repromptOutput = speakOutput;
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .withShouldEndSession(!isYes)
            .getResponse();
    }
};

// -------------------------------------------------------------------
// Training intent handlers

const YesNoIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.YesIntent"
                || Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.NoIntent")
            && (sessionAttributes.state == config.states.CHOOSE_COURSE
                || sessionAttributes.state == config.states.TRAINING
                || sessionAttributes.state == config.states.FINISHED);
    },
    async handle(handlerInput) {
        const isYes = Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.YesIntent";
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let speakOutput = null;
        let repromptOutput = null;

        if (sessionAttributes.state === config.states.CHOOSE_COURSE) {
            if (isYes) {
                // User said yes to starting the only available course
                ({ speakOutput, repromptOutput } = await handleChooseCourse(1, handlerInput));
            } else {
                // User doesn't want to start a course
                speakOutput = handlerInput.t("DOES_NOT_WANT_TO_TRAIN");
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .withShouldEndSession(true)
                    .getResponse();

            }
        } else {
            // Yes / true & no / false handling is centralized as these
            // answers have similar meaning in the quiz context.
            ({ speakOutput, repromptOutput } = await HandleYesNoTrueFalse(isYes, handlerInput));
        }

        // User does not want to continue after the last question
        if (repromptOutput === config.DO_NOT_CONTINUE) {
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


const TrueFalseIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "TrueFalseAnswerIntent"
            && sessionAttributes.state == config.states.TRAINING;
    },
    async handle(handlerInput) {
        const trueFalseAnswerSlot = Alexa.getSlot(handlerInput.requestEnvelope, "TrueFalse");

        //console.log("slot value: " + trueFalseAnswerSlot);
        // Get actual main slot value, not the spoken synonym
        const trueFalseAnswer = getCanonicalSlot(trueFalseAnswerSlot);
        //console.log("Canonical: " + trueFalseAnswer);

        const isYes = trueFalseAnswer.localeCompare("true", undefined, { sensitivity: "accent" }) === 0;

        // Yes / true & no / false handling is centralized as these
        // answers have similar meaning in the quiz context.
        let { speakOutput, repromptOutput } = await HandleYesNoTrueFalse(isYes, handlerInput);

        // User does not want to continue after the last question
        if (repromptOutput === config.DO_NOT_CONTINUE) {
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

async function HandleYesNoTrueFalse(isYes, handlerInput) {
    // Get attributes
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
    const userId = Alexa.getUserId(handlerInput.requestEnvelope);

    let { speakOutput, repromptOutput } = await trainingHandler.handleYesNoIntent(isYes, userId, sessionAttributes, persistentAttributes, handlerInput, getMainLanguage());

    repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

    return { speakOutput, repromptOutput };
}



const NumericAnswerIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "NumericAnswerIntent"
            && sessionAttributes.state == config.states.TRAINING;
    },
    async handle(handlerInput) {
        // Get attributes
        const numericAnswer = Alexa.getSlotValue(handlerInput.requestEnvelope, "numericAnswer");

        let { speakOutput, repromptOutput } = await HandleNumericAnswer(numericAnswer, handlerInput);

        // User does not want to continue after the last question
        if (repromptOutput === config.DO_NOT_CONTINUE) {
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }

};


async function HandleNumericAnswer(numericAnswer, handlerInput) {
    // Get attributes
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
    const userId = Alexa.getUserId(handlerInput.requestEnvelope);

    // Handle numeric answer, which corresponds to the answer number
    let { speakOutput, repromptOutput } = await trainingHandler.handleNumericIntent(numericAnswer, userId, sessionAttributes, persistentAttributes, handlerInput, getMainLanguage());

    repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

    return { speakOutput, repromptOutput };
}

// -------------------------------------------------------------------
// Utility functions

async function saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput) {
    sessionAttributes.speakOutput = speakOutput;
    if (!repromptOutput) {
        repromptOutput = speakOutput;
    }

    // Save state
    if (repromptOutput === config.DO_NOT_CONTINUE) {
        sessionAttributes.repromptOutput = null;
    } else {
        sessionAttributes.repromptOutput = repromptOutput;
    }
    handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
    await handlerInput.attributesManager.savePersistentAttributes();
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return repromptOutput;
}

// Get the "original" slot value, not the actual spoken synonym
// From: https://stackoverflow.com/questions/59569514/how-do-i-get-the-canonical-slot-value-out-of-an-alexa-request
const getCanonicalSlot = (slot) => {
    if (slot.resolutions && slot.resolutions.resolutionsPerAuthority.length) {
        for (let resolution of slot.resolutions.resolutionsPerAuthority) {
            if (resolution.status && resolution.status.code === "ER_SUCCESS_MATCH") {
                return resolution.values[0].value.name;
            }
        }
    }
};

// -------------------------------------------------------------------
// Generic input handlers
const DeleteDataIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "DeleteDataIntent"
            && (sessionAttributes.state == config.states.CHOOSE_COURSE
                || sessionAttributes.state == config.states.FINISHED);
    },
    async handle(handlerInput) {
        await handlerInput.attributesManager.deletePersistentAttributes();

        const speakOutput = handlerInput.t("DELETE_DATA_CONFIRMED");
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent";
    },
    async handle(handlerInput) {
        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        //const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        let speakOutput = handlerInput.t("HELP_PROMPT");
        let specificOutput = null;

        // Add specific help text for the current state
        if (sessionAttributes.state === config.states.CHOOSE_COURSE) {
            specificOutput = handlerInput.t("HELP_STATE_CHOOSE_COURSE");
        } else if (sessionAttributes.state === config.states.TRAINING) {
            specificOutput = handlerInput.t("HELP_STATE_TRAINING");
        } else if (sessionAttributes.state === config.states.FINISHED) {
            specificOutput = handlerInput.t("HELP_STATE_FINISHED");
        }
        if (specificOutput !== null) {
            speakOutput += " " + specificOutput;
        }

        let repromptOutput = (specificOutput !== null ? specificOutput + " " : "") + handlerInput.t("GENERIC_REPROMPT");
        if (sessionAttributes.repromptOutput) {
            repromptOutput = sessionAttributes.repromptOutput;
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


const RepeatIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.RepeatIntent";
    },
    async handle(handlerInput) {
        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // Ensure speakOutput and repromptOutput have default values if not set
        let speakOutput = sessionAttributes.speakOutput;
        let repromptOutput = sessionAttributes.repromptOutput;

        // If there is no speakOutput, let the fallback handler take over
        if (!speakOutput) {
            const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
            ({ speakOutput, repromptOutput } = await trainingHandler.handleFallbackIntent(true, handlerInput, intentName));
        }

        // If there is no repromptOutput, use the speakOutput
        if (!repromptOutput) {
            repromptOutput = speakOutput;
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.CancelIntent"
                || Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent");
    },
    async handle(handlerInput) {
        let repromptOutput = null;
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        sessionAttributes.state = config.states.CHOOSE_COURSE;
        const speakOutput = handlerInput.t("EXIT");
        await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.FallbackIntent";
    },
    async handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        let { speakOutput, repromptOutput } = await trainingHandler.handleFallbackIntent(true, handlerInput, intentName);

        if (!repromptOutput) {
            repromptOutput = speakOutput;
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    },
};

// Got an intent that shouldn't have been triggered because
// the skill is in a different state.
// But Alexa is quite sure about that triggered intent.
// Log the issue and reprompt the user, hoping to get the expected answer next time.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest";
    },
    async handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        let { speakOutput, repromptOutput } = await trainingHandler.handleFallbackIntent(false, handlerInput, intentName);

        if (!repromptOutput) {
            repromptOutput = speakOutput;
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
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
        console.error(`Error handled: ${error.message}`);
        console.error("Error stack", JSON.stringify(error.stack));
        console.error("Error", JSON.stringify(error));
        let speakOutput = handlerInput.t("ERROR");
        if (error.stack) {
            speakOutput += " " + error.stack;
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


const LocalizationInterceptor = {
    process(handlerInput) {
        i18next.use(sprintf)
            .init({
                lng: handlerInput.requestEnvelope.request.locale,
                fallbackLng: "en", // fallback to EN if locale doesn't exist
                overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
                resources: languageStrings,
                returnObjects: true
            });

        handlerInput.t = (key, opts) => {
            const value = i18next.t(key, { ...{ interpolation: { escapeValue: false } }, ...opts });
            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)]; // return a random element from the array
            } else {
                return value;
            }
        };
    }
};

function getMainLanguage() {
    return (i18next.resolvedLanguage) ? i18next.resolvedLanguage.substring(0, 2) : "en";
}

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        // Launch
        LaunchRequestHandler,
        // Config
        //StudentNameIntentHandler,
        // Training
        NumericAnswerIntentHandler,
        YesNoIntentHandler,
        TrueFalseIntentHandler,
        // Course logic
        ChooseCourseIntentHandler,
        ListCoursesIntentHandler,
        ResumeCourseIntentHandler,
        // Data handling
        DeleteDataIntentHandler,
        // APL
        AplTrainingQuestionEventHandler,
        AplChooseCourseEventHandler,
        AplTrainAgainEventHandler,
        // Generic Alexa
        HelpIntentHandler,
        RepeatIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        FallbackIntentHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .withPersistenceAdapter(
        persistenceAdapter
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .addRequestInterceptors(LocalizationInterceptor)
    .lambda();
