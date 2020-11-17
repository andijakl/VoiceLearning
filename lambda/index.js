"use strict";

// Warning: only deploy with Powershell 7, issues with "normal" PowerShell: https://github.com/alexa/ask-cli/issues/59

const Alexa = require("ask-sdk-core");
const i18next = require("i18next");
const sprintf = require("sprintf-js").sprintf;
const { DynamoDbPersistenceAdapter } = require("ask-sdk-dynamodb-persistence-adapter");
// Make sure the Dynamo DB persistence is always in the same region by providing an own instance
const AWS = require("aws-sdk");
AWS.config.update({ region: "eu-west-1" });
const dynamoDBInstance = new AWS.DynamoDB({ apiVersion: "latest" });
const persistenceAdapter = new DynamoDbPersistenceAdapter({
    // Disable process not defined warning
    // eslint-disable-next-line no-undef
    tableName: process.env.DYNAMODB_TABLE_NAME,
    dynamoDBClient: dynamoDBInstance
});
const config = require("./config.js");
const trainingHandler = require("./trainingHandler.js");
const dbHandler = require("./dbHandler.js");

const languageStrings = {
    "en": require("./i18n/en"),
    "de": require("./i18n/de"),
};

// APL
//const aplWelcomeDocument = require("./apl_welcome.json");

// Tokens used when sending the APL directives
//const APL_TOKEN_WELCOME = "welcomeToken";

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
        //let startAlexaConversationsDialog = null;

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        // Reset saved reprompt output
        sessionAttributes.repromptOutput = null;

        if (!config.useStudentName) {
            // Do not ask for student name
            if (persistentAttributes.currentTrainingName) {
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
                const availableTrainings = await dbHandler.getTrainingNamesForSpeech(getMainLanguage(), handlerInput.t("AVAILABLE_COURSES_OR"));
                speakOutput = handlerInput.t("WELCOME_NONAME", {
                    availableTrainings: availableTrainings
                });
                repromptOutput = handlerInput.t("WELCOME_REPROMPT_NONAME", {
                    availableTrainings: availableTrainings
                });
                // Initialize new user
                trainingHandler.initializeUser(sessionAttributes, persistentAttributes);
                sessionAttributes.state = config.states.CHOOSE_COURSE;
            }
        } else {
            // Use student name
            if (persistentAttributes.studentName) {
                // TODO: Check if there is a course to resume!
                const speakQuestion = handlerInput.t("WELCOME_PERSONALIZED_REPROMPT");
                speakOutput = handlerInput.t("WELCOME_PERSONALIZED", {
                    studentName: persistentAttributes.studentName,
                    prompt: speakQuestion
                });
                repromptOutput = speakQuestion;
                sessionAttributes.state = config.states.CHOOSE_COURSE;
                //startAlexaConversationsDialog = "StartTraining";
            } else {
                speakOutput = handlerInput.t("WELCOME");
                repromptOutput = handlerInput.t("WELCOME_REPROMPT");
                // Initialize new user
                trainingHandler.initializeUser(sessionAttributes, persistentAttributes);
                sessionAttributes.state = config.states.STUDENT_NAME;
                //startAlexaConversationsDialog = "SetFirstName";
            }
        }

        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        // TODO: Define nice looking APL
        // if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)["Alexa.Presentation.APL"]){
        //     console.log("APL is supported");
        //     // Add the RenderDocument directive to the responseBuilder
        //     responseBuilder.addDirective({
        //         type: "Alexa.Presentation.APL.RenderDocument",
        //         token: APL_TOKEN_WELCOME,
        //         document: aplWelcomeDocument,
        //         datasources: {
        //             data: {
        //                 text: {
        //                     //type: "object",
        //                     welcomeMessage: speakOutput
        //                 }
        //             }
        //         }
        //     });
        // } else {
        //     // User's device does not support APL
        //     console.log("APL is NOT supported");
        // }

        // TODO: Alexa Conversations crashes without meaningful error message when doing this.
        // Therefore, not using Alexa Conversations for now.
        // if (startAlexaConversationsDialog) {
        //     // TODO: Hand over to Alexa Conversations
        //     if (i18next.language === "en-US") {
        //         console.log("Handing over to Alexa Conversations. Starting dialog: " + startAlexaConversationsDialog);
        //         return handlerInput.responseBuilder
        //             .addDirective({
        //                 type: "Dialog.DelegateRequest",
        //                 target: "AMAZON.Conversations",
        //                 period: {
        //                     until: "EXPLICIT_RETURN" 
        //                 },
        //                 updatedRequest: {
        //                     type: "Dialog.InputRequest",
        //                     input: {
        //                         name: startAlexaConversationsDialog
        //                     }
        //                 }
        //             })
        //             .getResponse();
        //     } 
        // }

        return responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


// -------------------------------------------------------------------
// Config Intent Handlers



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

        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const userId = Alexa.getUserId(handlerInput.requestEnvelope);

        //console.log("User selected training: " + userTrainingName);

        if (userTrainingName === undefined || userTrainingName === null) {
            speakOutput = handlerInput.t("ERROR_COURSE_NOT_UNDERSTOOD");
            const availableTrainings = await dbHandler.getTrainingNamesForSpeech(getMainLanguage(), handlerInput.t("AVAILABLE_COURSES_OR"));
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
                const availableTrainings = await dbHandler.getTrainingNamesForSpeech(getMainLanguage(), handlerInput.t("AVAILABLE_COURSES_OR"));
                repromptOutput = handlerInput.t("AVAILABLE_COURSES_REPROMPT", {
                    availableTrainings: availableTrainings
                });
                speakOutput += " " + repromptOutput;
            }
        }


        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


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

        const availableTrainings = await dbHandler.getTrainingNamesForSpeech(getMainLanguage(), handlerInput.t("AVAILABLE_COURSES_OR"));
        speakOutput = handlerInput.t("AVAILABLE_COURSES_LIST", {
            availableTrainings: availableTrainings
        });

        // Keep reprompt output from previous question
        repromptOutput = sessionAttributes.repromptOutput;

        speakOutput += " " + repromptOutput;

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
            if (persistentAttributes.currentTrainingName !== null) {
                // Able to resume
                let introOutput = handlerInput.t("RESUMING_COURSE_START_TRAINING", {
                    currentTrainingName: persistentAttributes.currentTrainingName
                });
                ({ speakOutput, repromptOutput } = await trainingHandler.startNewTraining(userId, sessionAttributes, persistentAttributes, handlerInput, getMainLanguage()));
                speakOutput = introOutput + " " + speakOutput;
            } else {
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
// Training intent handlers

const YesNoIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.YesIntent"
                || Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.NoIntent")
            && (sessionAttributes.state == config.states.TRAINING
                || sessionAttributes.state == config.states.FINISHED);
    },
    async handle(handlerInput) {
        const isYes = Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.YesIntent";

        let { speakOutput, repromptOutput } = await HandleYesNoTrueFalse(isYes, handlerInput);

        // User doesn't want to continue with the skill - stop
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
        console.log("Canonical: " + trueFalseAnswer);

        const isYes = trueFalseAnswer.localeCompare("true", undefined, { sensitivity: "accent" }) === 0;

        let { speakOutput, repromptOutput } = await HandleYesNoTrueFalse(isYes, handlerInput);

        // User doesn't want to continue with the skill - stop
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
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const userId = Alexa.getUserId(handlerInput.requestEnvelope);
        const numericAnswer = Alexa.getSlotValue(handlerInput.requestEnvelope, "numericAnswer");

        let { speakOutput, repromptOutput } = await trainingHandler.handleNumericIntent(numericAnswer, userId, sessionAttributes, persistentAttributes, handlerInput, getMainLanguage());


        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        // User doesn't want to continue with the skill - stop
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

// -------------------------------------------------------------------
// Utility functions

async function saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput) {
    if (repromptOutput === null) {
        repromptOutput = speakOutput;
    }

    // Save state
    sessionAttributes.repromptOutput = repromptOutput;
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
            //.reprompt('Was kann ich noch für dich tun?')
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
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        //const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const speakOutput = handlerInput.t("HELP_PROMPT");
        let repromptOutput = handlerInput.t("GENERIC_REPROMPT");
        if (sessionAttributes.repromptOutput !== null) {
            repromptOutput = sessionAttributes.repromptOutput;
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
    handle(handlerInput) {
        const speakOutput = handlerInput.t("EXIT");
        return handlerInput.responseBuilder
            .speak(speakOutput)
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
        i18next
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
    return (i18next.language) ? i18next.language.substring(0, 2) : "en";
}

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        // Launch
        LaunchRequestHandler,
        // Alexa Converstaions
        //ListTrainingsApiHandler,
        //StartTrainingApiHandler,
        //SetFirstNameApiHandler,
        // Config
        StudentNameIntentHandler,
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
        // Generic Alexa
        HelpIntentHandler,
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
